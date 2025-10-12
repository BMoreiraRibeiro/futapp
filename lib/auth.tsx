import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from './language';

type AuthContextType = {
  session: Session | null;
  isAuthenticated: boolean;
  hasCluster: boolean;
  clusterName: string | null;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  updateClusterState: () => Promise<void>;
  isSessionValid: () => boolean;
  isInitializing: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  isAuthenticated: false,
  hasCluster: false,
  clusterName: null,
  isAdmin: false,
  signOut: async () => {},
  updateClusterState: async () => {},
  isSessionValid: () => false,
  isInitializing: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasCluster, setHasCluster] = useState(false);
  const [clusterName, setClusterName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const { t } = useLanguage();

  const clearSessionData = async () => {
    try {
      console.log('🧹 clearSessionData - Limpando todos os dados da sessão');
      setSession(null);
      setIsAuthenticated(false);
      setHasCluster(false);
      setClusterName(null);
      setIsAdmin(false);

      const keys = await AsyncStorage.getAllKeys();
      const clearKeys = keys.filter(key => 
        key.startsWith('supabase.auth.') || key === '@cluster_id'
      );
      if (clearKeys.length > 0) {
        await AsyncStorage.multiRemove(clearKeys);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('✅ clearSessionData - Dados limpos com sucesso');
    } catch (error) {
      console.error('Erro ao limpar dados da sessão:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setIsSigningOut(true);

      // Faz logout no Supabase primeiro
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Erro ao fazer logout no Supabase:', error.message);
        throw error;
      }

      // Limpa os dados locais
      await clearSessionData();

      // Força uma pequena espera antes do redirecionamento
      await new Promise(resolve => setTimeout(resolve, 500));

      await router.replace('/auth');
    } catch (error) {
      console.error('Erro crítico durante logout:', error);
      throw error;
    } finally {
      setIsSigningOut(false);
    }
  };

  const fetchClusterInfo = async () => {
    try {
      // Verifica diretamente no banco de dados
      if (session?.user.id) {
        const { data: member, error: memberError } = await supabase
          .from('cluster_members')
          .select('cluster_id, nome, admin')
          .eq('user_id', session.user.id)
          .maybeSingle(); // Usa maybeSingle() para evitar erro quando não há resultados

        // Se houver erro E não for "nenhum resultado encontrado"
        if (memberError && memberError.code !== 'PGRST116') {
          console.error('Erro ao verificar clube:', memberError.message);
          throw memberError;
        }

        if (member) {
          console.log('🔍 fetchClusterInfo - Cluster encontrado:', member);
          setHasCluster(true);
          setClusterName(member.cluster_id);
          setIsAdmin(member.admin || false);
          console.log('🔍 fetchClusterInfo - isAdmin definido como:', member.admin || false);
        } else {
          console.log('🔍 fetchClusterInfo - Nenhum cluster encontrado');
          setHasCluster(false);
          setClusterName(null);
          setIsAdmin(false);
        }
      } else {
        setHasCluster(false);
        setClusterName(null);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Erro ao buscar informações do clube:', error);
      setHasCluster(false);
      setClusterName(null);
      setIsAdmin(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Erro no login:', error.message);
        throw error;
      }

      if (data.session) {
        setSession(data.session);
        setIsAuthenticated(true);
        
        // Busca informações do clube logo após o login
        const { data: member, error: memberError } = await supabase
          .from('cluster_members')
          .select('cluster_id, nome, admin')
          .eq('user_id', data.session.user.id)
          .maybeSingle(); // Usa maybeSingle() para evitar erro quando não há resultados

        // Se houver erro E não for "nenhum resultado encontrado"
        if (memberError && memberError.code !== 'PGRST116') {
          console.error('Erro ao buscar clube:', memberError.message);
        } else if (member) {
          setHasCluster(true);
          setClusterName(member.cluster_id);
          setIsAdmin(member.admin || false);
        } else {
          console.log('📋 Utilizador sem cluster após login');
          setHasCluster(false);
          setClusterName(null);
          setIsAdmin(false);
        }

        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Erro crítico no login:', error);
      setError(error instanceof Error ? error.message : t('common.loginError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.id) {
          setSession(session);
          setIsAuthenticated(true);
          await fetchClusterInfo();
        }
      } catch (error) {
        console.error('Erro ao inicializar auth:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    // Inicializa a aplicação
    initApp();

    // Configura o listener de mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 onAuthStateChange - Evento:', event, 'Session:', session?.user?.id || 'nenhuma');
      
      if (session?.user?.id) {
        setSession(session);
        setIsAuthenticated(true);
        console.log('🔍 onAuthStateChange - Buscando informações do cluster...');
        await fetchClusterInfo();
      } else {
        console.log('🧹 onAuthStateChange - Sem sessão, limpando dados');
        await clearSessionData();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const updateClusterState = async () => {
    await fetchClusterInfo();
  };

  const isSessionValid = () => {
    if (!session) return false;
    
    // Verifica se o token está expirado (convertendo para timestamp)
    const expiresAt = (session.expires_at ?? 0) * 1000; // Converter para milissegundos
    const currentTime = new Date().getTime();
    const isValid = expiresAt > currentTime;
    
    return isValid;
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      isAuthenticated, 
      hasCluster,
      clusterName,
      isAdmin,
      signOut,
      updateClusterState,
      isSessionValid,
      isInitializing
    }}>
      {children}
    </AuthContext.Provider>
  );
}