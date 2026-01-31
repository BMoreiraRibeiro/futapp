import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, FlatList, RefreshControl } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../../lib/theme';
import { colors } from '../../lib/colors';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useQuery } from '@tanstack/react-query';

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

  // Query com cache para rankings
  const { data: rankingsData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['rankings', clusterName, selectedYear],
    queryFn: async () => {
      if (!clusterName) {
        console.warn('loadRankings: clusterName é null');
        return [];
      }

      // Query base para jogos
      let gamesQuery = supabase
        .from('resultados_jogos')
        .select('*')
        .eq('cluster_uuid', clusterName);

      // Query base para gols com JOIN para pegar a data E o nome do jogador
      let goalsQuery = supabase
        .from('golos_por_jogador')
        .select(`
          numero_golos,
          id_jogador,
          jogadores!inner (
            nome
          ),
          resultados_jogos!inner (
            data
          )
        `)
        .eq('cluster_uuid', clusterName);

      // Adicionar filtro por ano se não for "total"
      if (selectedYear !== 'total') {
        const startDate = `${selectedYear}-01-01`;
        const endDate = `${selectedYear}-12-31`;
        
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

      const games = gamesResult.data;
      const goals = goalsResult.data;

      // Processar os dados para criar as estatísticas
      const playerStats = new Map<string, PlayerStats>();

      // Primeiro, buscar todos os jogadores para ter o mapeamento id -> nome
      const { data: allPlayers } = await supabase
        .from('jogadores')
        .select('id_jogador, nome')
        .eq('cluster_uuid', clusterName);

      const playerMap = new Map(allPlayers?.map(p => [p.id_jogador, p.nome]) || []);

      // Processar jogos
      games?.forEach(game => {
        const teamAPlayers = game.jogadores_equipa_a || [];
        const teamBPlayers = game.jogadores_equipa_b || [];
        
        [...teamAPlayers, ...teamBPlayers].forEach(playerId => {
          const playerName = playerMap.get(playerId);
          if (!playerName) return;

          if (!playerStats.has(playerName)) {
            playerStats.set(playerName, {
              nome: playerName,
              jogos: 0,
              vitorias: 0,
              empates: 0,
              derrotas: 0,
              golos: 0
            });
          }

          const stats = playerStats.get(playerName)!;
          stats.jogos++;

          const isTeamA = teamAPlayers.includes(playerId);
          
          if (game.vencedor === 'Empate') {
            stats.empates++;
          } else if (
            (isTeamA && game.vencedor === 'A') ||
            (!isTeamA && game.vencedor === 'B')
          ) {
            stats.vitorias++;
          } else {
            stats.derrotas++;
          }
        });
      });

      // Processar golos
      goals?.forEach(goal => {
        const playerName = (goal.jogadores as any)?.nome;
        if (!playerName) return;

        if (!playerStats.has(playerName)) {
          playerStats.set(playerName, {
            nome: playerName,
            jogos: 0,
            vitorias: 0,
            empates: 0,
            derrotas: 0,
            golos: 0
          });
        }

        const stats = playerStats.get(playerName)!;
        stats.golos += goal.numero_golos || 0;
      });

      return Array.from(playerStats.values());
    },
    enabled: !!clusterName,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  // Atualizar players quando dados chegam
  useEffect(() => {
    if (rankingsData) {
      setPlayers(rankingsData);
    }
  }, [rankingsData]);

  useEffect(() => {
    if (clusterName) {
      loadAvailableYears();
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
        .eq('cluster_uuid', clusterName);

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

  const getSortedPlayers = () => {
    return [...players].sort((a, b) => {
      const multiplier = sortConfig.order === 'desc' ? -1 : 1;
      return (a[sortConfig.field] - b[sortConfig.field]) * multiplier;
    });
  };

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc'
    }));
  };

  const sortedPlayers = getSortedPlayers();

  const SortButton = ({ field, label }: { field: SortField; label: string }) => {
    const isActive = sortConfig.field === field;
    const isDesc = sortConfig.order === 'desc';
    
    return (
      <TouchableOpacity 
        onPress={() => handleSort(field)}
        style={styles.statItem}
      >
        <View style={styles.sortButtonContent}>
          <Text style={[
            styles.headerText, 
            { color: isActive ? theme.primary : theme.text }
          ]}>
            {label}
          </Text>
          {isActive && (
            <Text style={[styles.sortArrow, { color: theme.primary }]}>
              {isDesc ? '↓' : '↑'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

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

        <View style={[styles.pickerContainer, { 
          backgroundColor: isDarkMode ? '#1a3a52' : '#e3f2fd',
          borderColor: isDarkMode ? '#2d5f8d' : '#90caf9'
        }]}>
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
                <SortButton field="jogos" label={t('rankings.games')} />
                <SortButton field="vitorias" label={t('rankings.wins')} />
                <SortButton field="empates" label={t('rankings.draws')} />
                <SortButton field="derrotas" label={t('rankings.losses')} />
                <SortButton field="golos" label={t('rankings.goalsScored')} />
              </View>
            </View>
          </View>

          <FlatList
            data={sortedPlayers}
            renderItem={renderPlayer}
            keyExtractor={(item) => item.nome}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => refetch()}
                colors={[theme.primary]}
                tintColor={theme.primary}
              />
            }
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
  sortButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  sortArrow: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    marginLeft: 2,
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