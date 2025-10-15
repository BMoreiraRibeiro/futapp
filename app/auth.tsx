import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Toast } from '../components/Toast';
import { Eye, EyeOff, Globe, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../lib/theme';
import { colors } from '../lib/colors';
import { useLanguage } from '../lib/language';
import NetInfo from '@react-native-community/netinfo';

type AuthMode = 'login' | 'register' | 'resetPassword';

export default function AuthScreen() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const { t, language, setLanguage } = useLanguage();
  
  // State
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [hasInternet, setHasInternet] = useState(true);
  const [toastConfig, setToastConfig] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'info'
  });
  const { session } = useAuth();

  // Verifica conectividade à internet
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected && state.isInternetReachable !== false;
      setHasInternet(isConnected ?? false);
      
      if (!isConnected) {
        showToast('Sem conexão à internet', 'error');
      }
    });

    NetInfo.fetch().then(state => {
      const isConnected = state.isConnected && state.isInternetReachable !== false;
      setHasInternet(isConnected ?? false);
    });

    return () => unsubscribe();
  }, []);

  // Redirect se já está autenticado
  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastConfig({ visible: true, message, type });
  };

  const hideToast = () => {
    setToastConfig(prev => ({ ...prev, visible: false }));
  };

  // Validações
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidPassword = (password: string) => {
    return password.length >= 6;
  };

  const toggleLanguageMenu = () => {
    setShowLanguageMenu(!showLanguageMenu);
  };

  const changeLanguage = (lang: 'pt' | 'en') => {
    setLanguage(lang);
    setShowLanguageMenu(false);
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setPassword('');
    if (newMode === 'login') {
      setPlayerName('');
    }
  };

  // === LOGIN (sem nome do jogador) ===
  async function handleLogin() {
    if (!hasInternet) {
      setError('Sem conexão à internet');
      showToast('Sem conexão à internet', 'error');
      return;
    }

    if (!email || !password) {
      setError(t('auth.emailRequired'));
      return;
    }

    if (!isValidEmail(email)) {
      setError(t('auth.invalidEmail'));
      return;
    }

    if (!isValidPassword(password)) {
      setError(t('auth.invalidPassword'));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Erro no login:', error.message);
        console.error('Código do erro:', error.status);
        
        let errorMessage = error.message;
        
        if (error.status === 429 || error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = 'Muitas tentativas de login. Aguarde 60 segundos e tente novamente.';
          console.warn('⏱️ Rate limit atingido - aguarde 60 segundos');
        } else if (error.message.includes('Invalid login credentials')) {
          errorMessage = t('auth.invalidCredentials');
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = t('auth.emailNotConfirmed');
          showToast(t('auth.emailNotConfirmed'), 'error');
        }
        
        setError(errorMessage);
        return;
      }

      console.log('✅ Login realizado com sucesso');
      showToast(t('auth.loginSuccess'), 'success');
    } catch (error) {
      setError(error instanceof Error ? error.message : t('common.loginError'));
      console.error('💥 Login Error:', error);
    } finally {
      setLoading(false);
    }
  }

  // === REGISTO (com nome do jogador) ===
  async function handleRegister() {
    console.log('🔄 Iniciando registo...');
    
    if (!hasInternet) {
      setError('Sem conexão à internet');
      showToast('Sem conexão à internet', 'error');
      return;
    }

    if (!email || !password) {
      setError(t('auth.emailRequired'));
      return;
    }

    if (!playerName || playerName.trim().length < 2) {
      setError('Nome do jogador deve ter pelo menos 2 caracteres');
      return;
    }

    if (!isValidEmail(email)) {
      setError(t('auth.invalidEmail'));
      return;
    }

    if (!isValidPassword(password)) {
      setError(t('auth.invalidPassword'));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'fut://auth/callback',
          data: {
            player_name: playerName.trim()
          }
        }
      });

      if (error) {
        console.error('❌ Erro no registo:', error.message);
        console.error('Código do erro:', error.status);
        
        let errorMessage = error.message;
        
        if (error.status === 429 || error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = 'Muitas tentativas de registo. Aguarde 60 segundos e tente novamente.';
          console.warn('⏱️ Rate limit atingido - aguarde 60 segundos');
        } else if (error.message.toLowerCase().includes('user already registered')) {
          errorMessage = t('auth.emailAlreadyRegistered');
        } else if (error.message.includes('password')) {
          errorMessage = t('auth.invalidPassword');
        }
        
        setError(errorMessage);
        showToast(errorMessage, 'error');
        return;
      }

      // Verifica se o utilizador foi criado
      if (!data.user?.identities || data.user.identities.length === 0) {
        console.warn('⚠️ Email já cadastrado');
        setError(t('auth.emailAlreadyRegistered'));
        return;
      }

      console.log('✅ Conta criada com sucesso');
      
      // Se email confirmations estiver ativado
      if (!data.session) {
        console.log('📧 Email de confirmação enviado');
        showToast('Verifique seu email para confirmar a conta', 'success');
        setEmail('');
        setPassword('');
        setPlayerName('');
        switchMode('login');
      } else {
        // Login automático
        console.log('✅ Utilizador logado automaticamente');
        showToast(t('auth.registerSuccess'), 'success');
      }
    } catch (error) {
      console.error('💥 Register Error:', error);
      if (error instanceof Error && error.message.toLowerCase().includes('already registered')) {
        setError(t('auth.emailAlreadyRegistered'));
      } else {
        setError(error instanceof Error ? error.message : t('common.loginError'));
      }
    } finally {
      setLoading(false);
    }
  }

  // === RECUPERAR PASSWORD ===
  async function handleResetPassword() {
    console.log('🔄 Iniciando recuperação de password...');
    
    if (!hasInternet) {
      setError('Sem conexão à internet');
      showToast('Sem conexão à internet', 'error');
      return;
    }
    
    if (!email) {
      setError(t('auth.emailRequired'));
      return;
    }

    if (!isValidEmail(email)) {
      setError(t('auth.invalidEmail'));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('📧 Enviando email de recuperação para:', email);
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'fut://auth/reset-password',
      });

      if (error) {
        console.error('❌ Erro ao enviar email de recuperação:', error);
        console.error('Código do erro:', error.status);
        console.error('Mensagem:', error.message);
        
        // Tratamento de erros específicos
        let errorMessage = error.message;
        
        if (error.status === 429 || error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = 'Muitas tentativas de recuperação. Aguarde 60 segundos e tente novamente.';
          console.warn('⏱️ Rate limit atingido - aguarde 60 segundos');
        } else if (error.message.includes('SMTP') || error.message.includes('email')) {
          errorMessage = 'Erro ao enviar email. Verifique a configuração SMTP no Supabase.';
        } else if (error.message.includes('User not found')) {
          errorMessage = 'Email não encontrado. Verifique se está correto.';
        }
        
        setError(errorMessage);
        showToast(errorMessage, 'error');
        return;
      }

      console.log('✅ Email de recuperação enviado com sucesso');
      console.log('Data:', data);
      showToast('Email de recuperação enviado! Verifique sua caixa de entrada.', 'success');
      setEmail('');
      switchMode('login');
    } catch (error) {
      console.error('💥 Erro crítico ao recuperar password:', error);
      setError(error instanceof Error ? error.message : t('common.loginError'));
      showToast(error instanceof Error ? error.message : 'Erro desconhecido', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Renderiza o título baseado no modo
  const getTitle = () => {
    switch (mode) {
      case 'login':
        return t('auth.title');
      case 'register':
        return t('auth.register');
      case 'resetPassword':
        return 'Recuperar Password';
      default:
        return t('auth.title');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={[styles.container, { backgroundColor: theme.primary }]}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Banner sem internet */}
        {!hasInternet && (
          <View style={styles.noInternetBanner}>
            <Text style={styles.noInternetText}>⚠️ Sem conexão à internet</Text>
          </View>
        )}
        
        {/* Header */}
        <View style={styles.headerContainer}>
          <Image 
            source={require('../assets/images/soccer_ball.png')}
            style={[styles.logo, { tintColor: theme.text }]}
          />
          <Text style={[styles.title, { color: theme.text }]}>{getTitle()}</Text>
        </View>

        {/* Form Container */}
        <View style={[styles.formContainer, { backgroundColor: theme.background }]}>
          {/* Botão voltar (se não estiver no modo login) */}
          {mode !== 'login' && (
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => switchMode('login')}
            >
              <ArrowLeft size={24} color={theme.primary} />
              <Text style={[styles.backButtonText, { color: theme.primary }]}>
                Voltar
              </Text>
            </TouchableOpacity>
          )}

          {/* Email */}
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: theme.inputBackground,
                color: theme.text,
              },
              error && email === '' && styles.inputError
            ]}
            placeholder={t('auth.email')}
            placeholderTextColor={theme.placeholderText}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          {/* Nome do Jogador (apenas no modo registo) */}
          {mode === 'register' && (
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: theme.inputBackground,
                  color: theme.text,
                },
                error && playerName === '' && styles.inputError
              ]}
              placeholder="Nome do Jogador"
              placeholderTextColor={theme.placeholderText}
              value={playerName}
              onChangeText={(text) => {
                setPlayerName(text);
                setError(null);
              }}
              autoCapitalize="words"
              editable={!loading}
            />
          )}

          {/* Password (apenas no login e registo) */}
          {mode !== 'resetPassword' && (
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  { 
                    backgroundColor: theme.inputBackground,
                    color: theme.text,
                  },
                  error && password === '' && styles.inputError
                ]}
                placeholder={t('auth.password')}
                placeholderTextColor={theme.placeholderText}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity 
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={24} color={theme.placeholderText} />
                ) : (
                  <Eye size={24} color={theme.placeholderText} />
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Mensagem de erro */}
          {error && (
            <Text style={[styles.errorText, { color: colors.dark.error }]}>{error}</Text>
          )}

          {/* Botões de ação */}
          {mode === 'login' && (
            <>
              <TouchableOpacity 
                style={[
                  styles.button,
                  { backgroundColor: theme.primary },
                  loading && styles.buttonDisabled
                ]} 
                onPress={handleLogin}
                disabled={loading}
              >
                <Text style={[styles.buttonText, { color: theme.text }]}>
                  {loading ? t('auth.loading') : t('auth.login')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.button,
                  styles.registerButton,
                  { 
                    backgroundColor: theme.background,
                    borderColor: theme.primary 
                  },
                  loading && styles.buttonDisabled
                ]}
                onPress={() => switchMode('register')}
                disabled={loading}
              >
                <Text style={[styles.buttonText, { color: theme.primary }]}>
                  {t('auth.register')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.forgotPassword}
                onPress={() => switchMode('resetPassword')}
                disabled={loading}
              >
                <Text style={[styles.forgotPasswordText, { color: theme.placeholderText }]}>
                  {t('auth.forgotPassword')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'register' && (
            <TouchableOpacity 
              style={[
                styles.button,
                { backgroundColor: theme.primary },
                loading && styles.buttonDisabled
              ]} 
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={[styles.buttonText, { color: theme.text }]}>
                {loading ? 'Criando conta...' : 'Criar Conta'}
              </Text>
            </TouchableOpacity>
          )}

          {mode === 'resetPassword' && (
            <TouchableOpacity 
              style={[
                styles.button,
                { backgroundColor: theme.primary },
                loading && styles.buttonDisabled
              ]} 
              onPress={handleResetPassword}
              disabled={loading}
            >
              <Text style={[styles.buttonText, { color: theme.text }]}>
                {loading ? 'Enviando...' : 'Enviar Email de Recuperação'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Seletor de idioma */}
          <View style={styles.languageContainer}>
            <TouchableOpacity 
              style={styles.languageButton}
              onPress={toggleLanguageMenu}
            >
              <Globe size={20} color={theme.primary} />
              <Text style={[styles.languageButtonText, { color: theme.primary }]}>
                {t('common.changeLanguage')}
              </Text>
            </TouchableOpacity>

            {showLanguageMenu && (
              <View style={[styles.languageMenu, { backgroundColor: theme.cardBackground }]}>
                <TouchableOpacity 
                  style={[
                    styles.languageOption, 
                    language === 'pt' && { backgroundColor: theme.primary }
                  ]}
                  onPress={() => changeLanguage('pt')}
                >
                  <Text style={[
                    styles.languageOptionText, 
                    { color: language === 'pt' ? theme.text : theme.text }
                  ]}>
                    {t('common.portuguese')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.languageOption, 
                    language === 'en' && { backgroundColor: theme.primary }
                  ]}
                  onPress={() => changeLanguage('en')}
                >
                  <Text style={[
                    styles.languageOptionText, 
                    { color: language === 'en' ? theme.text : theme.text }
                  ]}>
                    {t('common.english')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <Toast
          visible={toastConfig.visible}
          message={toastConfig.message}
          type={toastConfig.type}
          onHide={hideToast}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  formContainer: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 8,
  },
  input: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  inputError: {
    borderWidth: 1,
    borderColor: colors.dark.error,
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  passwordInput: {
    paddingRight: 50,
    marginBottom: 0,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 13,
  },
  button: {
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  registerButton: {
    borderWidth: 2,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    marginBottom: 16,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  languageContainer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    alignItems: 'flex-end',
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  languageButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  languageMenu: {
    position: 'absolute',
    bottom: 50,
    right: 0,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  languageOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 150,
  },
  languageOptionText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  noInternetBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f44336',
    padding: 12,
    zIndex: 1000,
    alignItems: 'center',
  },
  noInternetText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
