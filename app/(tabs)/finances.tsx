import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../../lib/theme';
import { colors } from '../../lib/colors';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Trash2, ClipboardList } from 'lucide-react-native';
import { Toast } from '../../components/Toast';
import { PaymentsModal } from '../../components/PaymentsModal';

type GameWithCalotes = {
  id_jogo: string;
  data: string;
  jogadores: {
    nome: string;
    pago: boolean;
  }[];
};

export default function FinancesScreen() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const { clusterName, isAdmin } = useAuth();
  const [games, setGames] = useState<GameWithCalotes[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [paymentsModalVisible, setPaymentsModalVisible] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameWithCalotes | null>(null);
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
    if (clusterName) {
      loadGames();
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

  const loadGames = async () => {
    try {
      setLoading(true);
      console.log('🔄 Carregando jogos e pagamentos...');
      if (!clusterName) return;

      // Buscar todos os jogos
      const { data: gamesData, error: gamesError } = await supabase
        .from('resultados_jogos')
        .select('id_jogo, data')
        .eq('cluster_uuid', clusterName)
        .order('data', { ascending: false });

      if (gamesError) throw gamesError;
      console.log('📋 Jogos encontrados:', gamesData?.length);

      // Buscar calotes de todos os jogos COM JOIN para obter nome do jogador
      const { data: calotesData, error: calotesError } = await supabase
        .from('calotes_jogo')
        .select(`
          id_jogo,
          pago,
          id_jogador,
          jogadores!inner (
            nome
          )
        `)
        .eq('cluster_uuid', clusterName);

      if (calotesError) throw calotesError;
      console.log('💳 Registos de calotes encontrados:', calotesData?.length);

      // Combinar os dados
      const gamesWithCalotes: GameWithCalotes[] = gamesData?.map(game => {
        const jogadoresDoJogo = calotesData
          ?.filter(c => c.id_jogo === game.id_jogo)
          .map(c => ({
            // @ts-ignore - o tipo está complexo mas sabemos a estrutura
            nome: c.jogadores?.nome || 'Desconhecido',
            pago: c.pago || false
          })) || [];
        
        const totalPagos = jogadoresDoJogo.filter(j => j.pago).length;
        const totalCalotes = jogadoresDoJogo.filter(j => !j.pago).length;
        
        console.log(`🎮 Jogo ${game.id_jogo}: ${jogadoresDoJogo.length} jogadores, ${totalPagos} pagos, ${totalCalotes} calotes`);
        
        return {
          id_jogo: game.id_jogo,
          data: game.data,
          jogadores: jogadoresDoJogo
        };
      }) || [];

      setGames(gamesWithCalotes);
      console.log('✅ Dados carregados com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao carregar jogos:', error);
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGame = async (idJogo: string) => {
    Alert.alert(
      'Confirmar exclusão',
      'Tem certeza que deseja eliminar este jogo? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(idJogo);

              // Eliminar registos de calotes primeiro
              const { error: calotesError } = await supabase
                .from('calotes_jogo')
                .delete()
                .eq('cluster_uuid', clusterName)
                .eq('id_jogo', idJogo);

              if (calotesError) throw calotesError;

              // Eliminar o jogo
              const { error: gameError } = await supabase
                .from('resultados_jogos')
                .delete()
                .eq('cluster_uuid', clusterName)
                .eq('id_jogo', idJogo);

              if (gameError) throw gameError;

              showToast('Jogo eliminado com sucesso', 'success');
              loadGames();
            } catch (error) {
              console.error('Erro ao eliminar jogo:', error);
              showToast('Erro ao eliminar jogo', 'error');
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    );
  };

  const handleOpenPaymentsModal = (game: GameWithCalotes) => {
    setSelectedGame(game);
    setPaymentsModalVisible(true);
  };

  const handleClosePaymentsModal = () => {
    console.log('🔄 Modal fechado, recarregando dados...');
    setPaymentsModalVisible(false);
    setSelectedGame(null);
    loadGames(); // Recarregar para mostrar as alterações
  };

  const renderGame = ({ item }: { item: GameWithCalotes }) => (
    <View style={[
      styles.gameCard,
      { 
        backgroundColor: theme.cardBackground,
        opacity: deletingId === item.id_jogo ? 0.5 : 1
      }
    ]}>
      <View style={styles.gameHeader}>
        <Text style={[styles.gameDate, { color: theme.text }]}>
          {new Date(item.data).toLocaleDateString('pt-PT')}
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.manageButton, { backgroundColor: theme.primary }]}
            onPress={() => handleOpenPaymentsModal(item)}
          >
            <ClipboardList size={16} color="#ffffff" />
            <Text style={styles.manageButtonText}>Dívidas</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: theme.error }]}
              onPress={() => handleDeleteGame(item.id_jogo)}
              disabled={deletingId === item.id_jogo}
            >
              <Trash2 size={16} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.text }]}>
            Total de jogadores:
          </Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {item.jogadores.length}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.text }]}>
            Pagamentos:
          </Text>
          <Text style={[styles.summaryValue, { color: theme.primary }]}>
            {item.jogadores.filter(j => j.pago).length} / {item.jogadores.length}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.text }]}>
            Calotes:
          </Text>
          <Text style={[styles.summaryValue, { color: '#f44336' }]}>
            {item.jogadores.filter(j => !j.pago).length}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={games}
        renderItem={renderGame}
        keyExtractor={(item) => item.id_jogo}
        contentContainerStyle={styles.listContainer}
        refreshing={loading}
        onRefresh={loadGames}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.text }]}>
              Nenhum jogo registrado
            </Text>
          </View>
        }
      />

      {selectedGame && clusterName && (
        <PaymentsModal
          visible={paymentsModalVisible}
          onClose={handleClosePaymentsModal}
          gameId={selectedGame.id_jogo}
          clusterId={clusterName}
          gameDate={selectedGame.data}
          isAdmin={isAdmin}
        />
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
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
  },
  gameDate: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  manageButton: {
    padding: 8,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  manageButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryContainer: {
    gap: 8,
    paddingTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    opacity: 0.6,
  },
});
