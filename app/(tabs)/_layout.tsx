import { Tabs, useRouter } from 'expo-router';
import { Shuffle, Trophy, Users, Settings, BarChart2, DollarSign } from 'lucide-react-native';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../../lib/theme';
import { colors } from '../../lib/colors';
import { useLanguage } from '../../lib/language';

function Header() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const router = useRouter();

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', theme.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.titleRow}>
          <View style={styles.iconWrapper}>
            <Image 
              source={require('../../assets/images/soccer_ball.png')}
              style={styles.icon}
            />
          </View>
          <Text style={styles.headerTitle}>
            Futebol às <Text style={styles.headerTitleHighlight}>quartas</Text>
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => router.push('/(tabs)/settings')}
          activeOpacity={0.7}
        >
          <View style={styles.settingsIconContainer}>
            <Settings size={26} color="white" strokeWidth={2.5} />
          </View>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

export default function TabLayout() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const { t } = useLanguage();

  // TabLayout isAdmin monitoring - logs removed for production

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Image 
        source={require('../../assets/images/background3.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <Header />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.cardBackground,
            borderTopColor: theme.border,
            paddingBottom: 8,
            paddingHorizontal: 2,
            height: 65,
          },
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.text,
          tabBarLabelStyle: {
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10,
          },
          tabBarItemStyle: {
            paddingHorizontal: 2,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: t('index.title'),
            tabBarIcon: ({ color }) => <Shuffle size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="rankings"
          options={{
            title: t('rankings.title'),
            tabBarIcon: ({ color }) => <BarChart2 size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="players"
          options={{
            title: t('players.title'),
            tabBarIcon: ({ color }) => <Users size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="results"
          options={{
            title: t('results.title'),
            tabBarIcon: ({ color }) => <Trophy size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="finances"
          options={{
            title: t('finances.tabTitle'),
            tabBarIcon: ({ color }) => <DollarSign size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('settings.tabTitle'),
            tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
            href: null,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  header: {
    paddingTop: 24,
    paddingBottom: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  icon: {
    width: 28,
    height: 28,
    transform: [{ rotate: '-15deg' }],
    tintColor: '#ffffff',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  headerTitleHighlight: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    fontWeight: 'bold',
  },
  settingsButton: {
    padding: 8,
  },
  settingsIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});