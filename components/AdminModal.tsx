import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useTheme } from '../lib/theme';
import { colors } from '../lib/colors';
import { supabase } from '../lib/supabase';
import { X, Shield } from 'lucide-react-native';

interface AdminModalProps {
  visible: boolean;
  onClose: () => void;
  currentClusterId: string;
  onAdminChanged: () => void;
}

interface Player {
  nome: string;
  user_id: string;
  admin: boolean;
}

export function AdminModal({ visible, onClose, currentClusterId, onAdminChanged }: AdminModalProps) {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]); // Array de nomes selecionados

  useEffect(() => {
    if (visible && currentClusterId) {
      loadPlayers();
      setSelectedPlayers([]); // Reset selection when modal opens
    }
  }, [visible, currentClusterId]);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      setPlayers([]); // Limpar primeiro
      console.log('📋 AdminModal: Carregando jogadores do cluster:', currentClusterId);
      
      // Buscar TODOS os membros do cluster que têm user_id
      const { data, error } = await supabase
        .from('cluster_members')
        .select('nome, user_id, admin')
        .eq('cluster_uuid', currentClusterId)
        .not('user_id', 'is', null)
        .not('nome', 'is', null)
        .order('nome');

      if (error) {
        console.error('❌ AdminModal: Erro ao carregar jogadores:', error);
        console.error('❌ AdminModal: Detalhes do erro:', JSON.stringify(error, null, 2));
        setPlayers([]); // Define vazio em caso de erro
        setLoading(false);
        return;
      }
      
      console.log('📊 AdminModal: Dados retornados:', JSON.stringify(data, null, 2));
      console.log('✅ AdminModal: Total de registros encontrados:', data?.length || 0);
      
      if (data && data.length > 0) {
        console.log('👥 AdminModal: Jogadores encontrados:');
        data.forEach((player, index) => {
          console.log(`  ${index + 1}. Nome: ${player.nome}, User ID: ${player.user_id}, Admin: ${player.admin}`);
        });
        
        setPlayers(data);
        setLoading(false);
        console.log('✅ AdminModal: State players atualizado com', data.length, 'jogadores');
      } else {
        console.warn('⚠️ AdminModal: Nenhum jogador encontrado no cluster:', currentClusterId);
        setPlayers([]);
        setLoading(false);
      }
    } catch (error) {
      console.error('💥 AdminModal: Erro ao carregar jogadores:', error);
      setPlayers([]); // Define vazio em caso de erro
      setLoading(false);
    }
  };

  const handleAddAdmins = async () => {
    if (selectedPlayers.length === 0) return;
    
    try {
      console.log('➕ AdminModal: Adicionando admins:', selectedPlayers);

      // Define os jogadores selecionados como admin
      const { error } = await supabase
        .from('cluster_members')
        .update({ admin: true })
        .eq('cluster_uuid', currentClusterId)
        .in('nome', selectedPlayers);

      if (error) {
        console.error('❌ AdminModal: Erro ao adicionar admins:', error);
        throw error;
      }

      console.log('✅ AdminModal: Admins adicionados com sucesso');
      setSelectedPlayers([]);
      onAdminChanged();
      loadPlayers(); // Recarregar lista
    } catch (error) {
      console.error('💥 AdminModal: Erro ao adicionar admins:', error);
    }
  };

  const handleRemoveAdmins = async () => {
    if (selectedPlayers.length === 0) return;
    
    try {
      console.log('➖ AdminModal: Removendo admins:', selectedPlayers);

      // Remove admin dos jogadores selecionados
      const { error } = await supabase
        .from('cluster_members')
        .update({ admin: false })
        .eq('cluster_uuid', currentClusterId)
        .in('nome', selectedPlayers);

      if (error) {
        console.error('❌ AdminModal: Erro ao remover admins:', error);
        throw error;
      }

      console.log('✅ AdminModal: Admins removidos com sucesso');
      setSelectedPlayers([]);
      onAdminChanged();
      loadPlayers(); // Recarregar lista
    } catch (error) {
      console.error('💥 AdminModal: Erro ao remover admins:', error);
    }
  };

  const togglePlayerSelection = (playerName: string) => {
    setSelectedPlayers(prev => {
      if (prev.includes(playerName)) {
        return prev.filter(name => name !== playerName);
      } else {
        return [...prev, playerName];
      }
    });
  };

  const renderPlayer = ({ item }: { item: Player }) => {
    const isSelected = selectedPlayers.includes(item.nome);

    return (
      <TouchableOpacity
        style={[
          styles.playerItem,
          { 
            backgroundColor: isSelected 
              ? theme.primary + '30' 
              : item.admin 
                ? theme.primary + '20' 
                : theme.cardBackground,
            borderColor: isSelected 
              ? theme.primary 
              : item.admin 
                ? theme.primary + '80' 
                : theme.border,
            borderWidth: isSelected ? 2 : 1
          }
        ]}
        onPress={() => togglePlayerSelection(item.nome)}
        disabled={loading}
      >
        <View style={styles.playerInfo}>
          {item.admin && <Shield size={20} color={theme.primary} style={styles.adminIcon} />}
          <Text style={[styles.playerName, { color: theme.text }]}>{item.nome}</Text>
        </View>
        {item.admin && (
          <Text style={[styles.adminBadge, { color: theme.primary }]}>Admin</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Gerir Admins</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: theme.placeholderText }]}>
            Selecione jogadores para adicionar ou remover como administradores
          </Text>

          {selectedPlayers.length > 0 && (
            <Text style={[styles.selectedCount, { color: theme.primary }]}>
              {selectedPlayers.length} selecionado{selectedPlayers.length > 1 ? 's' : ''}
            </Text>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.emptyText, { color: theme.text }]}>Carregando...</Text>
            </View>
          ) : players.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.placeholderText }]}>
                Nenhum jogador encontrado no clube
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.placeholderText }]}>
                Cluster ID: {currentClusterId}
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                data={players}
                renderItem={renderPlayer}
                keyExtractor={(item) => item.nome}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                extraData={selectedPlayers}
              />
              
              <View style={styles.buttonsContainer}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { 
                      backgroundColor: selectedPlayers.length > 0 ? theme.primary : theme.border,
                      opacity: selectedPlayers.length > 0 ? 1 : 0.5,
                      flex: 1,
                      marginRight: 8
                    }
                  ]}
                  onPress={handleAddAdmins}
                  disabled={selectedPlayers.length === 0}
                >
                  <Text style={styles.actionButtonText}>
                    ➕ Adicionar Admin{selectedPlayers.length > 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { 
                      backgroundColor: selectedPlayers.length > 0 ? '#FF4444' : theme.border,
                      opacity: selectedPlayers.length > 0 ? 1 : 0.5,
                      flex: 1
                    }
                  ]}
                  onPress={handleRemoveAdmins}
                  disabled={selectedPlayers.length === 0}
                >
                  <Text style={styles.actionButtonText}>
                    ➖ Remover Admin{selectedPlayers.length > 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    height: '80%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminIcon: {
    marginRight: 8,
  },
  playerName: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  adminBadge: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  selectedCount: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  buttonsContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
