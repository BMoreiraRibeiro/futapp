import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../lib/theme';
import { colors } from '../../lib/colors';
import { useLanguage } from '../../lib/language';

export default function FinancesScreen() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const { t } = useLanguage();

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>
          {t('finances.title')}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Resumo Financeiro
          </Text>
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.text }]}>Receitas Totais:</Text>
            <Text style={[styles.value, { color: theme.primary }]}>€0.00</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.text }]}>Despesas Totais:</Text>
            <Text style={[styles.value, { color: '#f44336' }]}>€0.00</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.text, fontWeight: 'bold' }]}>Saldo:</Text>
            <Text style={[styles.value, { color: theme.text, fontWeight: 'bold' }]}>€0.00</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Movimentos Recentes
          </Text>
          <Text style={[styles.emptyText, { color: theme.text }]}>
            Nenhum movimento registrado
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  value: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    opacity: 0.6,
    marginVertical: 16,
  },
});
