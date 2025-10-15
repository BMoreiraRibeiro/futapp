import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '../../lib/theme';
import { colors } from '../../lib/colors';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Toast } from '../../components/Toast';
import { Trash2, Trophy, CircleDot, Eye } from 'lucide-react-native';
import { GoalsModal } from '../../components/GoalsModal';
import { ViewGoalsModal } from '../../components/ViewGoalsModal';
import { useResults } from '../../lib/results';
import { Picker } from '@react-native-picker/picker';
import { useLanguage } from '../../lib/language';
import AsyncStorage from '@react-native-async-storage/async-storage';

type GameResult = {
  id_jogo: string;
  data: string;
  vencedor: 'A' | 'B' | 'E' | null;
  jogadores_equipa_a: string[]; // Array de UUIDs convertido para nomes
  jogadores_equipa_b: string[]; // Array de UUIDs convertido para nomes
};

export default function ResultsScreen() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const { clusterName, isAdmin } = useAuth();
  const { results, fetchResults, loading } = useResults();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [goalsModalVisible, setGoalsModalVisible] = useState(false);
  const [viewGoalsModalVisible, setViewGoalsModalVisible] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameResult | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('total');
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [teamAName, setTeamAName] = useState('Equipa A');
  const [teamBName, setTeamBName] = useState('Equipa B');
  const [toastConfig, setToastConfig] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'info'
  });
  const { t } = useLanguage();

  useEffect(() => {
    if (clusterName) {
      fetchResults(clusterName);
      loadAvailableYears();
      loadTeamNames();
    }
  }, [clusterName]);

  const loadTeamNames = async () => {
    try {
      const nameA = await AsyncStorage.getItem('@team_a_name');
      const nameB = await AsyncStorage.getItem('@team_b_name');
      
      if (nameA) setTeamAName(nameA);
      if (nameB) setTeamBName(nameB);
    } catch (error) {
      console.error('Erro ao carregar nomes das equipas:', error);
    }
  };

  const loadAvailableYears = async () => {
    try {
      if (!clusterName) return;
      
      const { data: games, error } = await supabase
        .from('resultados_jogos')
        .select('data')
        .eq('cluster_uuid', clusterName);

      if (error) throw error;

      const years = games
        ?.map(game => {
          const date = new Date(game.data);
          // Validar se a data é válida
          return isNaN(date.getTime()) ? null : date.getFullYear().toString();
        })
        .filter((year): year is string => year !== null)
        .filter((year, index, self) => self.indexOf(year) === index)
        .sort((a, b) => parseInt(b) - parseInt(a)) || [];

      setAvailableYears(years);
    } catch (error) {
      console.error('Erro ao carregar anos:', error);
    }
  };

  const filteredResults = results.filter(result => {
    if (selectedYear === 'total') return true;
    return new Date(result.data).getFullYear().toString() === selectedYear;
  });

  const handleRefresh = async () => {
    if (clusterName) {
      await fetchResults(clusterName);
      await loadAvailableYears();
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

  const deleteGame = async (id_jogo: string) => {
    if (!clusterName) {
      showToast('Erro: cluster não identificado', 'error');
      return;
    }

    try {
      setDeletingId(id_jogo);
      
      const { error } = await supabase
        .from('resultados_jogos')
        .delete()
        .match({ 
          cluster_uuid: clusterName,
          id_jogo: id_jogo 
        });

      if (error) throw error;

      showToast('Jogo eliminado com sucesso', 'success');
      await fetchResults(clusterName);
    } catch (error) {
      console.error('Erro ao eliminar jogo:', error);
      showToast('Erro ao eliminar jogo', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const setWinner = async (id_jogo: string, winner: 'A' | 'B' | 'E') => {
    if (!clusterName) {
      showToast('Erro: cluster não identificado', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('resultados_jogos')
        .update({ vencedor: winner })
        .eq('cluster_uuid', clusterName)
        .eq('id_jogo', id_jogo);

      if (error) throw error;
      showToast('Vencedor definido com sucesso', 'success');
      fetchResults(clusterName);
    } catch (error) {
      console.error('Erro ao definir vencedor:', error);
      showToast('Erro ao definir vencedor', 'error');
    }
  };

  const handleGoalsPress = (game: GameResult) => {
    setSelectedGame(game);
    setGoalsModalVisible(true);
  };

  const handleViewGoalsPress = (game: GameResult) => {
    setSelectedGame(game);
    setViewGoalsModalVisible(true);
  };

  const renderGame = ({ item }: { item: GameResult }) => {
    const isRecentGame = results
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      .slice(0, 2)
      .some(recentGame => recentGame.id_jogo === item.id_jogo);

    return (
      <View key={item.id_jogo} style={[
        styles.gameCard, 
        { 
          backgroundColor: theme.cardBackground,
          opacity: deletingId === item.id_jogo ? 0.5 : 1
        }
      ]}>
        {item.vencedor ? (
          <View style={styles.finishedGame}>
            <View style={styles.gameHeader}>
              <Text style={[styles.gameDate, { color: theme.text }]}>
                {new Date(item.data).toLocaleDateString('pt-PT')}
              </Text>
              <View style={[styles.winnerButton, { backgroundColor: theme.secondary }]}>
                <Trophy size={16} color="#FFD700" />
                <Text style={[styles.winnerButtonText, { marginLeft: 6 }]}>
                  {item.vencedor === 'E' ? t('results.draw') : (item.vencedor === 'A' ? teamAName : teamBName)}
                </Text>
              </View>
            </View>
            <View style={styles.teamSection}>
              <Text style={[styles.teamPlayers, { color: theme.text }]}>
                {item.vencedor === 'E' ? (
                  <>
                    <Text style={[styles.teamPlayers, { color: theme.text }]}>
                      {t('index.teamA')}: {item.jogadores_equipa_a.join(', ')}
                    </Text>
                    <Text style={[styles.teamPlayers, { color: theme.text }]}>
                      {t('index.teamB')}: {item.jogadores_equipa_b.join(', ')}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.teamPlayers, { color: theme.text }]}>
                    {item.vencedor === 'A' ? item.jogadores_equipa_a.join(', ') : item.jogadores_equipa_b.join(', ')}
                  </Text>
                )}
              </Text>
            </View>
            <View style={styles.gameActions}>
              {isRecentGame ? (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.primary }]}
                  onPress={() => handleGoalsPress(item)}
                >
                  <CircleDot size={16} color="#ffffff" />
                  <Text style={styles.actionButtonText}>
                    {t('results.goalsButton')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]}
                  onPress={() => handleViewGoalsPress(item)}
                >
                  <Eye size={16} color={theme.text} />
                  <Text style={[styles.actionButtonText, { color: theme.text }]}>
                    {t('results.viewGoals')}
                  </Text>
                </TouchableOpacity>
              )}
              {isRecentGame && isAdmin && (
                <TouchableOpacity
                  style={[
                    styles.actionButton, 
                    { 
                      backgroundColor: theme.error,
                      opacity: deletingId === item.id_jogo ? 0.5 : 1
                    }
                  ]}
                  onPress={() => deleteGame(item.id_jogo)}
                  disabled={deletingId === item.id_jogo}
                >
                  <Trash2 size={16} color="#ffffff" />
                  <Text style={styles.actionButtonText}>
                    {deletingId === item.id_jogo ? t('results.deleting') : t('results.delete')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.teamsContainer}>
              <View style={styles.teamSection}>
                <Text style={[styles.teamTitle, { color: theme.text }]}>{t('index.teamA')}</Text>
                {item.jogadores_equipa_a.map((player, index) => (
                  <Text key={index} style={[styles.teamPlayers, { color: theme.text }]}>
                    {player}
                  </Text>
                ))}
              </View>

              <View style={styles.teamSection}>
                <Text style={[styles.teamTitle, { color: theme.text }]}>{t('index.teamB')}</Text>
                {item.jogadores_equipa_b.map((player, index) => (
                  <Text key={index} style={[styles.teamPlayers, { color: theme.text }]}>
                    {player}
                  </Text>
                ))}
              </View>
            </View>

            <View style={styles.winnerButtonsContainer}>
              <TouchableOpacity
                style={[styles.teamWinnerButton, { backgroundColor: '#4CAF50' }]}
                onPress={() => setWinner(item.id_jogo, 'A')}
              >
                <Text style={styles.teamWinnerButtonText}>{t('results.teamAWins')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.teamWinnerButton, { backgroundColor: '#FFC107' }]}
                onPress={() => setWinner(item.id_jogo, 'E')}
              >
                <Text style={styles.teamWinnerButtonText}>{t('results.draw')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.teamWinnerButton, { backgroundColor: '#2196F3' }]}
                onPress={() => setWinner(item.id_jogo, 'B')}
              >
                <Text style={styles.teamWinnerButtonText}>{t('results.teamBWins')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.gameActions}>
              {isRecentGame ? (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.primary }]}
                  onPress={() => handleGoalsPress(item)}
                >
                  <CircleDot size={16} color="#ffffff" />
                  <Text style={styles.actionButtonText}>
                    {t('results.goalsButton')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]}
                  onPress={() => handleViewGoalsPress(item)}
                >
                  <Eye size={16} color={theme.text} />
                  <Text style={[styles.actionButtonText, { color: theme.text }]}>
                    {t('results.viewGoals')}
                  </Text>
                </TouchableOpacity>
              )}
              {isRecentGame && isAdmin && (
                <TouchableOpacity
                  style={[
                    styles.actionButton, 
                    { 
                      backgroundColor: theme.error,
                      opacity: deletingId === item.id_jogo ? 0.5 : 1
                    }
                  ]}
                  onPress={() => deleteGame(item.id_jogo)}
                  disabled={deletingId === item.id_jogo}
                >
                  <Trash2 size={16} color="#ffffff" />
                  <Text style={styles.actionButtonText}>
                    {deletingId === item.id_jogo ? t('results.deleting') : t('results.delete')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Image 
        source={require('../../assets/images/background3.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <View style={styles.contentContainer}>
        <Text style={[styles.title, { color: theme.text }]}>{t('results.title')}</Text>
        
        <View style={[styles.pickerContainer, { 
          backgroundColor: isDarkMode ? '#1a3a52' : '#e3f2fd',
          borderColor: isDarkMode ? '#2d5f8d' : '#90caf9'
        }]}>
          <Picker
            selectedValue={selectedYear}
            onValueChange={(itemValue) => setSelectedYear(itemValue)}
            style={[styles.picker, { color: theme.text }]}
          >
            <Picker.Item label={t('results.total')} value="total" />
            {availableYears.map(year => (
              <Picker.Item key={year} label={year} value={year} />
            ))}
          </Picker>
        </View>

        <FlatList
          data={filteredResults}
          renderItem={renderGame}
          keyExtractor={(item) => item.id_jogo}
          contentContainerStyle={styles.listContainer}
          refreshing={loading}
          onRefresh={handleRefresh}
        />

        {toastConfig.visible && (
          <Toast
            visible={toastConfig.visible}
            message={toastConfig.message}
            type={toastConfig.type}
            onHide={hideToast}
          />
        )}

        {selectedGame && clusterName && (
          <>
            <GoalsModal
              visible={goalsModalVisible}
              onClose={() => {
                setGoalsModalVisible(false);
                setSelectedGame(null);
              }}
              gameId={selectedGame.id_jogo}
              clusterId={clusterName}
            />
            
            <ViewGoalsModal
              visible={viewGoalsModalVisible}
              onClose={() => {
                setViewGoalsModalVisible(false);
                setSelectedGame(null);
              }}
              gameId={selectedGame.id_jogo}
              clusterId={clusterName}
            />
          </>
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
  pickerContainer: {
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  picker: {
    height: 52,
    width: '100%',
  },
  listContainer: {
    gap: 16,
  },
  gameCard: {
    padding: 16,
    borderRadius: 8,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  gameDate: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  deleteButton: {
    padding: 8,
  },
  teamsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  teamSection: {
    flex: 1,
  },
  teamTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
  },
  teamPlayers: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
  winnerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    gap: 4,
    minWidth: 80,
  },
  winnerButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  winnerContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  winnerText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  gameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 4,
    gap: 4,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  finishedGame: {
    width: '100%',
  },
  drawButtonContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  drawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 4,
    width: '50%',
  },
  drawButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  winnerButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  teamWinnerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  teamWinnerButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});