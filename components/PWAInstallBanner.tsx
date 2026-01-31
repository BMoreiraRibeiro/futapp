import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { X, Download } from 'lucide-react-native';
import { usePWA } from '../hooks/usePWA';
import { useTheme } from '../lib/theme';
import { colors } from '../lib/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const INSTALL_BANNER_DISMISSED_KEY = '@pwa_install_banner_dismissed';

export function PWAInstallBanner() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const { isInstallable, isInstalled, promptInstall } = usePWA();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Apenas mostrar na web
  if (Platform.OS !== 'web') return null;

  useEffect(() => {
    const checkDismissed = async () => {
      const dismissed = await AsyncStorage.getItem(INSTALL_BANNER_DISMISSED_KEY);
      setIsDismissed(dismissed === 'true');
    };
    checkDismissed();
  }, []);

  useEffect(() => {
    // Mostrar banner se:
    // 1. PWA é instalável
    // 2. PWA não está instalado
    // 3. Banner não foi dispensado
    setIsVisible(isInstallable && !isInstalled && !isDismissed);
  }, [isInstallable, isInstalled, isDismissed]);

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      setIsVisible(false);
    }
  };

  const handleDismiss = async () => {
    await AsyncStorage.setItem(INSTALL_BANNER_DISMISSED_KEY, 'true');
    setIsDismissed(true);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <View style={styles.content}>
        <Download size={24} color="#fff" style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Instalar FutBeer</Text>
          <Text style={styles.subtitle}>
            Instala a app para acesso rápido e funcionalidades offline
          </Text>
        </View>
      </View>
      
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.installButton]}
          onPress={handleInstall}
        >
          <Text style={styles.installButtonText}>Instalar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleDismiss}
        >
          <X size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  installButton: {
    backgroundColor: '#fff',
  },
  installButtonText: {
    color: '#00A859',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  closeButton: {
    padding: 4,
  },
});
