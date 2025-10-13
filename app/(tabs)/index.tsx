import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ScrollView, Image } from 'react-native';
import { useTheme } from '../../lib/theme';
import { colors } from '../../lib/colors';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Toast } from '../../components/Toast';
import { Check, X, Users } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useResults } from '../../lib/results';
import { useLanguage } from '../../lib/language';

type Player = {
  nome: string;
  rating: number;
  visivel: boolean;
  selected?: boolean;
};

type Team = {
  name: string;
  players: Player[];
  averageRating: number;
  color?: string;
};

export default function IndexScreen() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const { clusterName } = useAuth();
  const { fetchResults } = useResults();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ratingVariation, setRatingVariation] = useState('2');
  const [teamAName, setTeamAName] = useState('Equipa A');
  const [teamBName, setTeamBName] = useState('Equipa B');
  const [teamAColor, setTeamAColor] = useState('#3498db');
  const [teamBColor, setTeamBColor] = useState('#e74c3c');
  const [toastConfig, setToastConfig] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'info'
  });
  const router = useRouter();
  const { t } = useLanguage();

  // Carrega configurações e jogadores quando o cluster muda
  useEffect(() => {
    if (clusterName) {
      fetchPlayers();
      loadRatingVariation();
      loadTeamSettings();
    }
  }, [clusterName]);

  // Recarrega dados quando a tela ganha foco
  useFocusEffect(
    useCallback(() => {
      if (clusterName) {
        fetchPlayers();
        setSelectedPlayers([]);
        setPlayers(prevPlayers => 
          prevPlayers.map(player => ({ ...player, selected: false }))
        );
        loadTeamSettings();
      }
    }, [clusterName])
  );

  const loadTeamSettings = async () => {
    try {
      const nameA = await AsyncStorage.getItem('@team_a_name');
      const nameB = await AsyncStorage.getItem('@team_b_name');
      const colorA = await AsyncStorage.getItem('@team_a_color');
      const colorB = await AsyncStorage.getItem('@team_b_color');
      
      if (nameA) setTeamAName(nameA);
      if (nameB) setTeamBName(nameB);
      if (colorA) setTeamAColor(colorA);
      if (colorB) setTeamBColor(colorB);
    } catch (error) {
      console.error('Erro ao carregar configurações das equipes:', error);
    }
  };

  const loadRatingVariation = async () => {
    try {
      const value = await AsyncStorage.getItem('@rating_variation');
      if (value) {
        setRatingVariation(value);
      }
    } catch (error) {
      console.error('Erro ao carregar variação de rating:', error);
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
        .eq('cluster_uuid', clusterName)
        .eq('visivel', true)
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

  const togglePlayerSelection = (player: Player) => {
    setPlayers(prevPlayers => 
      prevPlayers.map(p => 
        p.nome === player.nome 
          ? { ...p, selected: !p.selected }
          : p
      )
    );

    setSelectedPlayers(prev => {
      const isSelected = prev.some(p => p.nome === player.nome);
      if (isSelected) {
        return prev.filter(p => p.nome !== player.nome);
      } else {
        return [...prev, { ...player, selected: true }];
      }
    });
  };

  const calculateTeamAverage = (teamPlayers: Player[]): number => {
    if (teamPlayers.length === 0) return 0;
    const sum = teamPlayers.reduce((acc, player) => acc + player.rating, 0);
    return Number((sum / teamPlayers.length).toFixed(1));
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const drawTeams = () => {
    if (selectedPlayers.length < 2) {
      showToast('Selecione pelo menos 2 jogadores', 'error');
      return;
    }

    const maxVariation = parseFloat(ratingVariation);
    if (isNaN(maxVariation) || maxVariation <= 0) {
      showToast('Variação de rating inválida', 'error');
      return;
    }

    let attempts = 0;
    const maxAttempts = 100;
    let bestTeams: Team[] | null = null;
    let bestVariation = Infinity;

    while (attempts < maxAttempts) {
      const shuffledPlayers = shuffleArray([...selectedPlayers]);
      const teamA: Player[] = [];
      const teamB: Player[] = [];

      shuffledPlayers.forEach((player, index) => {
        if (index % 2 === 0) {
          teamA.push(player);
        } else {
          teamB.push(player);
        }
      });

      const avgTeamA = calculateTeamAverage(teamA);
      const avgTeamB = calculateTeamAverage(teamB);
      const variation = Math.abs(avgTeamA - avgTeamB);

      if (variation < bestVariation) {
        bestVariation = variation;
        bestTeams = [
          {
            name: teamAName,
            players: teamA,
            averageRating: avgTeamA,
            color: teamAColor
          },
          {
            name: teamBName,
            players: teamB,
            averageRating: avgTeamB,
            color: teamBColor
          }
        ];
      }

      if (variation <= maxVariation) {
        setTeams([
          {
            name: teamAName,
            players: teamA,
            averageRating: avgTeamA,
            color: teamAColor
          },
          {
            name: teamBName,
            players: teamB,
            averageRating: avgTeamB,
            color: teamBColor
          }
        ]);
        return;
      }

      attempts++;
    }

    if (bestTeams) {
      setTeams(bestTeams);
      showToast(`Equipas sorteadas com diferença de ${bestVariation.toFixed(1)}`, 'info');
    } else {
      showToast('Não foi possível encontrar equipes balanceadas', 'error');
    }
  };

  const saveTeamsToDatabase = async () => {
    if (teams.length !== 2) {
      showToast('Não há equipas para gravar', 'error');
      return;
    }

    if (!clusterName) {
      showToast('Erro: cluster não identificado', 'error');
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('resultados_jogos')
        .insert([
          {
            cluster_uuid: clusterName,
            data: new Date().toISOString().split('T')[0],
            jogadores_equipa_a: teams[0].players.map(p => p.nome).join(', '),
            jogadores_equipa_b: teams[1].players.map(p => p.nome).join(', '),
            vencedor: null
          }
        ])
        .select();

      if (error) throw error;

      // Inserir todos os jogadores na tabela de calotes
      if (data && data.length > 0) {
        const gameId = data[0].id_jogo;
        const allPlayers = [...teams[0].players, ...teams[1].players];
        
        const calotesRecords = allPlayers.map(player => ({
          cluster_uuid: clusterName,
          nome_jogador: player.nome,
          id_jogo: gameId,
          pago: false
        }));

        const { error: calotesError } = await supabase
          .from('calotes_jogo')
          .insert(calotesRecords);

        if (calotesError) {
          console.error('Erro ao inserir registos de calotes:', calotesError);
          throw calotesError;
        }
      }

      await fetchResults(clusterName);
      showToast('Jogo registado com sucesso!', 'success');
      setTeams([]);
      router.push('/(tabs)/results');
    } catch (error) {
      console.error('Erro ao gravar equipas:', error);
      showToast('Erro ao registar jogo', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderPlayer = ({ item }: { item: Player }) => (
    <TouchableOpacity
      style={[
        styles.playerCard,
        { backgroundColor: item.selected ? theme.primary : theme.cardBackground }
      ]}
      onPress={() => togglePlayerSelection(item)}
    >
      <View style={styles.playerInfo}>
        <Text style={[styles.playerName, { color: theme.text }]}>{item.nome}</Text>
        <Text style={[styles.playerRating, { color: theme.text }]}>Rating: {item.rating}</Text>
      </View>
      {item.selected ? (
        <Check size={24} color={theme.text} />
      ) : (
        <X size={24} color={theme.text} />
      )}
    </TouchableOpacity>
  );

  const renderTeam = ({ item }: { item: Team }) => (
    <View style={[styles.teamCard, { backgroundColor: item.color || theme.cardBackground }]}>
      <Text style={[styles.teamName, { color: '#ffffff' }]}>{item.name}</Text>
      <View style={styles.teamPlayers}>
        {item.players.map((player) => (
          <View key={player.nome} style={styles.teamPlayer}>
            <Text style={[styles.teamPlayerName, { color: '#ffffff' }]}>{player.nome}</Text>
            <Text style={[styles.teamPlayerRating, { color: '#ffffff' }]}>{player.rating}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.teamAverage, { color: '#ffffff' }]}>
        Rating Médio: {item.averageRating}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Image 
        source={require('../../assets/images/background3.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      
      {selectedPlayers.length > 0 && (
        <View style={[styles.playerCounterBadge, { backgroundColor: theme.primary }]}>
          <Users size={16} color="#fff" style={styles.playerCounterIcon} />
          <Text style={styles.playerCounterText}>{selectedPlayers.length}</Text>
        </View>
      )}
      
      <View style={styles.contentContainer}>
        <Text style={[styles.title, { color: theme.text }]}>{t('index.title')}</Text>
        
        <View style={styles.playersSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('index.selectPlayers')}</Text>
            
            {selectedPlayers.length > 0 && (
              <View style={[styles.headerCounter, { backgroundColor: theme.primary }]}>
                <Text style={styles.headerCounterText}>{selectedPlayers.length}</Text>
              </View>
            )}
          </View>
          
          <FlatList
            data={players}
            renderItem={renderPlayer}
            keyExtractor={(item) => item.nome}
            contentContainerStyle={styles.listContainer}
            refreshing={loading}
            onRefresh={fetchPlayers}
          />
        </View>

        {teams.length > 0 && (
          <View style={styles.teamsSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('index.teams')}</Text>
            <View style={styles.teamsContainer}>
              {teams.map((team, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.teamContainer
                  ]}
                >
                  {renderTeam({ item: team })}
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: theme.primary },
                saving && styles.disabledButton
              ]}
              onPress={saveTeamsToDatabase}
              disabled={saving}
            >
              <Text style={[styles.saveButtonText, { color: '#ffffff' }]}>
                {saving ? 'Gravando...' : 'Gravar Equipas'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.drawButton,
            { backgroundColor: theme.primary },
            (selectedPlayers.length < 2 || loading) && styles.disabledButton
          ]}
          onPress={drawTeams}
          disabled={selectedPlayers.length < 2 || loading}
        >
          <Text style={[styles.drawButtonText, { color: theme.text }]}>
            {loading ? t('common.loading') : t('index.randomizeTeams')}
          </Text>
        </TouchableOpacity>
      </View>

      {toastConfig.visible && (
        <Toast
          visible={toastConfig.visible}
          message={toastConfig.message}
          type={toastConfig.type}
          onHide={hideToast}
        />
      )}
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
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
    alignSelf: 'center',
  },
  playersSection: {
    flex: 1,
    marginBottom: 16,
  },
  teamsSection: {
    marginBottom: 16,
  },
  listContainer: {
    gap: 8,
  },
  playerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
  },
  playerInfo: {
    flex: 1,
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
  teamsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  teamContainer: {
    width: 200,
  },
  teamCard: {
    padding: 16,
    borderRadius: 8,
  },
  teamName: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  teamPlayers: {
    marginBottom: 12,
  },
  teamPlayer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  teamPlayerName: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  teamPlayerRating: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  teamAverage: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    marginTop: 8,
  },
  drawButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  drawButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  disabledButton: {
    opacity: 0.7,
  },
  saveButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerCounter: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 24,
    alignItems: 'center',
  },
  headerCounterText: {
    color: '#ffffff',
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  playerCounterBadge: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  playerCounterIcon: {
    marginRight: 5,
  },
  playerCounterText: {
    color: '#ffffff',
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
});