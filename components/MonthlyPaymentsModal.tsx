import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../lib/theme';
import { colors } from '../lib/colors';
import { supabase } from '../lib/supabase';
import { Toast } from './Toast';
import { X, Check } from 'lucide-react-native';

type MonthPayment = {
  months: string; // MM-YYYY
  pago: boolean;
};

type MonthlyPaymentsModalProps = {
  visible: boolean;
  onClose: () => void;
  playerId: string;
  playerName: string;
  year: string;
  isAdmin: boolean;
};

export function MonthlyPaymentsModal({ visible, onClose, playerId, playerName, year, isAdmin }: MonthlyPaymentsModalProps) {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const [months, setMonths] = useState<MonthPayment[]>([]);
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
      loadMonths();
    } else {
      setMonths([]);
    }
  }, [visible, playerId, year]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastConfig({ visible: true, message, type });
  };

  const hideToast = () => setToastConfig(prev => ({ ...prev, visible: false }));

  const loadMonths = async () => {
    try {
      setLoading(true);
      if (!playerId) return;

      const likePattern = '%-' + year;

      const { data, error } = await supabase
        .from('pagamentos_jogador_por_mes')
        .select('months, pago')
        .eq('player_id', playerId)
        .like('months', likePattern)
        .order('months', { ascending: true });

      if (error) throw error;

      // Ensure months for all 12 months in case some are missing (should have been created by trigger)
      const allMonths: MonthPayment[] = [];
      for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, '0') + '-' + year;
        const found = data?.find((d: any) => d.months === mm);
        allMonths.push({ months: mm, pago: found ? found.pago : false });
      }

      setMonths(allMonths);
    } catch (error) {
      console.error('Erro ao carregar meses:', error);
      showToast('Erro ao carregar meses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleMonth = (month: string) => {
    if (!isAdmin) return;
    setMonths(prev => prev.map(m => m.months === month ? { ...m, pago: !m.pago } : m));
  };

  const handleSave = async () => {
    if (!isAdmin) return showToast('Permissão negada', 'error');

    try {
      setLoading(true);
      for (const m of months) {
        const { error } = await supabase
          .from('pagamentos_jogador_por_mes')
          .upsert({ months: m.months, player_id: playerId, pago: m.pago }, { onConflict: 'months,player_id' })
          .select();

        if (error) throw error;
      }

      showToast('Pagamentos mensais atualizados', 'success');
      setTimeout(() => onClose(), 600);
    } catch (error) {
      console.error('Erro ao salvar meses:', error);
      showToast('Erro ao salvar meses', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}> 
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Pagamentos Mensais - {playerName} ({year})</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}><X size={20} color={theme.text} /></TouchableOpacity>
          </View>

          <View style={[styles.listHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.headerLabel, { color: theme.text, flex: 1 }]}>Mês</Text>
            <Text style={[styles.headerLabel, { color: theme.text }]}>Pago</Text>
          </View>

          <ScrollView style={styles.scrollView}>
            {months.map(m => (
              <TouchableOpacity
                key={m.months}
                style={[styles.playerRow, { backgroundColor: theme.cardBackground, borderColor: theme.border, opacity: isAdmin ? 1 : 0.6 }]}
                onPress={() => toggleMonth(m.months)}
                disabled={!isAdmin}
              >
                <Text style={[styles.playerName, { color: theme.text }]}>{m.months}</Text>
                <View style={[styles.checkbox, { backgroundColor: m.pago ? theme.primary : 'transparent', borderColor: m.pago ? theme.primary : theme.border }]}>
                  {m.pago && <Check size={18} color="#fff" />}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {isAdmin && (
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primary, opacity: loading ? 0.5 : 1 }]} onPress={handleSave} disabled={loading}>
              <Text style={styles.saveButtonText}>{loading ? 'A guardar...' : 'Guardar'}</Text>
            </TouchableOpacity>
          )}

          {toastConfig.visible && (
            <Toast visible={toastConfig.visible} message={toastConfig.message} type={toastConfig.type} onHide={hideToast} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxHeight: '80%', borderRadius: 12, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', flex: 1 },
  closeButton: { padding: 4 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, marginBottom: 8, borderBottomWidth: 1 },
  headerLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', opacity: 0.7 },
  scrollView: { maxHeight: 400 },
  playerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1 },
  playerName: { fontSize: 16, fontFamily: 'Inter_400Regular', flex: 1 },
  checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  saveButton: { padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: '#ffffff', fontSize: 16, fontFamily: 'Inter_600SemiBold' }
});
