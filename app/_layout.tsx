import { useEffect, useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Animated, Image, Platform } from 'react-native';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { ThemeProvider } from '../lib/theme';
import { ClusterModal } from '../components/ClusterModal';
import { NoInternetModal } from '../components/NoInternetModal';
import { ResultsProvider } from '../lib/results';
import { LanguageProvider } from '../lib/language';
import * as SplashScreen from 'expo-splash-screen';
import NetInfo from '@react-native-community/netinfo';

import * as NavigationBar from 'expo-navigation-bar';
import useAuthDeepLinkHandler from '../hooks/useAuthDeepLinkHandler';

// Impede o escondimento automático do SplashScreen
SplashScreen.preventAutoHideAsync().catch((error) => console.warn(error));

function CustomSplashScreen({ message }: { message?: string }) {
  const [rotation] = useState(new Animated.Value(0));
  const [scale] = useState(new Animated.Value(0.3));
  const [opacity] = useState(new Animated.Value(0));
  const [loadingText, setLoadingText] = useState(message || 'Carregando...');

  useEffect(() => {
    if (message) {
      setLoadingText(message);
    }
  }, [message]);

  useEffect(() => {
    const startAnimations = () => {
      Animated.parallel([
        Animated.timing(rotation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    };

    startAnimations();

    // Reiniciar a animação a cada 2 segundos
    const rotationInterval = setInterval(() => {
      rotation.setValue(0);
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    }, 2000);

    return () => {
      clearInterval(rotationInterval);
    };
  }, [rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.splashContainer}>
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [{ rotate: spin }, { scale }],
            opacity
          },
        ]}>
        <Image 
          source={require('../assets/images/icon.png')}
          style={styles.splashIcon}
          resizeMode="contain"
        />
      </Animated.View>
      <Animated.Text style={[styles.splashText, { opacity }]}>
        Futebol às quartas
      </Animated.Text>
      <Animated.Text style={[styles.loadingText, { opacity }]}>
        {loadingText}
      </Animated.Text>
    </View>
  );
}

function RootLayoutNav() {
  const { isAuthenticated, session, hasCluster, clusterName, updateClusterState, isSessionValid, isInitializing } = useAuth();
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [shouldRedirectToAuth, setShouldRedirectToAuth] = useState(false);
  const [hasInternet, setHasInternet] = useState(true);
  const [showNoInternetModal, setShowNoInternetModal] = useState(false);
  
  // 🔍 MONITOR: Rastreia mudanças nos estados do Auth
  useEffect(() => {
    // Auth states monitoring removed for production
  }, [isAuthenticated, hasCluster, clusterName, session, showClusterModal, isValidating, shouldRedirectToAuth]);

  // 🔍 MONITOR: Detecta quando hasCluster muda
  useEffect(() => {
    // hasCluster change monitoring removed for production
  }, [hasCluster]);
  
  // Esconde a barra de navegação do Android
  useEffect(() => {
    const hideNavigationBar = async () => {
      try {
        if (Platform.OS === 'android') {
          // Apenas esconde a barra - outras funções não são suportadas em edge-to-edge
          await NavigationBar.setVisibilityAsync('hidden');
        }
      } catch (error) {
        // Navigation bar configuration error removed for production
      }
    };
    
    hideNavigationBar();
  }, []);
  
  // Verifica conectividade à internet
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected && state.isInternetReachable !== false;
      setHasInternet(isConnected ?? false);
      
      if (!isConnected) {
        setShowNoInternetModal(true);
      } else {
        setShowNoInternetModal(false);
      }
    });

    // Verifica conexão inicial
    NetInfo.fetch().then(state => {
      const isConnected = state.isConnected && state.isInternetReachable !== false;
      setHasInternet(isConnected ?? false);
      
      if (!isConnected) {
        setShowNoInternetModal(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Hook para capturar deep links de auth (confirm / reset)
  useAuthDeepLinkHandler();

  useEffect(() => {
    const validateAuth = async () => {
      try {
        // Validation started - logs removed for production
        
        // Aguarda o AuthProvider terminar de inicializar
        if (isInitializing) {
          // Still initializing - logs removed for production
          return;
        }

        // IMPORTANTE: Sempre iniciar como "validando" para evitar flash de conteúdo
        setIsValidating(true);

        // 1. Verificar se tem internet
        if (!hasInternet) {
          // No internet - logs removed for production
          setIsValidating(false);
          return;
        }

        // 2. Verificar se tem sessão válida
        if (!session || !isSessionValid()) {
          // Invalid session - logs removed for production
          setShouldRedirectToAuth(true);
          setShowClusterModal(false); // Esconde o modal ao redirecionar para auth
          setIsValidating(false);
          return;
        }

        // 3. Se autenticado, verificar cluster
        if (isAuthenticated && session?.user.id) {
          // User authenticated, checking cluster - logs removed for production
          
          // Adicionar pequeno delay para evitar flash visual
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Verifica se o usuário já é membro de algum cluster
          const { data: member, error } = await supabase
            .from('cluster_members')
            .select('cluster_uuid')
            .eq('user_id', session.user.id)
            .maybeSingle(); // Usa maybeSingle() em vez de single() para evitar erro quando não há resultados

          // Se houver erro E não for "nenhum resultado encontrado"
          if (error && error.code !== 'PGRST116') {
            console.error('❌ validateAuth - Erro ao verificar cluster:', error);
            setShouldRedirectToAuth(true);
            setShowClusterModal(false);
            setIsValidating(false);
            return;
          }

          let hasValidCluster = false;

          // Se tem um member, verificar se o cluster ainda existe
          if (member) {
            // Member found, checking cluster existence - logs removed for production
            const { data: cluster, error: clusterError } = await supabase
              .from('clusters')
              .select('cluster_uuid')
              .eq('cluster_uuid', member.cluster_uuid)
              .maybeSingle();

            if (clusterError && clusterError.code !== 'PGRST116') {
              console.error('❌ validateAuth - Erro ao verificar cluster:', clusterError);
            }

            if (cluster) {
              hasValidCluster = true;
              // Valid cluster found - logs removed for production
            } else {
              console.warn('⚠️ validateAuth - Cluster não existe mais, limpando member órfão...');
              // Cluster não existe mais, limpar o member órfão
              await supabase
                .from('cluster_members')
                .delete()
                .eq('user_id', session.user.id);
            }
          }

          // Cluster validation check - logs removed for production

          if (hasValidCluster) {
            // User has cluster, hiding modal - logs removed for production
            setShowClusterModal(false); // Garante que o modal está escondido
            setShouldRedirectToAuth(false); // CRÍTICO: Garante que não redireciona
            await updateClusterState();
          } else {
            // User without cluster, showing modal - logs removed for production
            setShowClusterModal(true); // Mostra o modal sempre que não há cluster
            setShouldRedirectToAuth(false); // CRÍTICO: Não deve redirecionar para auth, apenas mostrar modal
          }
        } else {
          // Not authenticated - logs removed for production
          setShouldRedirectToAuth(true);
          setShowClusterModal(false);
        }
      } catch (error) {
        console.error('❌ validateAuth - Erro na validação:', error);
        setShouldRedirectToAuth(true);
        setShowClusterModal(false);
      } finally {
        // Validation completed - logs removed for production
        setIsValidating(false);
      }
    };

    validateAuth();
  }, [isAuthenticated, session, hasInternet, isInitializing]);

  const handleClusterCreated = async () => {
    // Cluster created/associated, updating state - logs removed for production
    setShowClusterModal(false);
    // Atualiza o estado do cluster após criação/associação
    await updateClusterState();
  };

  const handleRetryConnection = async () => {
    const state = await NetInfo.fetch();
    const isConnected = state.isConnected && state.isInternetReachable !== false;
    
    if (isConnected) {
      setHasInternet(true);
      setShowNoInternetModal(false);
    }
  };

  // Mostra modal de sem internet
  if (showNoInternetModal) {
    // Showing NoInternetModal - logs removed for production
    return <NoInternetModal visible={showNoInternetModal} onRetry={handleRetryConnection} />;
  }

  // Mostra o CustomSplashScreen enquanto está inicializando ou validando
  if (isInitializing || isValidating) {
    // Showing SplashScreen - logs removed for production
    return <CustomSplashScreen message={isInitializing ? "Carregando..." : "Validando sessão..."} />;
  }

  // CRÍTICO: Se está autenticado MAS não tem cluster, mostra APENAS o ClusterModal
  // NÃO renderizar Stack ou tabs quando showClusterModal está true
  if (isAuthenticated && !shouldRedirectToAuth && showClusterModal && session) {
    // Rendering only ClusterModal - logs removed for production
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ClusterModal
          visible={showClusterModal}
          userId={session.user.id}
          onComplete={handleClusterCreated}
          initialMode="join"
        />
      </View>
    );
  }

  // VERIFICAÇÃO ADICIONAL: Se não tem cluster válido, NÃO renderizar as tabs
  if (isAuthenticated && !hasCluster && !showClusterModal) {
    // Inconsistent state detected - logs removed for production
    // Força re-validação
    setIsValidating(true);
    return <CustomSplashScreen message="Re-validando..." />;
  }

  // Em vez de usar router.replace, decidimos qual tela mostrar usando condicionais
  // Rendering Stack - logs removed for production
  return (
    <ResultsProvider>
      <>
        <Stack screenOptions={{ headerShown: false }}>
          {shouldRedirectToAuth || !isAuthenticated ? (
            <Stack.Screen 
              name="auth" 
              options={{ 
                headerShown: false,
                gestureEnabled: false
              }} 
            />
          ) : (
            <Stack.Screen 
              name="(tabs)" 
              options={{ 
                headerShown: false,
                gestureEnabled: false
              }} 
            />
          )}
          <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
        </Stack>
        <StatusBar style="light" />
      </>
    </ResultsProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [appIsReady, setAppIsReady] = useState(false);
  const [showNoInternet, setShowNoInternet] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // 1. Verifica conectividade à internet
        const netInfoState = await NetInfo.fetch();
        const isConnected = netInfoState.isConnected && netInfoState.isInternetReachable !== false;
        
        if (!isConnected) {
          setShowNoInternet(true);
          setIsLoading(false);
          setAppIsReady(false);
          return;
        }

        // 2. Testa a conexão com o Supabase
        const { error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erro ao conectar com Supabase:', error.message);
        }
        
        // 3. Garantimos um tempo mínimo na splash screen para uma boa experiência
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.error('Erro na preparação da aplicação:', e);
      } finally {
        setIsLoading(false);
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const handleRetryConnection = async () => {
    const state = await NetInfo.fetch();
    const isConnected = state.isConnected && state.isInternetReachable !== false;
    
    if (isConnected) {
      setShowNoInternet(false);
      setIsLoading(true);
      
      // Reinicia a preparação
      try {
        const { error } = await supabase.auth.getSession();
        if (error) {
          console.error('Erro ao conectar com Supabase:', error.message);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.error('Erro na preparação:', e);
      } finally {
        setIsLoading(false);
        setAppIsReady(true);
      }
    }
  };

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady, fontsLoaded]);

  // Mostra modal de sem internet
  if (showNoInternet) {
    return <NoInternetModal visible={showNoInternet} onRetry={handleRetryConnection} />;
  }

  if (!appIsReady || !fontsLoaded || isLoading) {
    return <CustomSplashScreen />;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#1a472a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 30,
  },
  splashIcon: {
    width: 120,
    height: 120,
  },
  splashText: {
    color: '#ffffff',
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    opacity: 0.8,
  },
});