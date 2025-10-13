import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useTheme } from '../lib/theme';
import { colors } from '../lib/colors';
import { supabase } from '../lib/supabase';
import { Toast } from './Toast';
import { X, ChevronUp, ChevronDown } from 'lucide-react-native';

type PlayerGoals = {
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

type PlayerRowProps = {
  player: PlayerGoals;
  theme: any;
  loading: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onChangeText: (value: string) => void;
  onSave: () => void;
};

function PlayerRow({ player, theme, loading, onIncrement, onDecrement, onChangeText, onSave }: PlayerRowProps) {
  return (
    <View style={styles.playerRow}>
      <View style={styles.playerInfo}>
        <Text style={[styles.playerName, { color: theme.text }]}>{player.nome}</Text>
      </View>
      <View style={styles.goalsInputContainer}>
        <View style={styles.inputWithArrows}>
          <TouchableOpacity
            style={[styles.arrowButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
            onPress={onDecrement}
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
            onChangeText={onChangeText}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={theme.placeholderText}
            maxLength={2}
          />
          <TouchableOpacity
            style={[styles.arrowButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
            onPress={onIncrement}
            disabled={loading}
          >
            <ChevronUp size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.primary }]}
          onPress={onSave}
          disabled={loading || !player.golos}
        >
          <Text style={styles.saveButtonText}>Gravar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function GoalsModal({ visible, onClose, gameId, clusterId }: GoalsModalProps) {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const [equipaAPlayers, setEquipaAPlayers] = useState<PlayerGoals[]>([]);
  const [equipaBPlayers, setEquipaBPlayers] = useState<PlayerGoals[]>([]);
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
      setEquipaAPlayers([]);
      setEquipaBPlayers([]);
    }
  }, [visible, gameId, clusterId]);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      // Buscar o jogo para identificar os jogadores das equipas
      const { data: gameData, error: gameError } = await supabase
        .from('resultados_jogos')
        .select('jogadores_equipa_a, jogadores_equipa_b')
        .eq('id_jogo', gameId)
        .eq('cluster_uuid', clusterId)
        .single();

      if (gameError) throw gameError;

      // Buscar os golos existentes
      const { data: goalsData, error: goalsError } = await supabase
        .from('golos_por_jogador')
        .select('nome_jogador, numero_golos')
        .eq('id_jogo', gameId)
        .eq('cluster_uuid', clusterId);

      if (goalsError) throw goalsError;

      // Criar um mapa de golos por jogador
      const goalsMap = new Map(
        goalsData?.map(goal => [goal.nome_jogador, goal.numero_golos]) || []
      );

      // Converter as strings de jogadores em arrays
      const jogadoresEquipaA = gameData.jogadores_equipa_a.split(', ');
      const jogadoresEquipaB = gameData.jogadores_equipa_b.split(', ');

      // Criar as listas separadas por equipa
      const playersA = jogadoresEquipaA.map((nome: string) => ({ 
        nome, 
        equipa: 'A', 
        golos: goalsMap.get(nome)?.toString() || '0' 
      }));

      const playersB = jogadoresEquipaB.map((nome: string) => ({ 
        nome, 
        equipa: 'B', 
        golos: goalsMap.get(nome)?.toString() || '0' 
      }));

      setEquipaAPlayers(playersA);
      setEquipaBPlayers(playersB);
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

  const incrementGoals = (playerName: string, equipa: string) => {
    const setter = equipa === 'A' ? setEquipaAPlayers : setEquipaBPlayers;
    setter(prev => 
      prev.map(p => {
        if (p.nome === playerName) {
          const currentGoals = parseInt(p.golos) || 0;
          return { ...p, golos: Math.min(currentGoals + 1, 99).toString() };
        }
        return p;
      })
    );
  };

  const decrementGoals = (playerName: string, equipa: string) => {
    const setter = equipa === 'A' ? setEquipaAPlayers : setEquipaBPlayers;
    setter(prev => 
      prev.map(p => {
        if (p.nome === playerName) {
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
            nome_jogador: player.nome,
            id_jogo: gameId,
            numero_golos: numGolos
          },
          {
            onConflict: 'id_jogo,cluster_uuid,nome_jogador'
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
            ) : equipaAPlayers.length === 0 && equipaBPlayers.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.text }]}>Nenhum jogador encontrado</Text>
            ) : (
              <>
                {/* Equipa A */}
                {equipaAPlayers.length > 0 && (
                  <View style={styles.teamSection}>
                    <Text style={[styles.teamHeader, { color: theme.text }]}>Equipa A</Text>
                    {equipaAPlayers.map((player, index) => (
                      <PlayerRow 
                        key={`A-${index}`}
                        player={player}
                        theme={theme}
                        loading={loading}
                        onIncrement={() => incrementGoals(player.nome, 'A')}
                        onDecrement={() => decrementGoals(player.nome, 'A')}
                        onChangeText={(value) => {
                          if (/^\d*$/.test(value)) {
                            setEquipaAPlayers(prev => 
                              prev.map(p => p.nome === player.nome ? { ...p, golos: value } : p)
                            );
                          }
                        }}
                        onSave={() => handleSaveGoals(player)}
                      />
                    ))}
                  </View>
                )}

                {/* Equipa B */}
                {equipaBPlayers.length > 0 && (
                  <View style={styles.teamSection}>
                    <Text style={[styles.teamHeader, { color: theme.text }]}>Equipa B</Text>
                    {equipaBPlayers.map((player, index) => (
                      <PlayerRow 
                        key={`B-${index}`}
                        player={player}
                        theme={theme}
                        loading={loading}
                        onIncrement={() => incrementGoals(player.nome, 'B')}
                        onDecrement={() => decrementGoals(player.nome, 'B')}
                        onChangeText={(value) => {
                          if (/^\d*$/.test(value)) {
                            setEquipaBPlayers(prev => 
                              prev.map(p => p.nome === player.nome ? { ...p, golos: value } : p)
                            );
                          }
                        }}
                        onSave={() => handleSaveGoals(player)}
                      />
                    ))}
                  </View>
                )}
              </>
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
  teamSection: {
    marginBottom: 24,
  },
  teamHeader: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#3498db',
  },
});