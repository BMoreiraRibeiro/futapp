import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../lib/theme';
import { colors } from '../lib/colors';
import { supabase } from '../lib/supabase';
import { Toast } from './Toast';
import { X, Check } from 'lucide-react-native';

type PlayerPayment = {
  nome: string;
  pago: boolean;
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
      console.log('🔄 Carregando jogadores do jogo...');
      console.log('🎮 Game ID:', gameId);
      console.log('🏢 Cluster ID:', clusterId);
      
      // Buscar o jogo para identificar os jogadores das equipas
      const { data: gameData, error: gameError } = await supabase
        .from('resultados_jogos')
        .select('jogadores_equipa_a, jogadores_equipa_b')
        .eq('id_jogo', gameId)
        .eq('cluster_uuid', clusterId)
        .single();

      if (gameError) throw gameError;
      console.log('📋 Jogo encontrado:', gameData);

      // Buscar os pagamentos existentes
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('calotes_jogo')
        .select('nome_jogador, pago')
        .eq('id_jogo', gameId)
        .eq('cluster_uuid', clusterId);

      if (paymentsError) throw paymentsError;
      console.log('💳 Pagamentos encontrados:', paymentsData?.length, paymentsData);

      // Criar um mapa de pagamentos por jogador
      const paymentsMap = new Map(
        paymentsData?.map(p => [p.nome_jogador, p.pago]) || []
      );
      console.log('🗺️ Mapa de pagamentos:', Array.from(paymentsMap.entries()));

      // Converter as strings de jogadores em arrays
      const jogadoresEquipaA = gameData.jogadores_equipa_a.split(', ');
      const jogadoresEquipaB = gameData.jogadores_equipa_b.split(', ');
      console.log('👥 Equipa A:', jogadoresEquipaA);
      console.log('👥 Equipa B:', jogadoresEquipaB);

      // Criar a lista de jogadores com seus respectivos pagamentos
      const playersList = [
        ...jogadoresEquipaA.map((nome: string) => ({ 
          nome, 
          pago: paymentsMap.get(nome) || false 
        })),
        ...jogadoresEquipaB.map((nome: string) => ({ 
          nome, 
          pago: paymentsMap.get(nome) || false 
        }))
      ];

      console.log('✅ Lista final de jogadores:', playersList);
      console.log('📊 Total:', playersList.length, '| Pagos:', playersList.filter(p => p.pago).length, '| Não pagos:', playersList.filter(p => !p.pago).length);
      
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

  const togglePayment = (playerName: string) => {
    setPlayerPayments(prev => 
      prev.map(p => 
        p.nome === playerName 
          ? { ...p, pago: !p.pago }
          : p
      )
    );
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      console.log('🔄 Iniciando gravação de pagamentos...');
      console.log('📊 Total de jogadores a atualizar:', playerPayments.length);
      console.log('🎮 Game ID:', gameId);
      console.log('🏢 Cluster ID:', clusterId);
      
      let successCount = 0;
      let errorCount = 0;

      // Atualizar cada jogador usando upsert para garantir que existe
      for (const player of playerPayments) {
        console.log(`💳 Atualizando ${player.nome}: pago = ${player.pago}`);
        
        const { data, error } = await supabase
          .from('calotes_jogo')
          .upsert({
            cluster_uuid: clusterId,
            id_jogo: gameId,
            nome_jogador: player.nome,
            pago: player.pago
          }, {
            onConflict: 'cluster_uuid,id_jogo,nome_jogador'
          })
          .select();

        if (error) {
          console.error(`❌ Erro ao atualizar ${player.nome}:`, error);
          errorCount++;
          throw error;
        } else {
          console.log(`✅ ${player.nome} atualizado com sucesso`, data);
          successCount++;
        }
      }

      console.log(`✨ Gravação concluída! Sucesso: ${successCount}, Erros: ${errorCount}`);
      showToast('Pagamentos atualizados com sucesso', 'success');
      
      setTimeout(() => {
        console.log('🔙 Fechando modal e recarregando dados...');
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
            <Text style={[styles.headerLabel, { color: theme.text }]}>Jogador</Text>
            <Text style={[styles.headerLabel, { color: theme.text }]}>Pago</Text>
          </View>

          <ScrollView style={styles.scrollView}>
            {playerPayments.map((player, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.playerRow,
                  { 
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.border,
                    opacity: isAdmin ? 1 : 0.6
                  }
                ]}
                onPress={() => isAdmin && togglePayment(player.nome)}
                disabled={!isAdmin}
              >
                <Text style={[styles.playerName, { color: theme.text }]}>
                  {player.nome}
                </Text>
                <View style={[
                  styles.checkbox,
                  {
                    backgroundColor: player.pago ? theme.primary : 'transparent',
                    borderColor: player.pago ? theme.primary : theme.border
                  }
                ]}>
                  {player.pago && <Check size={18} color="#ffffff" />}
                </View>
              </TouchableOpacity>
            ))}
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
});
