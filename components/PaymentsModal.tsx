import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../lib/theme';
import { colors } from '../lib/colors';
import { supabase } from '../lib/supabase';
import { Toast } from './Toast';
import { X, Check } from 'lucide-react-native';

type PlayerPayment = {
  id_jogador: string;
  nome: string;
  pago: boolean;
  pagou_atraso?: boolean;
};

type PaymentsModalProps = {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  clusterId: string;
  gameDate: string;
  isAdmin: boolean;
};

export function PaymentsModal({ visible, onClose, gameId, clusterId, gameDate, isAdmin }: PaymentsModalProps) {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const [playerPayments, setPlayerPayments] = useState<PlayerPayment[]>([]);
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
      setPlayerPayments([]);
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

      // Buscar os pagamentos existentes COM JOIN para obter nome
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('calotes_jogo')
        .select(`
          pago,
          pagou_atraso,
          id_jogador,
          jogadores!inner (
            nome
          )
        `)
        .eq('id_jogo', gameId)
        .eq('cluster_uuid', clusterId);

      if (paymentsError) throw paymentsError;

      // Criar um mapa de pagamentos por id_jogador
      const paymentsMap = new Map(
        paymentsData?.map(p => [
          p.id_jogador,
          // @ts-ignore
          // @ts-ignore
          { pago: p.pago, pagou_atraso: p.pagou_atraso, nome: p.jogadores?.nome }
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

      // Criar a lista de jogadores com seus respectivos pagamentos
      const playersList: PlayerPayment[] = [
        ...jogadoresEquipaA.map((id_jogador: string) => {
          const paymentInfo = paymentsMap.get(id_jogador);
          return {
            id_jogador,
            nome: playersMap.get(id_jogador) || 'Desconhecido',
              pago: paymentInfo?.pago || false,
              pagou_atraso: paymentInfo?.pagou_atraso || false
          };
        }),
        ...jogadoresEquipaB.map((id_jogador: string) => {
          const paymentInfo = paymentsMap.get(id_jogador);
          return {
            id_jogador,
            nome: playersMap.get(id_jogador) || 'Desconhecido',
              pago: paymentInfo?.pago || false,
              pagou_atraso: paymentInfo?.pagou_atraso || false
          };
        })
      ];

      
      setPlayerPayments(playersList);
    } catch (error) {
      console.error('❌ Erro ao carregar pagamentos:', error);
      showToast('Erro ao carregar pagamentos', 'error');
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

  const togglePayment = (playerId: string) => {
    setPlayerPayments(prev => 
      prev.map(p => 
        p.id_jogador === playerId 
          ? { ...p, pago: !p.pago }
          : p
      )
    );
  };

  const toggleAtrasoPayment = (playerId: string) => {
    setPlayerPayments(prev =>
      prev.map(p =>
        p.id_jogador === playerId
          ? { ...p, pagou_atraso: !p.pagou_atraso }
          : p
      )
    );
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      let successCount = 0;
      let errorCount = 0;

      // Atualizar cada jogador usando upsert para garantir que existe
      for (const player of playerPayments) {
        
        const { error } = await supabase
          .from('calotes_jogo')
          .upsert({
            cluster_uuid: clusterId,
            id_jogo: gameId,
            id_jogador: player.id_jogador,
            pago: player.pago,
            pagou_atraso: player.pagou_atraso || false
          }, {
            onConflict: 'cluster_uuid,id_jogo,id_jogador'
          })
          .select();

        if (error) {
          console.error(`❌ Erro ao atualizar ${player.nome}:`, error);
          errorCount++;
          throw error;
        } else {
          successCount++;
        }
      }

      showToast('Pagamentos atualizados com sucesso', 'success');
      
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('❌ Erro ao salvar pagamentos:', error);
      showToast('Erro ao salvar pagamentos', 'error');
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
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Pagamentos - {new Date(gameDate).toLocaleDateString('pt-PT')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.listHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.headerLabel, { color: theme.text, flex: 1 }]}>Jogador</Text>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.headerLabel, { color: theme.text }]}>Pagou:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                <Text style={[styles.subHeaderLabel, { color: theme.primary, marginRight: 12 }]}>Jogo</Text>
                <Text style={[styles.subHeaderLabel, { color: theme.success }]}>Atraso</Text>
              </View>
            </View>
          </View>

          <ScrollView style={styles.scrollView}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={[styles.loadingText, { color: theme.text }]}>
                  A carregar jogadores...
                </Text>
              </View>
            ) : playerPayments && playerPayments.length > 0 ? (
              playerPayments.map((player) => (
                <TouchableOpacity
                  key={player.id_jogador}
                  style={[
                    styles.playerRow,
                    { 
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                      opacity: isAdmin ? 1 : 0.6
                    }
                  ]}
                  onPress={() => isAdmin && togglePayment(player.id_jogador)}
                  disabled={!isAdmin}
                >
                  <Text style={[styles.playerName, { color: theme.text }]}> 
                    {player.nome}
                  </Text>
                  <View style={[
                    styles.checkbox,
                    {
                      backgroundColor: player.pago ? theme.primary : 'transparent',
                      borderColor: player.pago ? theme.primary : theme.border,
                      marginRight: 8
                    }
                  ]}>
                    {player.pago && <Check size={18} color="#ffffff" />}
                  </View>

                  <TouchableOpacity
                    onPress={() => isAdmin && toggleAtrasoPayment(player.id_jogador)}
                    disabled={!isAdmin}
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: player.pagou_atraso ? theme.success : 'transparent',
                        borderColor: player.pagou_atraso ? theme.success : theme.border
                      }
                    ]}
                  >
                    {player.pagou_atraso && <Check size={18} color="#ffffff" />}
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: theme.text }]}>
                  Nenhum jogador encontrado
                </Text>
              </View>
            )}
          </ScrollView>

          {isAdmin && (
            <TouchableOpacity
              style={[
                styles.saveButton,
                { 
                  backgroundColor: theme.primary,
                  opacity: loading ? 0.5 : 1
                }
              ]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'A guardar...' : 'Guardar'}
              </Text>
            </TouchableOpacity>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
  },
  headerLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    opacity: 0.7,
  },
  subHeaderLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    opacity: 0.9,
  },
  scrollView: {
    maxHeight: 400,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  playerName: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    opacity: 0.7,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    opacity: 0.7,
  },
});
