import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Platform, FlatList } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../../lib/theme';
import { colors } from '../../lib/colors';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { ArrowUpDown } from 'lucide-react-native';
import { useLanguage } from '../../lib/language';

type PlayerStats = {
  nome: string;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golos: number;
};

type SortField = 'jogos' | 'vitorias' | 'empates' | 'derrotas' | 'golos';
type SortOrder = 'asc' | 'desc';

export default function RankingsScreen() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const { clusterName } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('total');
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    field: SortField;
    order: SortOrder;
  }>({
    field: 'vitorias',
    order: 'desc'
  });

  useEffect(() => {
    if (clusterName) {
      loadAvailableYears();
      loadRankings();
    }
  }, [clusterName, selectedYear]);

  const loadAvailableYears = async () => {
    try {
      if (!clusterName) {
        console.warn('loadAvailableYears: clusterName é null');
        return;
      }

      const { data: games, error } = await supabase
        .from('resultados_jogos')
        .select('data')
        .eq('cluster_id', clusterName);

      if (error) throw error;

      // Garantir que temos jogos antes de processar
      if (!games || games.length === 0) {
        setAvailableYears([]);
        return;
      }

      const years = games
        .map(game => {
          const date = new Date(game.data);
          // Verificar se a data é válida
          return isNaN(date.getTime()) ? null : date.getFullYear().toString();
        })
        .filter((year): year is string => 
          year !== null && !isNaN(parseInt(year))
        )
        .filter((year, index, self) => self.indexOf(year) === index)
        .sort((a, b) => b.localeCompare(a));

      setAvailableYears(years);
    } catch (error) {
      console.error('Erro ao carregar anos disponíveis:', error);
    }
  };

  const loadRankings = async () => {
    try {
      if (!clusterName) {
        console.warn('loadRankings: clusterName é null');
        setLoading(false);
        return;
      }

      setLoading(true);

      // Query base para jogos
      let gamesQuery = supabase
        .from('resultados_jogos')
        .select('*')
        .eq('cluster_id', clusterName);

      // Query base para gols com JOIN para pegar a data
      let goalsQuery = supabase
        .from('golos_por_jogador')
        .select(`
          *,
          resultados_jogos!inner (
            data
          )
        `)
        .eq('cluster_id', clusterName);

      // Adicionar filtro por ano se não for "total"
      if (selectedYear !== 'total') {
        const startDate = `${selectedYear}-01-01`;
        const endDate = `${selectedYear}-12-31`;
        console.log('Filtrando por período:', startDate, 'até', endDate); // Debug
        
        gamesQuery = gamesQuery
          .gte('data', startDate)
          .lte('data', endDate);
        
        goalsQuery = goalsQuery
          .gte('resultados_jogos.data', startDate)
          .lte('resultados_jogos.data', endDate);
      }

      // Executar as queries
      const [gamesResult, goalsResult] = await Promise.all([
        gamesQuery,
        goalsQuery
      ]);

      if (gamesResult.error) throw gamesResult.error;
      if (goalsResult.error) throw goalsResult.error;

      console.log('Jogos encontrados:', gamesResult.data?.length); // Debug
      console.log('Gols encontrados:', goalsResult.data?.length); // Debug

      const games = gamesResult.data;
      const goals = goalsResult.data;

      // 3. Processar os dados para criar as estatísticas
      const playerStats = new Map<string, PlayerStats>();

      // Inicializar estatísticas para todos os jogadores que participaram de jogos
      games?.forEach(game => {
        const playersA = game.jogadores_equipa_a.split(', ');
        const playersB = game.jogadores_equipa_b.split(', ');
        [...playersA, ...playersB].forEach(player => {
          if (!playerStats.has(player)) {
            playerStats.set(player, {
              nome: player,
              jogos: 0,
              vitorias: 0,
              empates: 0,
              derrotas: 0,
              golos: 0
            });
          }
          const stats = playerStats.get(player)!;
          stats.jogos++;

          if (game.vencedor) {
            if (game.vencedor === 'E') {
              stats.empates++;
            } else if (
              (game.vencedor === 'A' && playersA.includes(player)) ||
              (game.vencedor === 'B' && playersB.includes(player))
            ) {
              stats.vitorias++;
            } else {
              stats.derrotas++;
            }
          }
        });
      });

      // Adicionar gols aos jogadores
      goals?.forEach(goal => {
        const stats = playerStats.get(goal.nome_jogador);
        if (stats) {
          stats.golos += goal.numero_golos;
        }
      });

      setPlayers(Array.from(playerStats.values()));
    } catch (error) {
      console.error('Erro ao carregar rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc'
    }));
  };

  const sortedPlayers = [...players].sort((a, b) => {
    const multiplier = sortConfig.order === 'desc' ? -1 : 1;
    return (a[sortConfig.field] - b[sortConfig.field]) * multiplier;
  });

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <TouchableOpacity 
      onPress={() => handleSort(field)}
      style={styles.statItem}
    >
      <Text style={[styles.headerText, { color: theme.primary }]}>{label}</Text>
    </TouchableOpacity>
  );

  const getPositionStyle = (position: number) => {
    switch (position) {
      case 0: // 1º lugar
        return {
          backgroundColor: theme.primary,
          color: '#ffffff',
          fontFamily: 'Inter_700Bold',
        };
      default:
        return {
          backgroundColor: theme.cardBackground,
          color: theme.text,
          fontFamily: 'Inter_400Regular',
        };
    }
  };

  const getPositionText = (position: number) => {
    return `${position + 1}º`;
  };

  // Encontrar o jogador com mais gols
  const topScorer = sortedPlayers.reduce((max, player) => 
    player.golos > (max?.golos || 0) ? player : max
  , sortedPlayers[0]);

  const renderPlayer = ({ item }: { item: PlayerStats }) => {
    const positionStyle = getPositionStyle(sortedPlayers.indexOf(item));
    const isTopScorer = item.golos === topScorer.golos && item.golos > 0;
    const isFirstPlace = sortedPlayers.indexOf(item) === 0;

    return (
      <View style={[styles.playerCard, { backgroundColor: theme.secondary }]}>
        <View style={styles.playerRow}>
          <View style={styles.playerPosition}>
            <View style={styles.positionWrapper}>
              <Text 
                style={[styles.positionText, { color: positionStyle.color, fontFamily: positionStyle.fontFamily }]}
                numberOfLines={1}
              >
                {getPositionText(sortedPlayers.indexOf(item))}
              </Text>
              {isFirstPlace ? (
                <Text style={styles.trophyEmoji}>🏆</Text>
              ) : (
                <View style={styles.trophyPlaceholder} />
              )}
            </View>
          </View>
          <View style={styles.nameContainer}>
            <Text style={[styles.playerName, { color: theme.text }]}>
              {item.nome}
            </Text>
            {isTopScorer && (
              <Image
                source={require('../../assets/images/boot.png')}
                style={styles.bootIcon}
              />
            )}
          </View>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: positionStyle.color, fontFamily: positionStyle.fontFamily }]}>
                {item.jogos}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: positionStyle.color, fontFamily: positionStyle.fontFamily }]}>
                {item.vitorias}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: positionStyle.color, fontFamily: positionStyle.fontFamily }]}>
                {item.empates}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: positionStyle.color, fontFamily: positionStyle.fontFamily }]}>
                {item.derrotas}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: positionStyle.color, fontFamily: positionStyle.fontFamily }]}>
                {item.golos}
              </Text>
            </View>
          </View>
        </View>
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
        <Text style={[styles.title, { color: theme.text }]}>{t('rankings.title')}</Text>

        <View style={[styles.pickerContainer, { backgroundColor: theme.cardBackground }]}>
          <Picker
            selectedValue={selectedYear}
            onValueChange={(itemValue) => setSelectedYear(itemValue)}
            style={[styles.picker, { color: theme.text }]}
          >
            <Picker.Item label={t('rankings.total')} value="total" />
            {availableYears.map(year => (
              <Picker.Item key={year} label={year} value={year} />
            ))}
          </Picker>
        </View>

        <View style={styles.listContainer}>
          <View style={[styles.headerContainer, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.headerRow}>
              <View style={styles.positionContainer}>
                <View style={styles.positionWrapper}>
                  <Text style={[styles.headerText, { color: theme.text }]}>#</Text>
                  <View style={styles.trophyPlaceholder} />
                </View>
              </View>
              <View style={styles.nameContainer}>
                <Text style={[styles.headerText, { color: theme.text }]}>{t('rankings.player')}</Text>
              </View>
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={[styles.headerText, { color: theme.text }]}>{t('rankings.games')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.headerText, { color: theme.text }]}>{t('rankings.wins')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.headerText, { color: theme.text }]}>{t('rankings.draws')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.headerText, { color: theme.text }]}>{t('rankings.losses')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.headerText, { color: theme.text }]}>{t('rankings.goalsScored')}</Text>
                </View>
              </View>
            </View>
          </View>

          <FlatList
            data={sortedPlayers}
            renderItem={renderPlayer}
            keyExtractor={(item) => item.nome}
            contentContainerStyle={styles.listContent}
            refreshing={loading}
            onRefresh={loadRankings}
          />
        </View>
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
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  picker: {
    height: 52,
    width: '100%',
    ...Platform.select({
      ios: {
        backgroundColor: 'transparent',
      },
      android: {
        backgroundColor: 'transparent',
      },
    }),
  },
  headerContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  positionContainer: {
    width: 50,
    alignItems: 'center',
  },
  nameContainer: {
    flex: 1.5,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsContainer: {
    flex: 3.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 50,
    minWidth: 35,
  },
  headerText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  playerCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    width: '100%',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  playerPosition: {
    width: 50,
    alignItems: 'center',
  },
  positionWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  playerName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  statValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    maxWidth: 50,
    minWidth: 35,
  },
  trophyEmoji: {
    fontSize: 16,
    marginLeft: 4,
  },
  trophyPlaceholder: {
    width: 16,
    marginLeft: 4,
  },
  bootIcon: {
    width: 14,
    height: 14,
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    paddingBottom: 16,
  },
});