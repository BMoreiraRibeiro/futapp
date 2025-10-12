import React, { useEffect, useState, useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, Animated, Image, Platform } from 'react-native';
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
import Constants from 'expo-constants';
import * as NavigationBar from 'expo-navigation-bar';

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
          source={require('../assets/images/soccer_ball.png')}
          style={styles.splashIcon}
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
  
  // Esconde a barra de navegação do Android
  useEffect(() => {
    const hideNavigationBar = async () => {
      try {
        if (Platform.OS === 'android') {
          // Apenas esconde a barra - outras funções não são suportadas em edge-to-edge
          await NavigationBar.setVisibilityAsync('hidden');
        }
      } catch (error) {
        console.log('Erro ao configurar barra de navegação:', error);
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

  useEffect(() => {
    const validateAuth = async () => {
      try {
        console.log('🔍 validateAuth - Iniciando validação. isInitializing:', isInitializing, 'isAuthenticated:', isAuthenticated, 'hasCluster:', hasCluster);
        
        // Aguarda o AuthProvider terminar de inicializar
        if (isInitializing) {
          console.log('⏳ validateAuth - Ainda inicializando, aguardando...');
          return;
        }

        setIsValidating(true);

        // 1. Verificar se tem internet
        if (!hasInternet) {
          console.log('📡 validateAuth - Sem internet');
          setIsValidating(false);
          return;
        }

        // 2. Verificar se tem sessão válida
        if (!session || !isSessionValid()) {
          console.log('🚫 validateAuth - Sessão inválida ou inexistente');
          setShouldRedirectToAuth(true);
          setShowClusterModal(false); // Esconde o modal ao redirecionar para auth
          setIsValidating(false);
          return;
        }

        // 3. Se autenticado, verificar cluster
        if (isAuthenticated && session?.user.id) {
          console.log('✅ validateAuth - Usuário autenticado, verificando cluster...');
          
          // Verifica se o usuário já é membro de algum cluster
          const { data: member, error } = await supabase
            .from('cluster_members')
            .select('cluster_id')
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

          const hasExistingCluster = !!member;
          console.log('🔍 validateAuth - Cluster encontrado?', hasExistingCluster, 'Data:', member);

          if (hasExistingCluster) {
            console.log('✅ validateAuth - Utilizador com cluster, escondendo modal');
            setShowClusterModal(false); // Garante que o modal está escondido
            await updateClusterState();
          } else {
            console.log('📋 validateAuth - Utilizador sem cluster, mostrando ClusterModal');
            setShowClusterModal(true); // Mostra o modal sempre que não há cluster
          }
        } else {
          console.log('🚫 validateAuth - Não autenticado');
          setShouldRedirectToAuth(true);
          setShowClusterModal(false);
        }
      } catch (error) {
        console.error('❌ validateAuth - Erro na validação:', error);
        setShouldRedirectToAuth(true);
        setShowClusterModal(false);
      } finally {
        console.log('🏁 validateAuth - Validação concluída');
        setIsValidating(false);
      }
    };

    validateAuth();
  }, [isAuthenticated, session, hasInternet, isInitializing]);

  const handleClusterCreated = async () => {
    console.log('🎉 Cluster criado/associado, atualizando estado');
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
    return <NoInternetModal visible={showNoInternetModal} onRetry={handleRetryConnection} />;
  }

  // Mostra o CustomSplashScreen enquanto está inicializando ou validando
  if (isInitializing || isValidating) {
    return <CustomSplashScreen message={isInitializing ? "Carregando..." : "Validando sessão..."} />;
  }

  // Em vez de usar router.replace, decidimos qual tela mostrar usando condicionais
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
        
        {/* Mostra o ClusterModal se estiver marcado para mostrar E tiver sessão */}
        {session && showClusterModal && !shouldRedirectToAuth && (
          <ClusterModal
            visible={showClusterModal}
            userId={session.user.id}
            onComplete={handleClusterCreated}
          />
        )}
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
  const [hasInternetConnection, setHasInternetConnection] = useState(true);
  const [showNoInternet, setShowNoInternet] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // 1. Verifica conectividade à internet
        const netInfoState = await NetInfo.fetch();
        const isConnected = netInfoState.isConnected && netInfoState.isInternetReachable !== false;
        
        if (!isConnected) {
          setHasInternetConnection(false);
          setShowNoInternet(true);
          setIsLoading(false);
          setAppIsReady(false);
          return;
        }

        // 2. Testa a conexão com o Supabase
        const { data, error } = await supabase.auth.getSession();
        
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
      setHasInternetConnection(true);
      setShowNoInternet(false);
      setIsLoading(true);
      
      // Reinicia a preparação
      try {
        const { data, error } = await supabase.auth.getSession();
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
    marginBottom: 20,
  },
  splashIcon: {
    width: 80,
    height: 80,
    tintColor: '#ffffff',
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
  },
});