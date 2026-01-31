import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Toast } from '../components/Toast';
import { Eye, EyeOff, Globe, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../lib/theme';
import { colors } from '../lib/colors';
import { useLanguage } from '../lib/language';
import NetInfo from '@react-native-community/netinfo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Necessário para o fluxo OAuth no mobile
WebBrowser.maybeCompleteAuthSession();

// Helper to attempt to close auth/browser sessions in a robust way.
async function safeCloseBrowser(label: string) {
  try {
    await WebBrowser.dismissAuthSession();
    console.log(`🔒 ${label}: dismissed auth session`);
  } catch (e) {
    console.log(`⚠️ ${label}: dismissAuthSession failed:`, e);
  }

  try {
    await WebBrowser.coolDownAsync();
    console.log(`🔒 ${label}: coolDownAsync success`);
  } catch (e) {
    console.log(`⚠️ ${label}: coolDownAsync failed:`, e);
  }
  // Note: dismissBrowser may be unavailable on Android; prefer coolDownAsync + dismissAuthSession.
}

// Mutex para evitar double-exchange de authorization code
let __isExchanging = false;
async function runWithExchangeLock<T>(fn: () => Promise<T>) {
  const start = Date.now();
  while (__isExchanging) {
    if (Date.now() - start > 5000) break;
    await new Promise(res => setTimeout(res, 50));
  }

  if (__isExchanging) {
    throw new Error('exchange locked');
  }

  try {
    __isExchanging = true;
    return await fn();
  } finally {
    __isExchanging = false;
  }
}

// Track codes that were already exchanged to avoid duplicate exchanges across handlers
const __handledAuthCodes = new Set<string>();

// Configurar listener para deep links OAuth
const handleDeepLink = async (event: { url: string }) => {
  const { url } = event;

  try {
    // Primeiro verificar se recebemos um code (PKCE authorization code flow)
    let code: string | null = null;

    if (url.includes('?')) {
      const query = url.split('?')[1];
      const params = new URLSearchParams(query);
      code = params.get('code');
    }

    if (!code && url.includes('#')) {
      const fragment = url.split('#')[1];
      const params = new URLSearchParams(fragment);
      code = params.get('code');
    }

    if (code) {
      console.log('🔁 deep-link: received code, exchanging for session');
      
      // CRÍTICO: Verificar se já processámos este código
      if (__handledAuthCodes.has(code)) {
        console.log('⏭️ Code already processed, skipping exchange:', code.substring(0, 8) + '...');
        // Centralized safe close
        safeCloseBrowser('already-processed');

        // forced retry attempts
        setTimeout(() => safeCloseBrowser('already-processed (retry 500ms)'), 500);
        // another delayed attempt in case device needs more time
        setTimeout(() => safeCloseBrowser('already-processed (retry 1200ms)'), 1200);
        return;
      }

      // Verificar se já temos uma sessão ativa
      try {
        await WebBrowser.warmUpAsync();
        const { data: existingSession } = await supabase.auth.getSession();
        if (existingSession?.session) {
          console.log('✅ Session already exists, marking code as handled');
          __handledAuthCodes.add(code);
          // Centralized safe close for existing session path
          safeCloseBrowser('deep-link existing-session');
          setTimeout(() => safeCloseBrowser('deep-link existing-session (retry 500ms)'), 500);
          setTimeout(() => safeCloseBrowser('deep-link existing-session (retry 1200ms)'), 1200);
          return;
        }
      } catch (sessErr) {
        console.log('⚠️ Error checking existing session:', sessErr);
      }

      try {
        // Marcar código como "em processamento" ANTES de fazer exchange
        __handledAuthCodes.add(code);

        // Fazer exchange UMA ÚNICA VEZ com o mutex para evitar concorrência
        const { data, error } = await runWithExchangeLock(() => 
          supabase.auth.exchangeCodeForSession(code)
        );

        if (error) {
          console.error('❌ exchangeCodeForSession error:', error);
          // Se falhar, remover do set para permitir nova tentativa manual
          __handledAuthCodes.delete(code);
          } else {
          console.log('✅ Session established via exchangeCodeForSession');
          // Centralized safe close for exchange success path
          safeCloseBrowser('deep-link exchange-success');
          setTimeout(() => safeCloseBrowser('deep-link exchange-success (retry 500ms)'), 500);
          setTimeout(() => safeCloseBrowser('deep-link exchange-success (retry 1200ms)'), 1200);
        }
      } catch (ex) {
        console.error('❌ exception during exchangeCodeForSession:', ex);
        // Se falhar, remover do set para permitir nova tentativa manual
        __handledAuthCodes.delete(code);
      }
      return;
    }

    // Fallback: implicit/fragment flow where access_token is present
    if (url.includes('#access_token=')) {
      const params = new URLSearchParams(url.split('#')[1]);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (access_token) {
        await supabase.auth.setSession({
          access_token,
          refresh_token: refresh_token || '',
        });
      }
    }
  } catch (e) {
    console.error('Erro no handleDeepLink:', e);
  }
};

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
  const [newPassword, setNewPassword] = useState('');
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
  const [ticketFromLink, setTicketFromLink] = useState<string | undefined>(undefined);

  const searchParams = useLocalSearchParams();

  // Detect ticket from initial Linking URL
  useEffect(() => {
    (async () => {
      try {
        const initial = await Linking.getInitialURL();
        if (initial) {
          const [, hash] = initial.split('#');
          const query = hash || (initial.includes('?') ? initial.split('?')[1] : '');
          if (query) {
            const params = Object.fromEntries(new URLSearchParams(query));
            if (params.ticket) setTicketFromLink(params.ticket as string);
          }
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // Accept ticket via router search params
  useEffect(() => {
    try {
      if (searchParams && (searchParams as any).ticket) {
        setTicketFromLink((searchParams as any).ticket as string);
        setMode('resetPassword');
      }
    } catch (e) {
      // ignore
    }
  }, [searchParams]);

  // Verifica conectividade
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

    // Adicionar listener para deep links OAuth
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (ticketFromLink) setMode('resetPassword');
  }, [ticketFromLink]);

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

  // === LOGIN COM GOOGLE ===
  async function handleGoogleLogin() {
    if (!hasInternet) {
      setError('Sem conexão à internet');
      showToast('Sem conexão à internet', 'error');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Detectar se está na web ou mobile
      const isWeb = Platform.OS === 'web';
      
      // Na web, redirecionar para a página principal do Netlify
      // No mobile, usar deep link
      const redirectUrl = isWeb 
        ? 'https://futbeer.netlify.app/' 
        : 'futapp://auth';
      
      console.log(`📱 Redirect URL (${isWeb ? 'web' : 'mobile'}):`, redirectUrl);

      // Iniciar fluxo OAuth
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false, // Não pular redirect em ambos os casos
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        console.error('❌ Erro ao iniciar OAuth:', error.message);
        setError('Erro ao fazer login com Google');
        showToast('Erro ao fazer login com Google', 'error');
        return;
      }

      console.log('🔗 URL OAuth gerada:', data?.url);

      // MOBILE: Abrir browser externo para autenticação
      // O retorno será tratado pelo deep-link listener (handleDeepLink)
      if (!isWeb && data?.url) {
        await WebBrowser.openBrowserAsync(data.url);
      }
      
      // WEB: O Supabase já redireciona automaticamente o browser
      // Quando retornar à página, a sessão estará ativa e vamos verificar identities
      
    } catch (error: any) {
      console.error('💥 Erro crítico no login Google:', error);
      setError(error?.message || 'Erro ao fazer login com Google');
      showToast('Erro ao fazer login com Google', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Verificar se o utilizador tem múltiplas identities (contas unificadas)
  useEffect(() => {
    const checkLinkedIdentities = async () => {
      try {
        // Buscar sessão atual
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession?.user) {
          // Buscar todas as identidades do utilizador
          const response = await supabase.auth.getUserIdentities();
          
          if (!response.error && response.data && response.data.identities && response.data.identities.length > 1) {
            const identities = response.data.identities;
            // Utilizador tem mais de uma identidade - contas foram unificadas
            const providers = identities.map((identity: any) => identity.provider).join(' e ');
            console.log('🔗 Contas unificadas detectadas:', providers);
            
            // Verificar se acabou de fazer login com Google e já tinha email
            const hasGoogle = identities.some((identity: any) => identity.provider === 'google');
            const hasEmail = identities.some((identity: any) => identity.provider === 'email');
            
            if (hasGoogle && hasEmail) {
              showToast('Contas unificadas! Agora podes fazer login com Google ou email/password.', 'success');
            }
          }
        }
      } catch (err) {
        console.error('Erro ao verificar identidades:', err);
      }
    };

    // Verificar identidades após login
    checkLinkedIdentities();
  }, [session]);

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
        const rawMessage = error?.message || String(error);
        console.error('❌ Erro no login:', rawMessage);

        let errorMessage = rawMessage;
        if (error?.status === 429 || rawMessage.includes('rate limit') || rawMessage.includes('429')) {
          errorMessage = 'Muitas tentativas de login. Aguarde 60 segundos e tente novamente.';
        } else if (rawMessage.includes('Invalid login credentials')) {
          errorMessage = t('auth.invalidCredentials');
        } else if (rawMessage.includes('Email not confirmed')) {
          errorMessage = t('auth.emailNotConfirmed');
          showToast(t('auth.emailNotConfirmed'), 'error');
        }

        setError(errorMessage);
        showToast(errorMessage, 'error');
        return;
      }

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
          emailRedirectTo: 'https://futbeer.netlify.app/email-callback.html',
          data: {
            player_name: playerName.trim()
          }
        }
      });

      if (error) {
        console.error('❌ Erro no registo:', error.message);
        
        let errorMessage = error.message;
        
        if (error.status === 429 || error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = 'Muitas tentativas de registo. Aguarde 60 segundos e tente novamente.';
        } else if (error.message.toLowerCase().includes('user already registered')) {
          errorMessage = t('auth.emailAlreadyRegistered');
        } else if (error.message.includes('password')) {
          errorMessage = t('auth.invalidPassword');
        }
        
        setError(errorMessage);
        showToast(errorMessage, 'error');
        return;
      }

      if (!data.user?.identities || data.user.identities.length === 0) {
        setError(t('auth.emailAlreadyRegistered'));
        return;
      }

      if (!data.session) {
        showToast('Verifique seu email para confirmar a conta', 'success');
        setEmail('');
        setPassword('');
        setPlayerName('');
        switchMode('login');
      } else {
        showToast(t('auth.registerSuccess'), 'success');
      }
    } catch (error: any) {
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

      let res = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://futbeer.netlify.app/reset-password.html',
      });

      let { data, error } = res;

      if (error) {
        console.error('❌ Erro ao enviar email de recuperação:', error);
        
        let errorMessage = error.message;
        
        if (error.status === 429 || error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = 'Muitas tentativas de recuperação. Aguarde 60 segundos e tente novamente.';
        } else if (error.message.includes('SMTP') || error.message.includes('email')) {
          errorMessage = 'Erro ao enviar email. Verifique a configuração SMTP no Supabase.';
        } else if (error.message.includes('User not found')) {
          errorMessage = 'Email não encontrado. Verifique se está correto.';
        }
        
        setError(errorMessage);
        showToast(errorMessage, 'error');
        return;
      }

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

          {/* Reset password UI */}
          {ticketFromLink ? (
            <>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.inputBackground, color: theme.text }
                ]}
                placeholder={'Nova password'}
                placeholderTextColor={theme.placeholderText}
                secureTextEntry={!showPassword}
                value={newPassword}
                onChangeText={(txt) => setNewPassword(txt)}
              />
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={async () => {
                  if (!newPassword || newPassword.length < 6) {
                    showToast('A password deve ter pelo menos 6 caracteres', 'error');
                    return;
                  }

                  setLoading(true);
                  try {
                    if (session) {
                      const { error } = await supabase.auth.updateUser({ password: newPassword });
                      if (error) {
                        showToast('Erro ao atualizar password: ' + error.message, 'error');
                      } else {
                        showToast('Password atualizada com sucesso', 'success');
                        setNewPassword('');
                        switchMode('login');
                      }
                    } else {
                      showToast('Abra o link do email na app para finalizar a redefinição', 'info');
                    }
                  } catch (e) {
                    showToast('Erro desconhecido ao atualizar password', 'error');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <Text style={[styles.primaryButtonText, { color: '#fff' }]}>Alterar password</Text>
              </TouchableOpacity>
            </>
          ) : null}

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

          {error && (
            <Text style={[styles.errorText, { color: colors.dark.error }]}>{error}</Text>
          )}

          {/* Botões de ação */}
          {mode === 'login' && (
            <>
              {/* Botão Google */}
              <TouchableOpacity 
                style={[
                  styles.googleButton,
                  loading && styles.buttonDisabled
                ]} 
                onPress={handleGoogleLogin}
                disabled={loading}
              >
                <Image 
                  source={{ uri: 'https://www.google.com/favicon.ico' }}
                  style={styles.googleIcon}
                />
                <Text style={styles.googleButtonText}>
                  Continuar com Google
                </Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <Text style={[styles.dividerText, { color: theme.placeholderText }]}>ou</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>

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

          {mode === 'resetPassword' && !ticketFromLink && (
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
  googleButton: {
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#dadce0',
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#3c4043',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
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
  primaryButton: {
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});