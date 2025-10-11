import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Image, Modal } from 'react-native';
import { useTheme } from '../../lib/theme';
import { colors } from '../../lib/colors';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Toast } from '../../components/Toast';
import { Plus, Trash2, Eye, EyeOff, Cross } from 'lucide-react-native';
import { useLanguage } from '../../lib/language';

type Player = {
  nome: string;
  rating: number;
  visivel: boolean;
  jogos: number;
  vitorias: number;
  derrotas: number;
  empates: number;
};

export default function PlayersScreen() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const { clusterName } = useAuth();
  const { t } = useLanguage();
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRating, setNewPlayerRating] = useState('');
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
  const [playerName, setPlayerName] = useState('');
  const [playerRating, setPlayerRating] = useState('');

  useEffect(() => {
    if (clusterName) {
      fetchPlayers();
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
      console.warn('fetchPlayers: clusterName é null');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('jogadores')
        .select('*')
        .eq('cluster_id', clusterName)
        .order('nome');

      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Erro ao buscar jogadores:', error);
      showToast('Erro ao carregar jogadores', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!clusterName) {
      showToast('Erro: cluster não identificado', 'error');
      return;
    }

    if (!newPlayerName.trim()) {
      showToast('Por favor, insira o nome do jogador', 'error');
      return;
    }

    if (!newPlayerRating.trim()) {
      showToast('Por favor, insira o rating do jogador', 'error');
      return;
    }

    const rating = parseInt(newPlayerRating);
    if (isNaN(rating)) {
      showToast('Rating deve ser um número', 'error');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('jogadores')
        .insert([
          {
            cluster_id: clusterName,
            nome: newPlayerName.trim(),
            rating: rating,
            numero_vitorias: 0,
            numero_jogos: 0,
            visivel: true
          }
        ]);

      if (error) throw error;

      showToast('Jogador adicionado com sucesso!', 'success');
      setNewPlayerName('');
      setNewPlayerRating('');
      fetchPlayers();
    } catch (error) {
      console.error('Erro ao adicionar jogador:', error);
      showToast('Erro ao adicionar jogador', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlayer = async (nome: string) => {
    Alert.alert(
      'Confirmar exclusão',
      `Tem certeza que deseja excluir o jogador ${nome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const { error } = await supabase
                .from('jogadores')
                .delete()
                .eq('cluster_id', clusterName)
                .eq('nome', nome);

              if (error) throw error;

              showToast('Jogador excluído com sucesso!', 'success');
              fetchPlayers();
            } catch (error) {
              console.error('Erro ao excluir jogador:', error);
              showToast('Erro ao excluir jogador', 'error');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleToggleVisibility = async (nome: string, currentVisibility: boolean) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('jogadores')
        .update({ visivel: !currentVisibility })
        .eq('cluster_id', clusterName)
        .eq('nome', nome);

      if (error) throw error;

      showToast(`Jogador ${!currentVisibility ? 'ativado' : 'desativado'} com sucesso!`, 'success');
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

    const rating = parseInt(playerRating);
    if (isNaN(rating)) {
      showToast('Rating deve ser um número', 'error');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('jogadores')
        .update({
          nome: playerName.trim(),
          rating: rating,
          visivel: true
        })
        .eq('cluster_id', clusterName)
        .eq('nome', editingPlayer?.nome);

      if (error) throw error;

      showToast('Jogador atualizado com sucesso!', 'success');
      setPlayerName('');
      setPlayerRating('');
      setModalVisible(false);
      fetchPlayers();
    } catch (error) {
      console.error('Erro ao atualizar jogador:', error);
      showToast('Erro ao atualizar jogador', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderPlayer = ({ item }: { item: Player }) => (
    <View style={[styles.playerCard, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.playerInfo}>
        <Text style={[styles.playerName, { color: theme.text }]}>{item.nome}</Text>
        <Text style={[styles.playerRating, { color: theme.text }]}>Rating: {item.rating}</Text>
      </View>
      <View style={styles.playerActions}>
        <TouchableOpacity
          onPress={() => handleToggleVisibility(item.nome, item.visivel)}
          style={[styles.actionButton, { backgroundColor: item.visivel ? theme.success : theme.error }]}
        >
          <Text style={styles.actionButtonText}>
            {item.visivel ? t('players.available') : t('players.injured')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={() => handleEdit(item)}
        >
          <Text style={styles.actionButtonText}>{t('common.edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.error }]}
          onPress={() => handleDeletePlayer(item.nome)}
        >
          <Text style={styles.actionButtonText}>{t('common.delete')}</Text>
        </TouchableOpacity>
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
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addButtonText}>{t('players.addPlayer')}</Text>
        </TouchableOpacity>

        <FlatList
          data={players}
          renderItem={renderPlayer}
          keyExtractor={(item) => item.nome}
          contentContainerStyle={styles.listContainer}
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
                  keyboardType="numeric"
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