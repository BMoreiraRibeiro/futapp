import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Pressable } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Toast } from '../components/Toast';
import { Eye, EyeOff, Globe } from 'lucide-react-native';
import { useTheme } from '../lib/theme';
import { colors } from '../lib/colors';
import { useLanguage } from '../lib/language';
import NetInfo from '@react-native-community/netinfo';

export default function AuthScreen() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const { t, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

    // Verifica conexão inicial
    NetInfo.fetch().then(state => {
      const isConnected = state.isConnected && state.isInternetReachable !== false;
      setHasInternet(isConnected ?? false);
    });

    return () => unsubscribe();
  }, []);

  // IMPORTANTE: Em vez de usar router.replace dentro de um useEffect,
  // usamos o componente Redirect quando o usuário já está autenticado
  if (session) {
    // Isso renderiza o redirecionamento de forma declarativa, sem causar erros
    return <Redirect href="/(tabs)" />;
  }

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

  // Validação de email
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validação de senha
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
  async function signIn(email: string, password: string) {
    // Verifica se tem internet antes de tentar fazer login
    if (!hasInternet) {
      setError('Sem conexão à internet. Verifique sua conexão e tente novamente.');
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
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError(t('auth.invalidCredentials'));
          return;
        }
        throw error;
      }

      if (data?.user && !data.user.email_confirmed_at) {
        console.warn('⚠️ Auth: Email não verificado');
        await supabase.auth.signOut();
        setError(t('auth.emailNotVerified'));
        showToast(t('auth.emailVerificationSent'), 'info');
        await supabase.auth.resend({
          type: 'signup',
          email: email,
        });
        return;
      }

      console.warn('✅ Auth: Login realizado com sucesso');
      showToast(t('auth.loginSuccess'), 'success');
    } catch (error) {
      setError(error instanceof Error ? error.message : t('common.loginError'));
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSignIn = async () => {
    if (!isValidEmail(email)) {
      showToast(t('auth.invalidEmail'), 'error');
      return;
    }

    if (!isValidPassword(password)) {
      showToast(t('auth.invalidPassword'), 'error');
      return;
    }

    try {
      await signIn(email, password);
    } catch (error) {
      console.error('💥 Auth: Erro no login:', error);
      showToast(error instanceof Error ? error.message : t('common.loginError'), 'error');
    }
  };

  async function signUp() {
    console.warn('🔄 Auth: Iniciando processo de registro...');
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
      
      console.warn('🔌 Auth: Tentando criar nova conta...');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'fut://auth/callback',
          data: {
            email_confirmed: false,
            created_at: new Date().toISOString(),
            last_sign_in: null
          }
        }
      });

      // Se houver erro, verifica se é porque o usuário já existe
      if (error) {
        console.warn('❌ Auth: Erro no registro:', error.message);
        if (error.message.toLowerCase().includes('user already registered')) {
          setError(t('auth.emailAlreadyRegistered'));
          return;
        }
        if (error.message.includes('password')) {
          setError(t('auth.invalidPassword'));
          return;
        }
        throw error;
      }

      // Se não houver erro, verifica se o usuário foi realmente criado
      // Quando email_confirmations está ativado, o Supabase retorna um objeto user
      // com identities vazio se o email já existir
      if (!data.user?.identities || data.user.identities.length === 0) {
        console.warn('⚠️ Auth: Email já cadastrado (identities vazio)');
        setError(t('auth.emailAlreadyRegistered'));
        return;
      }

      // Se chegou aqui, o usuário foi criado com sucesso
      console.warn('✅ Auth: Conta criada com sucesso');
      
      // Se email_confirmations estiver ativado, data.session será null
      if (!data.session) {
        console.warn('📧 Auth: Email de confirmação enviado');
        showToast(t('auth.emailVerificationSent'), 'success');
        setEmail('');
        setPassword('');
      } else {
        // Se email_confirmations estiver desativado, o usuário será logado automaticamente
        console.warn('✅ Auth: Usuário logado automaticamente');
        showToast(t('auth.registerSuccess'), 'success');
      }
    } catch (error) {
      console.error('Error:', error);
      if (error instanceof Error && error.message.toLowerCase().includes('already registered')) {
        setError(t('auth.emailAlreadyRegistered'));
      } else {
        setError(error instanceof Error ? error.message : t('common.loginError'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
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

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'fut://auth/reset-password',
      });

      if (error) throw error;

      showToast(t('auth.resetPasswordSent'), 'success');
    } catch (error) {
      setError(error instanceof Error ? error.message : t('common.loginError'));
    } finally {
      setLoading(false);
    }
  }
  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      {/* Indicador de conectividade */}
      {!hasInternet && (
        <View style={styles.noInternetBanner}>
          <Text style={styles.noInternetText}>⚠️ Sem conexão à internet</Text>
        </View>
      )}
      
      <View style={styles.headerContainer}>
        <Image 
          source={require('../assets/images/soccer_ball.png')}
          style={[styles.logo, { tintColor: theme.text }]}
        />
        <Text style={[styles.title, { color: theme.text }]}>{t('auth.title')}</Text>
      </View>

      <View style={[styles.formContainer, { backgroundColor: theme.background }]}>
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

        {error && (
          <Text style={[styles.errorText, { color: colors.dark.error }]}>{error}</Text>
        )}

        <TouchableOpacity 
          style={[
            styles.button,
            { backgroundColor: theme.primary },
            loading && styles.buttonDisabled
          ]} 
          onPress={handleSignIn}
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
          onPress={signUp}
          disabled={loading}
        >
          <Text style={[styles.buttonText, { color: theme.primary }]}>
            {loading ? t('auth.loading') : t('auth.register')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.forgotPassword}
          onPress={resetPassword}
          disabled={loading}
        >
          <Text style={[styles.forgotPasswordText, { color: theme.placeholderText }]}>
            {t('auth.forgotPassword')}
          </Text>
        </TouchableOpacity>

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
    </View>
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
  },  languageOption: {
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