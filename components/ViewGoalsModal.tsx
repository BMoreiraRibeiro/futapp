import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../lib/theme';
import { colors } from '../lib/colors';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react-native';
import { useLanguage } from '../lib/language';

type PlayerGoals = {
  nome: string;
  golos: number;
  equipa: string;
};

type ViewGoalsModalProps = {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  clusterId: string;
};

export function ViewGoalsModal({ visible, onClose, gameId, clusterId }: ViewGoalsModalProps) {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const { t } = useLanguage();
  const [playerGoals, setPlayerGoals] = useState<PlayerGoals[]>([]);
  const [loading, setLoading] = useState(false);

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
      // Buscar o jogo para identificar os jogadores das equipas
      const { data: gameData, error: gameError } = await supabase
        .from('resultados_jogos')
        .select('jogadores_equipa_a, jogadores_equipa_b')
        .eq('id_jogo', gameId)
        .eq('cluster_id', clusterId)
        .single();

      if (gameError) throw gameError;

      // Buscar os golos existentes
      const { data: goalsData, error: goalsError } = await supabase
        .from('golos_por_jogador')
        .select('nome_jogador, numero_golos')
        .eq('id_jogo', gameId)
        .eq('cluster_id', clusterId);

      if (goalsError) throw goalsError;

      // Criar um mapa de golos por jogador
      const goalsMap = new Map(
        goalsData?.map(goal => [goal.nome_jogador, goal.numero_golos]) || []
      );

      // Converter as strings de jogadores em arrays
      const jogadoresEquipaA = gameData.jogadores_equipa_a.split(', ');
      const jogadoresEquipaB = gameData.jogadores_equipa_b.split(', ');

      // Criar a lista de jogadores com suas respectivas equipas e golos
      const playersList = [
        ...jogadoresEquipaA.map((nome: string) => ({ 
          nome, 
          equipa: 'A', 
          golos: goalsMap.get(nome) || 0 
        })),
        ...jogadoresEquipaB.map((nome: string) => ({ 
          nome, 
          equipa: 'B', 
          golos: goalsMap.get(nome) || 0 
        }))
      ];

      setPlayerGoals(playersList);
    } catch (error) {
      console.error('Erro ao carregar jogadores:', error);
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
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t('results.viewGoals')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.playersList}>
            {loading ? (
              <Text style={[styles.loadingText, { color: theme.text }]}>{t('common.loading')}</Text>
            ) : playerGoals.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.text }]}>{t('results.noGoals')}</Text>
            ) : (
              <>
                <View style={[styles.teamSection, { backgroundColor: isDarkMode ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 0, 0, 0.05)' }]}>
                  <Text style={[styles.teamTitle, { color: theme.text }]}>{t('index.teamA')}</Text>
                  {playerGoals
                    .filter(player => player.equipa === 'A')
                    .map((player, index) => (
                      <View key={index} style={[styles.playerRow, { borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                        <Text style={[styles.playerName, { color: theme.text }]}>{player.nome}</Text>
                        <View style={[styles.goalsContainer, { backgroundColor: player.golos > 0 ? theme.primary : 'transparent' }]}>
                          <Text style={[styles.goalsText, { color: player.golos > 0 ? theme.text : theme.text }]}>
                            {player.golos}
                          </Text>
                        </View>
                      </View>
                    ))}
                </View>
                
                <View style={[styles.teamSection, { backgroundColor: isDarkMode ? 'rgba(0, 0, 255, 0.1)' : 'rgba(0, 0, 255, 0.05)' }]}>
                  <Text style={[styles.teamTitle, { color: theme.text }]}>{t('index.teamB')}</Text>
                  {playerGoals
                    .filter(player => player.equipa === 'B')
                    .map((player, index) => (
                      <View key={index} style={[styles.playerRow, { borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                        <Text style={[styles.playerName, { color: theme.text }]}>{player.nome}</Text>
                        <View style={[styles.goalsContainer, { backgroundColor: player.golos > 0 ? theme.primary : 'transparent' }]}>
                          <Text style={[styles.goalsText, { color: player.golos > 0 ? theme.text : theme.text }]}>
                            {player.golos}
                          </Text>
                        </View>
                      </View>
                    ))}
                </View>
              </>
            )}
          </ScrollView>
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
  teamSection: {
    marginBottom: 16,
    borderRadius: 8,
    padding: 12,
  },
  teamTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  playerName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
    marginRight: 16,
  },
  goalsContainer: {
    minWidth: 30,
    height: 45,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  goalsText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
}); 