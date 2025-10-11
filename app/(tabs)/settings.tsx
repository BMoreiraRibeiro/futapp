import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, ScrollView, Image, Animated } from 'react-native';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { colors } from '../../lib/colors';
import { Moon, Sun, Save } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Toast } from '../../components/Toast';
import { useLanguage } from '../../lib/language';

// Cores predefinidas para as equipes
const TEAM_COLORS = [
  { name: 'Azul', value: '#3498db' },
  { name: 'Vermelho', value: '#e74c3c' },
  { name: 'Verde', value: '#2ecc71' },
  { name: 'Amarelo', value: '#f1c40f' },
  { name: 'Roxo', value: '#9b59b6' },
  { name: 'Laranja', value: '#e67e22' },
];

export default function SettingsScreen() {
  const { signOut, isAdmin } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  
  console.log('⚙️ Settings - isAdmin:', isAdmin);
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [ratingVariation, setRatingVariation] = useState('2');
  const [teamAName, setTeamAName] = useState('Equipa A');
  const [teamBName, setTeamBName] = useState('Equipa B');
  const [teamAColor, setTeamAColor] = useState('#3498db');
  const [teamBColor, setTeamBColor] = useState('#e74c3c');
  
  // Estados temporários para edição
  const [tempRatingVariation, setTempRatingVariation] = useState('2');
  const [tempTeamAName, setTempTeamAName] = useState('Equipa A');
  const [tempTeamBName, setTempTeamBName] = useState('Equipa B');
  const [tempTeamAColor, setTempTeamAColor] = useState('#3498db');
  const [tempTeamBColor, setTempTeamBColor] = useState('#e74c3c');
  
  const [toastConfig, setToastConfig] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'info'
  });

  const { t, language, setLanguage } = useLanguage();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      await loadRatingVariation();
      await loadTeamNames();
      await loadTeamColors();
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const loadRatingVariation = async () => {
    try {
      const value = await AsyncStorage.getItem('@rating_variation');
      if (value) {
        setRatingVariation(value);
        setTempRatingVariation(value);
      }
    } catch (error) {
      console.error('Erro ao carregar variação de rating:', error);
    }
  };

  const loadTeamNames = async () => {
    try {
      const nameA = await AsyncStorage.getItem('@team_a_name');
      const nameB = await AsyncStorage.getItem('@team_b_name');
      
      if (nameA) {
        setTeamAName(nameA);
        setTempTeamAName(nameA);
      }
      if (nameB) {
        setTeamBName(nameB);
        setTempTeamBName(nameB);
      }
    } catch (error) {
      console.error('Erro ao carregar nomes das equipes:', error);
    }
  };

  const loadTeamColors = async () => {
    try {
      const colorA = await AsyncStorage.getItem('@team_a_color');
      const colorB = await AsyncStorage.getItem('@team_b_color');
      
      if (colorA) {
        setTeamAColor(colorA);
        setTempTeamAColor(colorA);
      }
      if (colorB) {
        setTeamBColor(colorB);
        setTempTeamBColor(colorB);
      }
    } catch (error) {
      console.error('Erro ao carregar cores das equipes:', error);
    }
  };

  const saveAllSettings = async () => {
    try {
      // Salvar variação de rating
      await AsyncStorage.setItem('@rating_variation', tempRatingVariation);
      setRatingVariation(tempRatingVariation);
      
      // Salvar nomes das equipes
      await AsyncStorage.setItem('@team_a_name', tempTeamAName);
      await AsyncStorage.setItem('@team_b_name', tempTeamBName);
      setTeamAName(tempTeamAName);
      setTeamBName(tempTeamBName);
      
      // Salvar cores das equipes
      await AsyncStorage.setItem('@team_a_color', tempTeamAColor);
      await AsyncStorage.setItem('@team_b_color', tempTeamBColor);
      setTeamAColor(tempTeamAColor);
      setTeamBColor(tempTeamBColor);
      
      showToast('Configurações salvas com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      showToast('Erro ao salvar configurações', 'error');
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

  const handleLogout = async () => {
    console.warn('👆 Settings: Botão de logout pressionado');
    try {
      setIsLoggingOut(true);
      await signOut();
      console.warn('✅ Settings: Logout realizado com sucesso');
    } catch (error) {
      console.error('💥 Settings: Erro ao fazer logout:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Image 
        source={require('../../assets/images/background3.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <ScrollView style={styles.contentContainer}>
        <Text style={[styles.title, { color: theme.text }]}>{t('settings.title')}</Text>

        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.language')}</Text>
          <View style={styles.languageButtons}>
            <TouchableOpacity
              style={[
                styles.languageButton,
                { 
                  backgroundColor: language === 'pt' ? theme.primary : theme.cardBackground,
                  borderColor: theme.border
                }
              ]}
              onPress={() => setLanguage('pt')}
            >
              <Text style={[
                styles.languageButtonText,
                { color: language === 'pt' ? '#ffffff' : theme.text }
              ]}>
                Português
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.languageButton,
                { 
                  backgroundColor: language === 'en' ? theme.primary : theme.cardBackground,
                  borderColor: theme.border
                }
              ]}
              onPress={() => setLanguage('en')}
            >
              <Text style={[
                styles.languageButtonText,
                { color: language === 'en' ? '#ffffff' : theme.text }
              ]}>
                English
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isAdmin && (
          <>
            <View style={[styles.section, { backgroundColor: theme.secondary }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.drawSettings')}</Text>
              <View style={styles.ratingRow}>
                <Text style={[styles.ratingText, { color: theme.text }]}>
                  {t('settings.maxRatingVariation')}
                </Text>
                <TextInput
                  style={[styles.ratingInput, { 
                    backgroundColor: theme.inputBackground,
                    color: theme.text,
                    borderColor: theme.border
                  }]}
                  value={tempRatingVariation}
                  onChangeText={(value) => {
                    if (/^\d*\.?\d*$/.test(value)) {
                      setTempRatingVariation(value);
                    }
                  }}
                  keyboardType="decimal-pad"
                  maxLength={4}
                />
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: theme.secondary }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.teamCustomization')}</Text>
          
          {/* Equipa A */}
          <View style={styles.teamSection}>
            <Text style={[styles.teamTitle, { color: theme.text }]}>{t('settings.teamA')}</Text>
            <View style={styles.teamNameRow}>
              <Text style={[styles.teamLabel, { color: theme.text }]}>{t('settings.name')}:</Text>
              <TextInput
                style={[styles.teamInput, { 
                  backgroundColor: theme.inputBackground,
                  color: theme.text,
                  borderColor: theme.border
                }]}
                value={tempTeamAName}
                onChangeText={setTempTeamAName}
                placeholder={t('settings.teamAPlaceholder')}
                placeholderTextColor={theme.placeholderText}
              />
            </View>
            <View style={styles.teamColorRow}>
              <Text style={[styles.teamLabel, { color: theme.text }]}>{t('settings.color')}:</Text>
              <View style={styles.colorButtonsContainer}>
                {TEAM_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color.value}
                    style={[
                      styles.colorButton,
                      { backgroundColor: color.value },
                      tempTeamAColor === color.value && styles.selectedColorButton
                    ]}
                    onPress={() => setTempTeamAColor(color.value)}
                  />
                ))}
              </View>
            </View>
          </View>
          
          {/* Equipa B */}
          <View style={styles.teamSection}>
            <Text style={[styles.teamTitle, { color: theme.text }]}>{t('settings.teamB')}</Text>
            <View style={styles.teamNameRow}>
              <Text style={[styles.teamLabel, { color: theme.text }]}>{t('settings.name')}:</Text>
              <TextInput
                style={[styles.teamInput, { 
                  backgroundColor: theme.inputBackground,
                  color: theme.text,
                  borderColor: theme.border
                }]}
                value={tempTeamBName}
                onChangeText={setTempTeamBName}
                placeholder={t('settings.teamBPlaceholder')}
                placeholderTextColor={theme.placeholderText}
              />
            </View>
            <View style={styles.teamColorRow}>
              <Text style={[styles.teamLabel, { color: theme.text }]}>{t('settings.color')}:</Text>
              <View style={styles.colorButtonsContainer}>
                {TEAM_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color.value}
                    style={[
                      styles.colorButton,
                      { backgroundColor: color.value },
                      tempTeamBColor === color.value && styles.selectedColorButton
                    ]}
                    onPress={() => setTempTeamBColor(color.value)}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>
      </>)}

        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.primary }]}
            onPress={saveAllSettings}
          >
            <Text style={styles.saveButtonText}>{t('common.saveSettings')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[
            styles.logoutButton, 
            { backgroundColor: 'red' },
            isLoggingOut && styles.disabledButton
          ]}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          <Text style={[styles.logoutText, { color: '#ffffff' }]}>
            {isLoggingOut ? t('common.loggingOut') : t('common.logout')}
          </Text>
        </TouchableOpacity>

        {toastConfig.visible && (
          <Toast
            visible={toastConfig.visible}
            message={toastConfig.message}
            type={toastConfig.type}
            onHide={hideToast}
          />
        )}
      </ScrollView>
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
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 16,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeText: {
    marginLeft: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  ratingInput: {
    width: 60,
    height: 45,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    textAlign: 'center',
  },
  teamSection: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  teamTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamLabel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    width: 50,
  },
  teamInput: {
    flex: 1,
    height: 45,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
  },
  colorButtonsContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorButton: {
    borderColor: '#ffffff',
  },
  saveButtonContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  saveButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  logoutButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 16,
  },
  disabledButton: {
    opacity: 0.7,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  languageButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  languageButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 20,
  },
});