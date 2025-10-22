import { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Share, KeyboardAvoidingView, Platform } from 'react-native';
import { Toast } from './Toast';
import { useTheme } from '../lib/theme';
import { colors } from '../lib/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';


type ClusterModalProps = {
  visible: boolean;
  userId: string;
  onComplete: () => void;
  initialMode?: 'create' | 'join';
};

export function ClusterModal({ visible, userId, onComplete, initialMode = 'create' }: ClusterModalProps) {
  const { isDarkMode } = useTheme();
  const { updateClusterState } = useAuth();
  const theme = isDarkMode ? colors.dark : colors.light;
  const [clusterId, setClusterId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdClusterId, setCreatedClusterId] = useState<string | null>(null);
  const [mode, setMode] = useState<'create' | 'join'>(initialMode);
  const [showNameChangeModal, setShowNameChangeModal] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [pendingClusterUuid, setPendingClusterUuid] = useState<string | null>(null);
  const [currentPlayerName, setCurrentPlayerName] = useState('');
  const [toastConfig, setToastConfig] = useState<{ visible: boolean; message: string; type: 'success'|'error'|'info' }>({ visible: false, message: '', type: 'info' });

  const handleSubmit = async () => {
    if (!clusterId.trim()) {
      setError(mode === 'create' ? 'Por favor, insira o nome do clube' : 'Por favor, insira o ID do clube');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const trimmedClusterId = clusterId.trim();

      if (mode === 'create') {
        // Verifica se o nome_cluster já existe
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
          .select('cluster_uuid, id, nome_cluster');

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
        
        const clusterUuid = clusterData[0].cluster_uuid;
        // Save DB generated numeric ID (if present) to show to the user for invites
  // store uuid if needed later, but not displayed
        if (clusterData[0].id) {
          setCreatedClusterId(String(clusterData[0].id));
        }

        // 2. Adicionar o criador como membro admin em cluster_members
        const { data, error: memberError } = await supabase
          .from('cluster_members')
          .insert([{
            cluster_uuid: clusterUuid,
            user_id: userId,
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
        
        // Criar o jogador com user_id
        console.warn('➕ Cluster: Criando jogador...');
        const { error: playerError } = await supabase
          .from('jogadores')
          .insert({
            nome: playerName,
            cluster_uuid: clusterUuid,
            user_id: userId,
            rating: 50,
            visivel: true
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
        console.warn('🔍 Cluster: Buscando clube pelo ID:', trimmedClusterId);
        const idQuery = trimmedClusterId;
        let existingClusters;
        let checkError;

        if (/^\d+$/.test(idQuery)) {
          // numeric id
          const numId = parseInt(idQuery, 10);
          ({ data: existingClusters, error: checkError } = await supabase
            .from('clusters')
            .select('cluster_uuid, nome_cluster, id')
            .eq('id', numId));
        } else {
          // fallback to string comparison (in case id is stored as text)
          ({ data: existingClusters, error: checkError } = await supabase
            .from('clusters')
            .select('cluster_uuid, nome_cluster, id')
            .eq('id', idQuery));
        }

        if (checkError) {
          console.error('❌ Cluster: Erro ao verificar clube:', checkError);
          console.error('❌ Cluster: Código do erro:', checkError.code);
          console.error('❌ Cluster: Mensagem do erro:', checkError.message);
          console.error('❌ Cluster: Detalhes:', checkError.details);
          setError(`Erro ao buscar clube: ${checkError.message}`);
          setLoading(false);
          return;
        }


        if (!existingClusters || existingClusters.length === 0) {
          console.warn('⚠️ Cluster: Clube não encontrado');
          setError('Este clube não existe. Por favor, verifique o ID ou crie um novo clube.');
          setLoading(false);
          return;
        }

        const clusterUuid = existingClusters[0].cluster_uuid;

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
            admin: false
          });

        if (memberError) {
          console.error('❌ Cluster: Erro ao adicionar usuário ao cluster:', memberError);
          throw memberError;
        }

        console.warn('✅ Cluster: Usuário adicionado com sucesso ao clube:', clusterUuid);
        
        // Verificar se já existe um jogador para este user_id neste cluster
        const { data: existingPlayerByUser, error: playerCheckError } = await supabase
          .from('jogadores')
          .select('nome, user_id')
          .eq('user_id', userId)
          .eq('cluster_uuid', clusterUuid)
          .maybeSingle();

        // Ignora erro PGRST116 (nenhum resultado encontrado)
        if (playerCheckError && playerCheckError.code !== 'PGRST116') {
          console.error('❌ Erro ao verificar jogador existente:', playerCheckError);
          throw playerCheckError;
        }

        if (existingPlayerByUser) {
          console.warn('⚠️ Cluster: Este user já tem um jogador neste clube:', existingPlayerByUser.nome);
          // O user já está neste cluster, só precisa atualizar o estado
          await updateClusterState();
          onComplete();
          return;
        }

        // Verificar se o nome já está em uso por OUTRO user
        const { data: existingPlayerByName, error: nameCheckError } = await supabase
          .from('jogadores')
          .select('nome, user_id')
          .eq('nome', playerName)
          .eq('cluster_uuid', clusterUuid)
          .maybeSingle();

        if (nameCheckError && nameCheckError.code !== 'PGRST116') {
          console.error('❌ Erro ao verificar nome existente:', nameCheckError);
          throw nameCheckError;
        }

        if (existingPlayerByName && existingPlayerByName.user_id !== userId) {
          console.warn('⚠️ Cluster: Nome de jogador já existe neste clube (outro user)');
          // Guardar informação para usar depois se o usuário escolher mudar o nome
          setPendingClusterUuid(clusterUuid);
          setCurrentPlayerName(playerName);
          setNewPlayerName('');
          setShowNameChangeModal(true);
          setLoading(false);
          return;
        }
        
        // Criar jogador com user_id
        console.warn('➕ Cluster: Criando jogador para usuário que se juntou...');
        
        const { error: playerError } = await supabase
          .from('jogadores')
          .insert({
            nome: playerName,
            cluster_uuid: clusterUuid,
            user_id: userId,
            rating: 50,
            visivel: true
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

      // If we created a cluster, stay on the confirmation screen until user closes.
      if (mode !== 'create') {
        onComplete();
      }
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
      
      
      // IMPORTANTE: NÃO criar novo jogador!
      // Em vez disso, o jogador com este nome já existe no cluster.
      // Não é necessário fazer nada com a tabela jogadores porque:
      // 1. O jogador já existe com o nome escolhido
      // 2. A tabela jogadores não tem user_id (é compartilhada)
      // 3. O cluster_members já foi criado anteriormente (linha 220-227)
      
      
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
      setError('Por favor, insira um novo nome');
      return;
    }

    if (!pendingClusterUuid) return;
    
    try {
      setLoading(true);
      
      const trimmedNewName = newPlayerName.trim();
      
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
        setError('Este nome também já está em uso. Por favor, escolha outro.');
        setLoading(false);
        return;
      }
      
      // NÃO atualizar nome em cluster_members - essa tabela não tem coluna 'nome'
      // O nome só existe na tabela 'jogadores'
      
      
      // Criar jogador com o novo nome e user_id
      const { error: playerError } = await supabase
        .from('jogadores')
        .insert({
          nome: trimmedNewName,
          cluster_uuid: pendingClusterUuid,
          user_id: userId,
          rating: 50,
          visivel: true
        });

      if (playerError) {
        console.error('❌ Erro ao criar jogador:', playerError);
        throw playerError;
      }

      setShowNameChangeModal(false);
      await updateClusterState();
      setPendingClusterUuid(null);
      onComplete();
    } catch (error: any) {
      console.error('💥 Erro ao mudar nome:', error);
      setError(error?.message || 'Erro ao alterar nome');
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
      >
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

          {!createdClusterId ? (
          <>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: theme.inputBackground,
                color: theme.text,
                borderColor: error ? colors.dark.error : theme.border
              }
            ]}
            placeholder={mode === 'create' ? "Nome do clube (ex: Futebol da Firma)" : "Digite o ID do clube"}
            placeholderTextColor={theme.placeholderText}
            value={clusterId}
            onChangeText={(text) => {
              setClusterId(text);
              setError(null);
            }}
            maxLength={50}
            editable={!loading}
            autoCapitalize={mode === 'create' ? 'words' : 'none'}
            keyboardType={'default'}
            autoCorrect={false}
          />
          </>
          ) : (
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontSize: 16, marginBottom: 8 }}>
                Clube criado com sucesso!
              </Text>
              {createdClusterId && (
                <Text style={{ color: theme.primary, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
                  ID: {createdClusterId}
                </Text>
              )}
                <Text style={{ color: theme.text, fontSize: 13, textAlign: 'center', marginBottom: 12 }}>
                Partilhe este ID para convidar outras pessoas a juntar-se ao clube.
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: theme.primary, marginRight: 8 }]}
                      onPress={async () => {
                    try {
                      // Use UUID if available, otherwise numeric ID
                      const toCopy = createdClusterId;
                      // @ts-ignore: dynamic import of optional dependency
                      const cb = await import('expo-clipboard').catch(() => null);
                      if (cb && cb.setStringAsync) {
                        await cb.setStringAsync(toCopy as string);
                      } else if (navigator && (navigator as any).clipboard && (navigator as any).clipboard.writeText) {
                        // Web fallback
                        await (navigator as any).clipboard.writeText(toCopy as string);
                      } else {
                        throw new Error('Clipboard not available');
                      }
                      setToastConfig({ visible: true, message: 'ID copiado', type: 'success' });
                      } catch (e) {
                      setToastConfig({ visible: true, message: 'Copiar falhou. Copie manualmente o ID', type: 'error' });
                    }
                  }}
                >
                  <Text style={[styles.buttonText, { color: theme.text }]}>Copiar ID</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: '#2ecc71' }]}
                  onPress={() => {
                    // Close and finalize
                    setCreatedClusterId(null);
                    onComplete();
                  }}
                >
                  <Text style={[styles.buttonText, { color: '#fff' }]}>Fechar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: theme.secondary || '#666' }]}
                  onPress={async () => {
                    try {
                    const message = `Participe do meu clube! ID do clube: ${createdClusterId}`;
                      if ((navigator as any)?.share) {
                        // Web: use Web Share API
                        await (navigator as any).share({ title: 'ID do Clube', text: message });
                        return;
                      }

                      // Mobile: use React Native Share API
                      await Share.share({ message, title: 'ID do Clube' });
                    } catch (e) {
                      setToastConfig({ visible: true, message: 'Não foi possível partilhar o ID', type: 'error' });
                    }
                  }}
                >
                  <Text style={[styles.buttonText, { color: '#fff' }]}>Compartilhar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {error && (
            <Text style={[styles.errorText, { color: colors.dark.error }]}>
              {error}
            </Text>
          )}

          {!createdClusterId && (
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
          )}
        </View>
      </KeyboardAvoidingView>

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
      {/* Toast for copy/share actions - keep inside main return */}
      <Toast
        visible={toastConfig.visible}
        message={toastConfig.message}
        type={toastConfig.type}
        onHide={() => setToastConfig(prev => ({ ...prev, visible: false }))}
      />
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