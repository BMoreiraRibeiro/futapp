import { Tabs, useRouter } from 'expo-router';
import { Shuffle, Trophy, Users, History, Settings, Bold, LucideBold, Home, BarChart2, DollarSign } from 'lucide-react-native';
import { View, Text, StyleSheet, Image, Platform, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { colors } from '../../lib/colors';
import { useLanguage } from '../../lib/language';

function Header() {
  const { clusterName } = useAuth();
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const router = useRouter();

  console.warn('🎯 Header: Renderizando com clusterName:', clusterName);


  return (
    <LinearGradient
      colors={['black', 'black', theme.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}>
      <View style={styles.headerContent}>
        <Image 
          source={require('../../assets/images/soccer_ball.png')}
          style={styles.icon}
        />
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>Futebol às quartas</Text>
          <View style={styles.clusterRow}>
            <Text style={styles.separator}>Clube:</Text>
            <Text style={styles.clusterName}>
              {clusterName}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => router.push('/(tabs)/settings')}
        >
          <Settings size={24} color="white" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

export default function TabLayout() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const { t } = useLanguage();
  const { isAdmin } = useAuth();

  console.log('🔑 TabLayout - isAdmin:', isAdmin);

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
            href: isAdmin ? '/finances' : null,
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
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  clusterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  headerTitle: {
    color: 'rgba(48, 190, 72, 0.9)',
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    fontWeight: 'bold',
  },
  separator: {
    color: '#ffffff',
    fontSize: 16,
    opacity: 0.9,
    marginRight: 8,
  },
  clusterName: {
    color: 'blue',
    fontSize: 20,
    opacity: 0.9,
    fontFamily: 'Inter_700Bold',
    fontWeight: 'bold',
  },
  icon: {
    width: 32,
    height: 32,
    transform: [{ rotate: '-15deg' }],
    tintColor: '#ffffff',
  },
  settingsButton: {
    padding: 8,
    marginLeft: 8,
    marginBottom: -4,
  },
});