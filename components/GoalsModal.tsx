import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useTheme } from '../lib/theme';
import { colors } from '../lib/colors';
import { supabase } from '../lib/supabase';
import { Toast } from './Toast';
import { X, ChevronUp, ChevronDown } from 'lucide-react-native';

type PlayerGoals = {
  id_jogador: string;
  nome: string;
  golos: string;
  equipa: string;
};

type GoalsModalProps = {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  clusterId: string;
};

export function GoalsModal({ visible, onClose, gameId, clusterId }: GoalsModalProps) {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const [playerGoals, setPlayerGoals] = useState<PlayerGoals[]>([]);
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

  useEffect(() => {
    if (visible) {
      loadPlayers();
    } else {
      setPlayerGoals([]);
    }
  }, [visible, gameId, clusterId]);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      // Buscar o jogo para identificar os UUIDs dos jogadores das equipas
      const { data: gameData, error: gameError } = await supabase
        .from('resultados_jogos')
        .select('jogadores_equipa_a, jogadores_equipa_b')
        .eq('id_jogo', gameId)
        .eq('cluster_uuid', clusterId)
        .single();

      if (gameError) throw gameError;

      // Buscar os golos existentes COM JOIN para obter nome
      const { data: goalsData, error: goalsError } = await supabase
        .from('golos_por_jogador')
        .select(`
          numero_golos,
          id_jogador,
          jogadores!inner (
            nome
          )
        `)
        .eq('id_jogo', gameId)
        .eq('cluster_uuid', clusterId);

      if (goalsError) throw goalsError;

      // Criar um mapa de golos por id_jogador
      const goalsMap = new Map(
        goalsData?.map(goal => [
          goal.id_jogador,
          // @ts-ignore
          { numero_golos: goal.numero_golos, nome: goal.jogadores?.nome }
        ]) || []
      );

      // jogadores_equipa_a e jogadores_equipa_b agora são arrays de UUIDs
      const jogadoresEquipaA: string[] = gameData.jogadores_equipa_a || [];
      const jogadoresEquipaB: string[] = gameData.jogadores_equipa_b || [];

      // Buscar informações dos jogadores
      const allPlayerIds = [...jogadoresEquipaA, ...jogadoresEquipaB];
      const { data: playersData } = await supabase
        .from('jogadores')
        .select('id_jogador, nome')
        .in('id_jogador', allPlayerIds);

      const playersMap = new Map(
        playersData?.map(p => [p.id_jogador, p.nome]) || []
      );

      // Criar a lista de jogadores com suas respectivas equipas e golos
      const playersList: PlayerGoals[] = [
        ...jogadoresEquipaA.map((id_jogador: string) => {
          const goalInfo = goalsMap.get(id_jogador);
          return {
            id_jogador,
            nome: playersMap.get(id_jogador) || 'Desconhecido',
            equipa: 'A',
            golos: goalInfo?.numero_golos?.toString() || '0'
          };
        }),
        ...jogadoresEquipaB.map((id_jogador: string) => {
          const goalInfo = goalsMap.get(id_jogador);
          return {
            id_jogador,
            nome: playersMap.get(id_jogador) || 'Desconhecido',
            equipa: 'B',
            golos: goalInfo?.numero_golos?.toString() || '0'
          };
        })
      ];

      setPlayerGoals(playersList);
    } catch (error) {
      console.error('Erro ao carregar jogadores:', error);
      showToast('Erro ao carregar jogadores', 'error');
    } finally {
      setLoading(false);
    }
  };

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

  const incrementGoals = (playerId: string) => {
    setPlayerGoals(prev => 
      prev.map(p => {
        if (p.id_jogador === playerId) {
          const currentGoals = parseInt(p.golos) || 0;
          return { ...p, golos: Math.min(currentGoals + 1, 99).toString() };
        }
        return p;
      })
    );
  };

  const decrementGoals = (playerId: string) => {
    setPlayerGoals(prev => 
      prev.map(p => {
        if (p.id_jogador === playerId) {
          const currentGoals = parseInt(p.golos) || 0;
          return { ...p, golos: Math.max(currentGoals - 1, 0).toString() };
        }
        return p;
      })
    );
  };

  const handleSaveGoals = async (player: PlayerGoals) => {
    const numGolos = Number(player.golos);
    
    if (isNaN(numGolos) || numGolos < 0) {
      showToast('Por favor, insira um número válido de golos', 'error');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('golos_por_jogador')
        .upsert(
          {
            cluster_uuid: clusterId,
            id_jogador: player.id_jogador,
            id_jogo: gameId,
            numero_golos: numGolos
          },
          {
            onConflict: 'id_jogo,cluster_uuid,id_jogador'
          }
        );

      if (error) throw error;

      showToast('Golos registados com sucesso', 'success');
      await loadPlayers();
    } catch (error) {
      console.error('Erro ao registrar golos:', error);
      showToast('Erro ao registrar golos', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Registrar Golos</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.playersList}>
            {loading ? (
              <Text style={[styles.loadingText, { color: theme.text }]}>Carregando jogadores...</Text>
            ) : playerGoals.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.text }]}>Nenhum jogador encontrado</Text>
            ) : (
              playerGoals.map((player, index) => (
                <View key={player.id_jogador} style={styles.playerRow}>
                  <View style={styles.playerInfo}>
                    <Text style={[styles.playerName, { color: theme.text }]}>{player.nome}</Text>
                    <Text style={[styles.teamName, { color: theme.secondary }]}>{player.equipa}</Text>
                  </View>
                  <View style={styles.goalsInputContainer}>
                    <View style={styles.inputWithArrows}>
                      <TouchableOpacity
                        style={[styles.arrowButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                        onPress={() => decrementGoals(player.id_jogador)}
                        disabled={loading}
                      >
                        <ChevronDown size={20} color={theme.text} />
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.goalsInput, { 
                          backgroundColor: theme.inputBackground,
                          color: theme.text,
                          borderColor: theme.border
                        }]}
                        value={player.golos}
                        onChangeText={(value) => {
                          if (/^\d*$/.test(value)) {
                            setPlayerGoals(prev => 
                              prev.map(p => p.id_jogador === player.id_jogador ? { ...p, golos: value } : p)
                            );
                          }
                        }}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={theme.placeholderText}
                        maxLength={2}
                      />
                      <TouchableOpacity
                        style={[styles.arrowButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                        onPress={() => incrementGoals(player.id_jogador)}
                        disabled={loading}
                      >
                        <ChevronUp size={20} color={theme.text} />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={[styles.saveButton, { backgroundColor: theme.primary }]}
                      onPress={() => handleSaveGoals(player)}
                      disabled={loading || !player.golos}
                    >
                      <Text style={styles.saveButtonText}>Gravar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <Toast
            visible={toastConfig.visible}
            message={toastConfig.message}
            type={toastConfig.type}
            onHide={hideToast}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 8,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  closeButton: {
    padding: 4,
  },
  playersList: {
    maxHeight: 400,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  teamName: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  goalsInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputWithArrows: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalsInput: {
    width: 50,
    height: 44,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 16,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    marginTop: 20,
  },
});