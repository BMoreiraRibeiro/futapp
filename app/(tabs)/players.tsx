import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Image, Modal } from 'react-native';
import { useTheme } from '../../lib/theme';
import { colors } from '../../lib/colors';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Toast } from '../../components/Toast';
import { Check } from 'lucide-react-native';
import { useLanguage } from '../../lib/language';

type Player = {
  id_jogador: string;
  nome: string;
  rating: number;
  visivel: boolean;
};

export default function PlayersScreen() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const { clusterName, isAdmin } = useAuth();
  const { t } = useLanguage();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [toastConfig, setToastConfig] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'info'
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editSuccessId, setEditSuccessId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [playerRating, setPlayerRating] = useState('');
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    if (clusterName) {
      fetchPlayers();
    } else {
      console.warn('⚠️ Players: clusterName é null, não vai buscar jogadores');
    }
  }, [clusterName]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastConfig({
      visible: true,
      message,
      type
    });
  };

  const hideToast = () => {
    setToastConfig(prev => ({ ...prev, visible: false }));
  };

  const fetchPlayers = async () => {
    if (!clusterName) {
      console.warn('⚠️ fetchPlayers: clusterName é null');
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('jogadores')
        .select('id_jogador, nome, rating, visivel')
        .eq('cluster_uuid', clusterName)
        .order('nome');

      if (error) {
        console.error('❌ fetchPlayers: Erro:', error);
        throw error;
      }
      
      setPlayers(data || []);
    } catch (error: any) {
      console.error('💥 fetchPlayers: Erro crítico:', error);
      showToast('Erro ao carregar jogadores', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatRating = (r: number | null | undefined) => {
    if (r === null || r === undefined || isNaN(r as any)) return '-';
    return Number.isInteger(r) ? String(r) : (Math.round((r as number) * 10) / 10).toFixed(1);
  };

  const handleDeletePlayer = async (id_jogador: string, nome: string) => {
    setPlayerToDelete({id: id_jogador, name: nome});
    setDeleteConfirmVisible(true);
  };

  const confirmDeletePlayer = async () => {
    if (!playerToDelete) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('jogadores')
        .delete()
        .eq('id_jogador', playerToDelete.id);

      if (error) throw error;

      showToast('Jogador excluído com sucesso!', 'success');
      fetchPlayers();
    } catch (error) {
      console.error('Erro ao excluir jogador:', error);
      showToast('Erro ao excluir jogador', 'error');
    } finally {
      setLoading(false);
      setDeleteConfirmVisible(false);
      setPlayerToDelete(null);
    }
  };

  const handleToggleVisibility = async (id_jogador: string, currentVisibility: boolean) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('jogadores')
        .update({ visivel: !currentVisibility })
        .eq('id_jogador', id_jogador);

      if (error) throw error;

      fetchPlayers();
    } catch (error) {
      console.error('Erro ao alterar visibilidade:', error);
      showToast('Erro ao alterar visibilidade do jogador', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (player: Player) => {
    setEditingPlayer(player);
    setPlayerName(player.nome);
    setPlayerRating(player.rating.toString());
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!playerName.trim()) {
      showToast('Por favor, insira o nome do jogador', 'error');
      return;
    }

    if (!playerRating.trim()) {
      showToast('Por favor, insira o rating do jogador', 'error');
      return;
    }

    const rating = parseFloat(playerRating);
    if (isNaN(rating)) {
      showToast('Rating deve ser um número', 'error');
      return;
    }

    // Validar rating entre 0 e 100
    if (rating < 0 || rating > 100) {
      showToast('Rating deve estar entre 0 e 100', 'error');
      return;
    }

    // Se editingPlayer é null, é uma INSERÇÃO, caso contrário é UPDATE
    if (!editingPlayer) {
      await handleInsertNewPlayer(playerName.trim(), rating);
    } else {
      await handleUpdatePlayer(playerName.trim(), rating);
    }
  };

  const handleInsertNewPlayer = async (nome: string, rating: number) => {
    if (!clusterName) {
      showToast('Erro: cluster não identificado', 'error');
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('jogadores')
        .insert([
          {
            cluster_uuid: clusterName,
            nome: nome,
            rating: rating,
            visivel: true
          }
        ])
        .select();

      if (error) {
        console.error('❌ Players: Erro ao inserir:', error);
        console.error('❌ Players: Código do erro:', error.code);
        console.error('❌ Players: Mensagem do erro:', error.message);
        console.error('❌ Players: Detalhes:', error.details);
        throw error;
      }

      showToast('Jogador adicionado com sucesso!', 'success');
      setPlayerName('');
      setPlayerRating('');
      setModalVisible(false);
      fetchPlayers();
    } catch (error: any) {
      console.error('💥 Players: Erro crítico ao adicionar jogador:', error);
      showToast(error?.message || 'Erro ao adicionar jogador', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlayer = async (nome: string, rating: number) => {
    if (!editingPlayer) return;
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('jogadores')
        .update({
          nome: nome,
          rating: rating,
          visivel: true
        })
        .eq('id_jogador', editingPlayer.id_jogador);

      if (error) throw error;

  setEditSuccessId(editingPlayer.id_jogador);
  setPlayerName('');
  setPlayerRating('');
  setEditingPlayer(null);
  setModalVisible(false);
  fetchPlayers();
  setTimeout(() => setEditSuccessId(null), 2000);
    } catch (error) {
      console.error('❌ Players: Erro ao atualizar jogador:', error);
      showToast('Erro ao atualizar jogador', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderPlayer = ({ item }: { item: Player }) => (
    <View style={[styles.playerCard, { backgroundColor: theme.cardBackground }]}> 
      <View style={styles.playerInfo}> 
        <Text style={[styles.playerName, { color: theme.text }]}>{item.nome}</Text> 
        <Text style={[styles.playerRating, { color: theme.text }]}>Rating: {formatRating(item.rating)}</Text> 
      </View> 
      <View style={styles.playerActions}> 
        {/* Visibility toggle is available to everyone */}
        <TouchableOpacity 
          onPress={() => handleToggleVisibility(item.id_jogador, item.visivel)} 
          style={[styles.actionButton, { backgroundColor: item.visivel ? theme.success : theme.error }]} 
        > 
          <Text style={styles.actionButtonText}> 
            {item.visivel ? t('players.available') : t('players.injured')} 
          </Text> 
        </TouchableOpacity>

        {isAdmin ? (
          <>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: theme.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]} 
              onPress={() => handleEdit(item)} 
              disabled={!!editSuccessId} 
            > 
              {editSuccessId === item.id_jogador ? ( 
                <Check size={20} color="#4ade80" style={{ marginRight: 4 }} /> 
              ) : ( 
                <Text style={styles.actionButtonText}>{t('common.edit')}</Text> 
              )} 
            </TouchableOpacity> 
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: theme.error }]} 
              onPress={() => handleDeletePlayer(item.id_jogador, item.nome)} 
            > 
              <Text style={styles.actionButtonText}>{t('common.delete')}</Text> 
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.nonAdminActions}>
            <Text style={[styles.nonAdminText, { color: theme.text }]}>Somente administradores podem editar/excluir</Text>
          </View>
        )}
      </View> 
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <Image 
        source={require('../../assets/images/background3.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <View style={styles.contentContainer}>
        <Text style={[styles.title, { color: theme.text }]}>{t('players.title')}</Text>

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            setEditingPlayer(null);
            setPlayerName('');
            setPlayerRating('50'); // Rating default: 50
            setModalVisible(true);
          }}
        >
          <Text style={styles.addButtonText}>{t('players.addPlayer')}</Text>
        </TouchableOpacity>

        <FlatList
          data={players}
          renderItem={renderPlayer}
          keyExtractor={(item: Player) => item.id_jogador}
          contentContainerStyle={styles.listContainer as any}
          refreshing={loading}
          onRefresh={fetchPlayers}
        />

        {modalVisible && (
          <Modal
            visible={modalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={[styles.modalContainer, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
              <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {editingPlayer ? t('players.editPlayer') : t('players.addPlayer')}
                </Text>

                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.inputBackground,
                    color: theme.text,
                    borderColor: theme.border
                  }]}
                  placeholder={t('players.name')}
                  placeholderTextColor={theme.placeholderText}
                  value={playerName}
                  onChangeText={setPlayerName}
                />

                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.inputBackground,
                    color: theme.text,
                    borderColor: theme.border
                  }]}
                  placeholder={t('players.rating')}
                  placeholderTextColor={theme.placeholderText}
                  value={playerRating}
                  onChangeText={setPlayerRating}
                  keyboardType="decimal-pad"
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: theme.error }]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.modalButtonText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: theme.primary }]}
                    onPress={handleSave}
                  >
                    <Text style={styles.modalButtonText}>{t('common.save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {deleteConfirmVisible && playerToDelete && (
          <Modal
            visible={deleteConfirmVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setDeleteConfirmVisible(false)}
          >
            <View style={[styles.modalContainer, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
              <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  Confirmar exclusão
                </Text>
                {playerToDelete && (
                  <Text style={[styles.modalMessage, { color: theme.text }]}>
                    Tem certeza que deseja excluir o jogador {playerToDelete.name}?
                  </Text>
                )}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: theme.secondary }]}
                    onPress={() => setDeleteConfirmVisible(false)}
                  >
                    <Text style={styles.modalButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: theme.error }]}
                    onPress={confirmDeletePlayer}
                  >
                    <Text style={styles.modalButtonText}>Excluir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {toastConfig.visible && (
          <Toast
            visible={toastConfig.visible}
            message={toastConfig.message}
            type={toastConfig.type}
            onHide={hideToast}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.7,
    resizeMode: 'cover',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    marginBottom: 16,
  },
  addButton: {
    width: '100%',
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: 'white',
  },
  listContainer: {
    gap: 8,
  },
  playerCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  playerInfo: {
    marginBottom: 12,
  },
  playerName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  playerRating: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  playerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nonAdminActions: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  nonAdminText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  actionButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    padding: 16,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: 'gray',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalButton: {
    width: '48%',
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: 'white',
  },
});