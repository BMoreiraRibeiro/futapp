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
      console.warn('🔍 Cluster: Verificando se o nome existe...');
      const { data: existingClusters, error: checkError } = await supabase
        .from('clusters')
        .select('cluster_id')
        .eq('cluster_id', trimmedClusterId);

      if (checkError) {
        console.error('❌ Cluster: Erro ao verificar clube:', checkError);
        throw checkError;
      }

      if (mode === 'create') {
        if (existingClusters && existingClusters.length > 0) {
          console.warn('⚠️ Cluster: Nome já existe');
          setError('Este nome de clube já está em uso. Por favor, escolha outro ou junte-se a ele.');
          return;
        }

        // Insere o novo cluster
        const newCluster = {
          cluster_id: trimmedClusterId,
          user_id: userId,
          admin: true  // Criador do cluster é admin
        };
        
        console.warn('➕ Cluster: Criando novo clube...', newCluster);
        
        const { data, error: insertError } = await supabase
          .from('clusters')
          .insert([newCluster])
          .select();

        if (insertError) {
          console.error('❌ Cluster: Erro ao criar:', insertError);
          throw insertError;
        }

        if (!data || data.length === 0) {
          throw new Error('Nenhum dado retornado após a criação');
        }

        console.warn('✅ Cluster: Clube criado com sucesso:', data[0]);
      } else {
        // Modo juntar-se: verifica se o clube existe e atualiza o usuário
        if (!existingClusters || existingClusters.length === 0) {
          console.warn('⚠️ Cluster: Clube não encontrado');
          setError('Este clube não existe. Por favor, verifique o nome ou crie um novo.');
          return;
        }

        // Atualiza o usuário para o novo clube
        console.warn('🔄 Cluster: Atualizando usuário para o novo clube...');
        const { error: updateError } = await supabase
          .from('clusters')
          .upsert({
            cluster_id: trimmedClusterId,
            user_id: userId,
            admin: false  // Quem se junta não é admin
          });

        if (updateError) {
          console.error('❌ Cluster: Erro ao atualizar usuário:', updateError);
          throw updateError;
        }

        console.warn('✅ Cluster: Usuário atualizado com sucesso para o clube:', trimmedClusterId);
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