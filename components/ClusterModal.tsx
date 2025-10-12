import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../lib/theme';
import { colors } from '../lib/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ClusterModalProps = {
  visible: boolean;
  userId: string;
  onComplete: () => void;
};

export function ClusterModal({ visible, userId, onComplete }: ClusterModalProps) {
  const { isDarkMode } = useTheme();
  const { updateClusterState } = useAuth();
  const theme = isDarkMode ? colors.dark : colors.light;
  const [clusterId, setClusterId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'join'>('create');

  const handleSubmit = async () => {
    if (!clusterId.trim()) {
      setError('Por favor, insira o nome do clube');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const trimmedClusterId = clusterId.trim();

      // Verifica se o cluster_id já existe
      console.log('🔍 Cluster: Verificando se o nome existe...', { clusterId: trimmedClusterId, mode });
      const { data: existingClusters, error: checkError } = await supabase
        .from('clusters')
        .select('cluster_id')
        .eq('cluster_id', trimmedClusterId);

      if (checkError) {
        console.error('❌ Cluster: Erro ao verificar clube:', checkError);
        throw checkError;
      }

      console.log('🔍 Cluster: Resultado da verificação:', { existingClusters, count: existingClusters?.length || 0 });

      if (mode === 'create') {
        if (existingClusters && existingClusters.length > 0) {
          console.warn('⚠️ Cluster: Nome já existe');
          setError('Este nome de clube já está em uso. Por favor, escolha outro ou junte-se a ele.');
          return;
        }

        // Insere o novo cluster
        const { data: { user } } = await supabase.auth.getUser();
        const playerName = user?.user_metadata?.player_name || 'Jogador';
        
        console.warn('➕ Cluster: Criando novo clube...');
        
        // 1. Criar o cluster na tabela clusters
        const { error: clusterError } = await supabase
          .from('clusters')
          .insert([{
            cluster_id: trimmedClusterId,
            nome_cluster: trimmedClusterId,
            created_by: userId
          }]);

        if (clusterError) {
          console.error('❌ Cluster: Erro ao criar cluster:', clusterError);
          throw clusterError;
        }

        // 2. Adicionar o criador como membro admin em cluster_members
        const { data, error: memberError } = await supabase
          .from('cluster_members')
          .insert([{
            cluster_id: trimmedClusterId,
            user_id: userId,
            nome: playerName,
            admin: true
          }])
          .select();

        if (memberError) {
          console.error('❌ Cluster: Erro ao adicionar membro:', memberError);
          // Reverter criação do cluster
          await supabase.from('clusters').delete().eq('cluster_id', trimmedClusterId);
          throw memberError;
        }

        if (!data || data.length === 0) {
          throw new Error('Nenhum dado retornado após a criação');
        }

        console.warn('✅ Cluster: Clube e membro criados com sucesso:', data[0]);
        
        // Verificar se já existe um jogador com este nome no cluster
        const { data: existingPlayerInCluster, error: playerCheckError } = await supabase
          .from('jogadores')
          .select('nome')
          .eq('nome', playerName)
          .eq('cluster_id', trimmedClusterId)
          .maybeSingle(); // Usa maybeSingle() para evitar erro quando não há resultados

        // Ignora erro PGRST116 (nenhum resultado encontrado)
        if (playerCheckError && playerCheckError.code !== 'PGRST116') {
          console.error('❌ Erro ao verificar jogador existente:', playerCheckError);
          throw playerCheckError;
        }

        if (existingPlayerInCluster) {
          console.warn('⚠️ Cluster: Nome de jogador já existe neste clube');
          // Deletar o membro e o cluster recém-criados
          await supabase.from('cluster_members').delete().eq('cluster_id', trimmedClusterId).eq('user_id', userId);
          await supabase.from('clusters').delete().eq('cluster_id', trimmedClusterId);
          setError('Já existe um jogador com este nome neste clube. Por favor, escolha outro nome de jogador.');
          return;
        }
        
        // Criar o jogador
        console.warn('➕ Cluster: Criando jogador...');
        const { error: playerError } = await supabase
          .from('jogadores')
          .insert({
            nome: playerName,
            cluster_id: trimmedClusterId,
            rating: 1000,
            numero_jogos: 0,
            numero_vitorias: 0,
            empates: 0,
            derrotas: 0,
            golos_marcados: 0
          });

        if (playerError) {
          console.error('❌ Cluster: Erro ao criar jogador:', playerError);
          // Se falhar ao criar jogador, deletar o membro e o cluster
          await supabase.from('cluster_members').delete().eq('cluster_id', trimmedClusterId).eq('user_id', userId);
          await supabase.from('clusters').delete().eq('cluster_id', trimmedClusterId);
          
          if (playerError.code === '23505') { // Código de erro para violação de unique constraint
            setError('Já existe um jogador com este nome neste clube. Por favor, escolha outro nome de jogador.');
          } else {
            throw playerError;
          }
          return;
        } else {
          console.warn('✅ Cluster: Jogador criado com sucesso');
        }
      } else {
        // Modo juntar-se: verifica se o clube existe e atualiza o usuário
        if (!existingClusters || existingClusters.length === 0) {
          console.warn('⚠️ Cluster: Clube não encontrado');
          setError('Este clube não existe. Por favor, verifique o nome ou crie um novo.');
          return;
        }

        // Atualiza o usuário para o novo clube
        console.warn('🔄 Cluster: Adicionando usuário ao clube...');
        
        // Buscar o nome do jogador do metadata do usuário
        const { data: { user } } = await supabase.auth.getUser();
        const playerName = user?.user_metadata?.player_name || 'Jogador';
        
        const { error: memberError } = await supabase
          .from('cluster_members')
          .insert({
            cluster_id: trimmedClusterId,
            user_id: userId,
            nome: playerName,
            admin: false
          });

        if (memberError) {
          console.error('❌ Cluster: Erro ao adicionar usuário ao cluster:', memberError);
          throw memberError;
        }

        console.warn('✅ Cluster: Usuário adicionado com sucesso ao clube:', trimmedClusterId);
        
        // Verificar se já existe um jogador com este nome no cluster
        const { data: existingPlayerInCluster, error: playerCheckError } = await supabase
          .from('jogadores')
          .select('nome')
          .eq('nome', playerName)
          .eq('cluster_id', trimmedClusterId)
          .maybeSingle(); // Usa maybeSingle() para evitar erro quando não há resultados

        // Ignora erro PGRST116 (nenhum resultado encontrado)
        if (playerCheckError && playerCheckError.code !== 'PGRST116') {
          console.error('❌ Erro ao verificar jogador existente:', playerCheckError);
          throw playerCheckError;
        }

        if (existingPlayerInCluster) {
          console.warn('⚠️ Cluster: Nome de jogador já existe neste clube');
          // Reverter a adição ao cluster
          await supabase.from('cluster_members').delete().eq('cluster_id', trimmedClusterId).eq('user_id', userId);
          setError('Já existe um jogador com este nome neste clube. Por favor, use outro nome de jogador.');
          return;
        }
        
        // Criar jogador
        console.warn('➕ Cluster: Criando jogador para usuário que se juntou...');
        
        const { error: playerError } = await supabase
          .from('jogadores')
          .insert({
            nome: playerName,
            cluster_id: trimmedClusterId,
            rating: 1000,
            numero_jogos: 0,
            numero_vitorias: 0,
            empates: 0,
            derrotas: 0,
            golos_marcados: 0
          });

        if (playerError) {
          console.error('❌ Cluster: Erro ao criar jogador:', playerError);
          
          if (playerError.code === '23505') { // Código de erro para violação de unique constraint
            // Reverter a adição ao cluster
            await supabase.from('cluster_members').delete().eq('cluster_id', trimmedClusterId).eq('user_id', userId);
            setError('Já existe um jogador com este nome neste clube. Por favor, use outro nome de jogador.');
            return;
          } else {
            throw playerError;
          }
        } else {
          console.warn('✅ Cluster: Jogador criado com sucesso');
        }
      }
      
      // Atualiza o estado do cluster no contexto de autenticação
      await updateClusterState();
      console.warn('✅ Cluster: Estado atualizado, completando...');
      
      onComplete();
    } catch (error) {
      console.error('💥 Cluster: Erro crítico:', error);
      setError(error instanceof Error ? error.message : `Erro ao ${mode === 'create' ? 'criar' : 'juntar-se ao'} clube`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <Text style={[styles.title, { color: theme.text }]}>
            Bem-vindo ao Futebol às Quartas!
          </Text>
          
          <Text style={[styles.description, { color: theme.text }]}>
            {mode === 'create' 
              ? 'Para começar, escolha um nome para seu clube. O clube é um grupo que você gerencia, onde poderá organizar jogos, convidar jogadores e manter estatísticas.'
              : 'Digite o nome do clube ao qual você deseja se juntar. Certifique-se de que o nome está correto.'}
          </Text>

          <View style={styles.modeContainer}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'create' && styles.modeButtonActive,
                { borderColor: theme.primary }
              ]}
              onPress={() => {
                setMode('create');
                setError(null);
              }}
            >
              <Text style={[
                styles.modeButtonText,
                mode === 'create' && styles.modeButtonTextActive,
                { color: mode === 'create' ? theme.text : theme.primary }
              ]}>
                Criar Clube
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'join' && styles.modeButtonActive,
                { borderColor: theme.primary }
              ]}
              onPress={() => {
                setMode('join');
                setError(null);
              }}
            >
              <Text style={[
                styles.modeButtonText,
                mode === 'join' && styles.modeButtonTextActive,
                { color: mode === 'join' ? theme.text : theme.primary }
              ]}>
                Juntar-se
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: theme.inputBackground,
                color: theme.text,
                borderColor: error ? colors.dark.error : theme.border
              }
            ]}
            placeholder={mode === 'create' ? "Nome do clube (ex: Futebol da Firma)" : "Digite o nome do clube"}
            placeholderTextColor={theme.placeholderText}
            value={clusterId}
            onChangeText={(text) => {
              setClusterId(text);
              setError(null);
            }}
            maxLength={50}
            editable={!loading}
            autoCapitalize="words"
          />

          {error && (
            <Text style={[styles.errorText, { color: colors.dark.error }]}>
              {error}
            </Text>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: theme.primary },
              loading && styles.buttonDisabled
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={[styles.buttonText, { color: theme.text }]}>
              {loading 
                ? (mode === 'create' ? 'Criando...' : 'Juntando-se...') 
                : (mode === 'create' ? 'Criar Clube' : 'Juntar-se ao Clube')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  modeContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  modeButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  modeButtonActive: {
    backgroundColor: '#2d8a3e',
  },
  modeButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  modeButtonTextActive: {
    color: '#ffffff',
  },
  input: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
}); 