import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
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
  const [showNameChangeModal, setShowNameChangeModal] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [pendingClusterUuid, setPendingClusterUuid] = useState<string | null>(null);
  const [currentPlayerName, setCurrentPlayerName] = useState('');

  const handleSubmit = async () => {
    if (!clusterId.trim()) {
      setError('Por favor, insira o nome do clube');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const trimmedClusterId = clusterId.trim();

      if (mode === 'create') {
        // Verifica se o nome_cluster já existe
        console.log('🔍 Cluster: Verificando se o nome existe...', { nome_cluster: trimmedClusterId, mode });
        const { data: existingClusters, error: checkError } = await supabase
          .from('clusters')
          .select('cluster_uuid')
          .eq('nome_cluster', trimmedClusterId);

        if (checkError) {
          console.error('❌ Cluster: Erro ao verificar clube:', checkError);
          console.error('❌ Cluster: Código do erro:', checkError.code);
          console.error('❌ Cluster: Mensagem do erro:', checkError.message);
          console.error('❌ Cluster: Detalhes:', checkError.details);
          setError(`Erro ao verificar clube: ${checkError.message}`);
          setLoading(false);
          return;
        }

        console.log('🔍 Cluster: Resultado da verificação:', { existingClusters, count: existingClusters?.length || 0 });

        if (existingClusters && existingClusters.length > 0) {
          console.warn('⚠️ Cluster: Nome já existe');
          setError('Este nome de clube já está em uso. Por favor, escolha outro ou junte-se a ele.');
          return;
        }

        // Insere o novo cluster
        const { data: { user } } = await supabase.auth.getUser();
        const playerName = user?.user_metadata?.player_name || 'Jogador';
        
        console.warn('➕ Cluster: Criando novo clube...');
        console.warn('➕ Cluster: Dados a inserir:', {
          nome_cluster: trimmedClusterId,
          created_by: userId
        });
        
        // 1. Criar o cluster na tabela clusters (cluster_uuid será gerado automaticamente pela BD)
        const { data: clusterData, error: clusterError } = await supabase
          .from('clusters')
          .insert([{
            nome_cluster: trimmedClusterId,
            created_by: userId
          }])
          .select();

        if (clusterError) {
          console.error('❌ Cluster: Erro ao criar cluster:', clusterError);
          console.error('❌ Cluster: Código do erro:', clusterError.code);
          console.error('❌ Cluster: Mensagem do erro:', clusterError.message);
          console.error('❌ Cluster: Detalhes:', clusterError.details);
          setError(`Erro ao criar clube: ${clusterError.message}`);
          setLoading(false);
          return;
        }
        
        if (!clusterData || clusterData.length === 0) {
          setError('Nenhum dado retornado após criar o cluster');
          setLoading(false);
          return;
        }
        
        console.log('✅ Cluster: Cluster criado:', clusterData);
        const clusterUuid = clusterData[0].cluster_uuid;
        console.log('✅ Cluster: UUID gerado pela BD:', clusterUuid);

        // 2. Adicionar o criador como membro admin em cluster_members
        const { data, error: memberError } = await supabase
          .from('cluster_members')
          .insert([{
            cluster_uuid: clusterUuid,
            user_id: userId,
            nome: playerName,
            admin: true
          }])
          .select();

        if (memberError) {
          console.error('❌ Cluster: Erro ao adicionar membro:', memberError);
          // Reverter criação do cluster
          await supabase.from('clusters').delete().eq('cluster_uuid', clusterUuid);
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
          .eq('cluster_uuid', clusterUuid)
          .maybeSingle(); // Usa maybeSingle() para evitar erro quando não há resultados

        // Ignora erro PGRST116 (nenhum resultado encontrado)
        if (playerCheckError && playerCheckError.code !== 'PGRST116') {
          console.error('❌ Erro ao verificar jogador existente:', playerCheckError);
          throw playerCheckError;
        }

        if (existingPlayerInCluster) {
          console.warn('⚠️ Cluster: Nome de jogador já existe neste clube');
          // Deletar o membro e o cluster recém-criados
          await supabase.from('cluster_members').delete().eq('cluster_uuid', clusterUuid).eq('user_id', userId);
          await supabase.from('clusters').delete().eq('cluster_uuid', clusterUuid);
          setError('Já existe um jogador com este nome neste clube. Por favor, escolha outro nome de jogador.');
          return;
        }
        
        // Criar o jogador
        console.warn('➕ Cluster: Criando jogador...');
        const { error: playerError } = await supabase
          .from('jogadores')
          .insert({
            nome: playerName,
            cluster_uuid: clusterUuid,
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
          await supabase.from('cluster_members').delete().eq('cluster_uuid', clusterUuid).eq('user_id', userId);
          await supabase.from('clusters').delete().eq('cluster_uuid', clusterUuid);
          
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
        // Modo juntar-se: busca o cluster pelo nome_cluster
        console.warn('🔍 Cluster: Buscando clube pelo nome:', trimmedClusterId);
        const { data: existingClusters, error: checkError } = await supabase
          .from('clusters')
          .select('cluster_uuid, nome_cluster')
          .eq('nome_cluster', trimmedClusterId);

        if (checkError) {
          console.error('❌ Cluster: Erro ao verificar clube:', checkError);
          console.error('❌ Cluster: Código do erro:', checkError.code);
          console.error('❌ Cluster: Mensagem do erro:', checkError.message);
          console.error('❌ Cluster: Detalhes:', checkError.details);
          setError(`Erro ao buscar clube: ${checkError.message}`);
          setLoading(false);
          return;
        }

        console.log('🔍 Cluster: Resultados encontrados:', existingClusters);

        if (!existingClusters || existingClusters.length === 0) {
          console.warn('⚠️ Cluster: Clube não encontrado');
          setError('Este clube não existe. Por favor, verifique o nome ou crie um novo.');
          setLoading(false);
          return;
        }

        const clusterUuid = existingClusters[0].cluster_uuid;
        console.log('✅ Cluster: Clube encontrado, UUID:', clusterUuid);

        // Atualiza o usuário para o novo clube
        console.warn('🔄 Cluster: Adicionando usuário ao clube...');
        
        // Buscar o nome do jogador do metadata do usuário
        const { data: { user } } = await supabase.auth.getUser();
        const playerName = user?.user_metadata?.player_name || 'Jogador';
        
        const { error: memberError } = await supabase
          .from('cluster_members')
          .insert({
            cluster_uuid: clusterUuid,
            user_id: userId,
            nome: playerName,
            admin: false
          });

        if (memberError) {
          console.error('❌ Cluster: Erro ao adicionar usuário ao cluster:', memberError);
          throw memberError;
        }

        console.warn('✅ Cluster: Usuário adicionado com sucesso ao clube:', clusterUuid);
        
        // Verificar se já existe um jogador com este nome no cluster
        const { data: existingPlayerInCluster, error: playerCheckError } = await supabase
          .from('jogadores')
          .select('nome')
          .eq('nome', playerName)
          .eq('cluster_uuid', clusterUuid)
          .maybeSingle(); // Usa maybeSingle() para evitar erro quando não há resultados

        // Ignora erro PGRST116 (nenhum resultado encontrado)
        if (playerCheckError && playerCheckError.code !== 'PGRST116') {
          console.error('❌ Erro ao verificar jogador existente:', playerCheckError);
          throw playerCheckError;
        }

        if (existingPlayerInCluster) {
          console.warn('⚠️ Cluster: Nome de jogador já existe neste clube');
          // Guardar informação para usar depois se o usuário escolher mudar o nome
          setPendingClusterUuid(clusterUuid);
          setCurrentPlayerName(playerName);
          setNewPlayerName('');
          setShowNameChangeModal(true);
          setLoading(false);
          return;
        }
        
        // Criar jogador
        console.warn('➕ Cluster: Criando jogador para usuário que se juntou...');
        
        const { error: playerError } = await supabase
          .from('jogadores')
          .insert({
            nome: playerName,
            cluster_uuid: clusterUuid,
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
            await supabase.from('cluster_members').delete().eq('cluster_uuid', clusterUuid).eq('user_id', userId);
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
    } catch (error: any) {
      console.error('💥 Cluster: Erro crítico:', error);
      console.error('💥 Cluster: Stack:', error?.stack);
      console.error('💥 Cluster: Tipo:', typeof error);
      
      // Extrair mensagem do erro
      let errorMessage = `Erro ao ${mode === 'create' ? 'criar' : 'juntar-se ao'} clube`;
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.error_description) {
        errorMessage = error.error_description;
      }
      
      console.error('💥 Cluster: Mensagem final:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleContinueWithSameName = async () => {
    if (!pendingClusterUuid) return;
    
    try {
      setLoading(true);
      setShowNameChangeModal(false);
      
      console.log('✅ Usuário optou por continuar com o nome atual:', currentPlayerName);
      
      // Criar jogador com o nome atual
      const { error: playerError } = await supabase
        .from('jogadores')
        .insert({
          nome: currentPlayerName,
          cluster_uuid: pendingClusterUuid,
          rating: 1000,
          numero_jogos: 0,
          numero_vitorias: 0,
          empates: 0,
          derrotas: 0,
          golos_marcados: 0
        });

      if (playerError) {
        console.error('❌ Erro ao criar jogador:', playerError);
        // Reverter a adição ao cluster
        await supabase.from('cluster_members').delete().eq('cluster_uuid', pendingClusterUuid).eq('user_id', userId);
        setError('Erro ao criar jogador. Por favor, tente novamente.');
        return;
      }

      console.log('✅ Jogador criado com sucesso');
      await updateClusterState();
      setPendingClusterUuid(null);
      onComplete();
    } catch (error: any) {
      console.error('💥 Erro ao continuar:', error);
      setError(error?.message || 'Erro ao finalizar cadastro');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeName = async () => {
    if (!newPlayerName.trim()) {
      Alert.alert('Erro', 'Por favor, insira um novo nome');
      return;
    }

    if (!pendingClusterUuid) return;
    
    try {
      setLoading(true);
      
      const trimmedNewName = newPlayerName.trim();
      console.log('🔄 Usuário optou por mudar o nome de', currentPlayerName, 'para', trimmedNewName);
      
      // Verificar se o novo nome também não existe
      const { data: existingPlayer, error: checkError } = await supabase
        .from('jogadores')
        .select('nome')
        .eq('nome', trimmedNewName)
        .eq('cluster_uuid', pendingClusterUuid)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ Erro ao verificar novo nome:', checkError);
        throw checkError;
      }

      if (existingPlayer) {
        Alert.alert('Nome em uso', 'Este nome também já está em uso. Por favor, escolha outro.');
        setLoading(false);
        return;
      }
      
      // Atualizar o nome em cluster_members
      const { error: updateError } = await supabase
        .from('cluster_members')
        .update({ nome: trimmedNewName })
        .eq('cluster_uuid', pendingClusterUuid)
        .eq('user_id', userId);

      if (updateError) {
        console.error('❌ Erro ao atualizar nome em cluster_members:', updateError);
        throw updateError;
      }

      console.log('✅ Nome atualizado em cluster_members');
      
      // Criar jogador com o novo nome
      const { error: playerError } = await supabase
        .from('jogadores')
        .insert({
          nome: trimmedNewName,
          cluster_uuid: pendingClusterUuid,
          rating: 1000,
          numero_jogos: 0,
          numero_vitorias: 0,
          empates: 0,
          derrotas: 0,
          golos_marcados: 0
        });

      if (playerError) {
        console.error('❌ Erro ao criar jogador:', playerError);
        // Reverter mudança de nome
        await supabase
          .from('cluster_members')
          .update({ nome: currentPlayerName })
          .eq('cluster_uuid', pendingClusterUuid)
          .eq('user_id', userId);
        throw playerError;
      }

      console.log('✅ Jogador criado com novo nome');
      setShowNameChangeModal(false);
      await updateClusterState();
      setPendingClusterUuid(null);
      onComplete();
    } catch (error: any) {
      console.error('💥 Erro ao mudar nome:', error);
      Alert.alert('Erro', error?.message || 'Erro ao alterar nome');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelNameChange = async () => {
    if (!pendingClusterUuid) return;
    
    // Reverter a adição ao cluster
    await supabase.from('cluster_members').delete().eq('cluster_uuid', pendingClusterUuid).eq('user_id', userId);
    
    setShowNameChangeModal(false);
    setPendingClusterUuid(null);
    setNewPlayerName('');
    setError('Operação cancelada. Você não foi adicionado ao clube.');
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

      {/* Modal de Escolha de Nome */}
      <Modal
        visible={showNameChangeModal}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
          <View style={[styles.nameChangeContainer, { backgroundColor: theme.background }]}>
            <Text style={[styles.nameChangeTitle, { color: theme.text }]}>
              Nome Duplicado
            </Text>
            
            <Text style={[styles.nameChangeDescription, { color: theme.text }]}>
              Já existe um jogador com o nome "{currentPlayerName}" neste clube.
            </Text>

            <Text style={[styles.nameChangeQuestion, { color: theme.text }]}>
              O que deseja fazer?
            </Text>

            {/* Opção 1: Continuar com o mesmo nome */}
            <TouchableOpacity
              style={[styles.nameChangeButton, { backgroundColor: theme.primary }]}
              onPress={handleContinueWithSameName}
              disabled={loading}
            >
              <Text style={styles.nameChangeButtonText}>
                Continuar com o nome "{currentPlayerName}"
              </Text>
              <Text style={[styles.nameChangeButtonSubtext, { opacity: 0.8 }]}>
                (Haverá dois jogadores com o mesmo nome)
              </Text>
            </TouchableOpacity>

            {/* Opção 2: Mudar o nome */}
            <View style={styles.nameChangeInputContainer}>
              <Text style={[styles.nameChangeLabel, { color: theme.text }]}>
                Ou escolha um novo nome:
              </Text>
              <TextInput
                style={[
                  styles.nameChangeInput,
                  { 
                    backgroundColor: theme.inputBackground,
                    color: theme.text,
                    borderColor: theme.border
                  }
                ]}
                placeholder="Novo nome de jogador"
                placeholderTextColor={theme.placeholderText}
                value={newPlayerName}
                onChangeText={setNewPlayerName}
                maxLength={50}
                editable={!loading}
                autoCapitalize="words"
              />
              
              <TouchableOpacity
                style={[styles.nameChangeButton, { backgroundColor: '#2ecc71' }]}
                onPress={handleChangeName}
                disabled={loading}
              >
                <Text style={styles.nameChangeButtonText}>
                  Usar Novo Nome
                </Text>
              </TouchableOpacity>
            </View>

            {/* Opção 3: Cancelar */}
            <TouchableOpacity
              style={[styles.nameChangeCancelButton, { borderColor: theme.border }]}
              onPress={handleCancelNameChange}
              disabled={loading}
            >
              <Text style={[styles.nameChangeCancelText, { color: theme.text }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  // Name Change Modal Styles
  nameChangeContainer: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  nameChangeTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  nameChangeDescription: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  nameChangeQuestion: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 20,
    marginTop: 12,
    textAlign: 'center',
  },
  nameChangeButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  nameChangeButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#ffffff',
  },
  nameChangeButtonSubtext: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#ffffff',
    marginTop: 4,
  },
  nameChangeInputContainer: {
    marginBottom: 16,
  },
  nameChangeLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
  },
  nameChangeInput: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
  },
  nameChangeCancelButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  nameChangeCancelText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
}); 