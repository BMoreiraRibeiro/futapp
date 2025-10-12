import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, ScrollView, Image, Animated, Modal } from 'react-native';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { colors } from '../../lib/colors';
import { Moon, Sun, Save, Shield, User, Globe, Settings as SettingsIcon, Lock, ChevronRight, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Toast } from '../../components/Toast';
import { useLanguage } from '../../lib/language';
import { AdminModal } from '../../components/AdminModal';
import { useClusterSettings } from '../../hooks/useClusterSettings';

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
  const { signOut, isAdmin, clusterName } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const { settings: clusterSettings, updateSettings, loading: settingsLoading } = useClusterSettings(clusterName);
  
  console.log('⚙️ Settings - isAdmin:', isAdmin);
  console.log('⚙️ Settings - loading:', settingsLoading);
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  
  // Controle de modais
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [showAdminSettingsModal, setShowAdminSettingsModal] = useState(false);
  
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

  // Carregar configurações do cluster quando disponíveis (apenas na primeira vez)
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  useEffect(() => {
    if (!settingsLoading && !settingsLoaded) {
      setTempRatingVariation(clusterSettings.rating_variation.toString());
      setTempTeamAName(clusterSettings.team_a_name);
      setTempTeamBName(clusterSettings.team_b_name);
      setTempTeamAColor(clusterSettings.team_a_color);
      setTempTeamBColor(clusterSettings.team_b_color);
      setSettingsLoaded(true);
      console.log('⚙️ Configurações carregadas:', clusterSettings);
    }
  }, [settingsLoading, settingsLoaded, clusterSettings]);

  const saveAllSettings = async () => {
    if (!isAdmin) {
      showToast('Apenas administradores podem alterar as configurações', 'error');
      return;
    }

    if (!clusterSettings) {
      showToast('Configurações não carregadas', 'error');
      return;
    }

    try {
      await updateSettings({
        rating_variation: parseFloat(tempRatingVariation),
        team_a_name: tempTeamAName,
        team_b_name: tempTeamBName,
        team_a_color: tempTeamAColor,
        team_b_color: tempTeamBColor,
      });
      
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

        {/* Botão: Perfil */}
        <TouchableOpacity
          style={[styles.menuButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
          onPress={() => setShowProfileModal(true)}
        >
          <View style={styles.menuButtonContent}>
            <User size={24} color={theme.primary} />
            <Text style={[styles.menuButtonText, { color: theme.text }]}>Perfil</Text>
          </View>
          <ChevronRight size={24} color={theme.text} />
        </TouchableOpacity>

        {/* Botão: Idioma */}
        <TouchableOpacity
          style={[styles.menuButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
          onPress={() => setShowLanguageModal(true)}
        >
          <View style={styles.menuButtonContent}>
            <Globe size={24} color={theme.primary} />
            <Text style={[styles.menuButtonText, { color: theme.text }]}>{t('settings.language')}</Text>
          </View>
          <ChevronRight size={24} color={theme.text} />
        </TouchableOpacity>

        {isAdmin && (
          <>
            {/* Botão: Personalizar Sorteio */}
            <TouchableOpacity
              style={[styles.menuButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
              onPress={() => setShowDrawModal(true)}
            >
              <View style={styles.menuButtonContent}>
                <SettingsIcon size={24} color={theme.primary} />
                <Text style={[styles.menuButtonText, { color: theme.text }]}>Personalizar Sorteio</Text>
              </View>
              <ChevronRight size={24} color={theme.text} />
            </TouchableOpacity>

            {/* Botão: Administração */}
            <TouchableOpacity
              style={[styles.menuButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
              onPress={() => setShowAdminSettingsModal(true)}
            >
              <View style={styles.menuButtonContent}>
                <Lock size={24} color={theme.primary} />
                <Text style={[styles.menuButtonText, { color: theme.text }]}>Administração</Text>
              </View>
              <ChevronRight size={24} color={theme.text} />
            </TouchableOpacity>
          </>
        )}

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

      {/* Modal: Perfil */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>👤 Perfil</Text>
              <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.themeRow}>
                <View style={styles.themeInfo}>
                  {isDarkMode ? <Moon size={24} color={theme.text} /> : <Sun size={24} color={theme.text} />}
                  <Text style={[styles.themeText, { color: theme.text }]}>
                    {isDarkMode ? t('settings.darkMode') : t('settings.lightMode')}
                  </Text>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#767577', true: theme.primary }}
                  thumbColor={isDarkMode ? '#f4f3f4' : '#f4f3f4'}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Idioma */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>🌐 {t('settings.language')}</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Personalizar Sorteio */}
      <Modal
        visible={showDrawModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>⚽ Personalizar Sorteio</Text>
              <TouchableOpacity onPress={() => setShowDrawModal(false)}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {/* Variação de Rating */}
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

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  saveAllSettings();
                  setShowDrawModal(false);
                }}
              >
                <Text style={styles.saveButtonText}>{t('common.saveSettings')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Administração */}
      <Modal
        visible={showAdminSettingsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAdminSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>🔐 Administração</Text>
              <TouchableOpacity onPress={() => setShowAdminSettingsModal(false)}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <TouchableOpacity
                style={[styles.adminButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setShowAdminSettingsModal(false);
                  setShowAdminModal(true);
                }}
              >
                <Shield size={20} color="#fff" />
                <Text style={styles.adminButtonText}>Definir Novo Admin</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {clusterName && (
        <AdminModal
          visible={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          currentClusterId={clusterName}
          onAdminChanged={() => {
            showToast('Novo admin definido com sucesso!', 'success');
          }}
        />
      )}
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
  title: {
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 20,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  menuButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  modalBody: {
    padding: 20,
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
    marginBottom: 20,
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
  saveButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
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
    marginTop: 20,
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
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  adminButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});