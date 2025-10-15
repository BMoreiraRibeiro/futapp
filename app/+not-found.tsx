import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../lib/language';
import { useTheme } from '../lib/theme';
import { colors } from '../lib/colors';

export default function NotFoundScreen() {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;

  return (
    <>
      <Stack.Screen options={{ title: t('common.notFound') }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.text, { color: theme.text }]}>{t('common.screenNotFound')}</Text>
        <Link href="/" style={styles.link}>
          <Text style={{ color: theme.primary }}>{t('common.goToHome')}</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    fontSize: 20,
    fontWeight: '600',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
