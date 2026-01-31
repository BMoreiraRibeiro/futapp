import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthContextType = {
  session: Session | null;
  isAuthenticated: boolean;
  hasCluster: boolean;
  clusterName: string | null;
  clusterDisplayName: string | null;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  updateClusterState: () => Promise<void>;
  refreshClusterDisplayName: () => Promise<void>;
  clearClusterState: () => void;
  isSessionValid: () => boolean;
  isInitializing: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  isAuthenticated: false,
  hasCluster: false,
  clusterName: null,
  clusterDisplayName: null,
  isAdmin: false,
  signOut: async () => {},
  updateClusterState: async () => {},
  refreshClusterDisplayName: async () => {},
  clearClusterState: () => {},
  isSessionValid: () => false,
  isInitializing: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasCluster, setHasCluster] = useState(false);
  const [clusterName, setClusterName] = useState<string | null>(null);
  const [clusterDisplayName, setClusterDisplayName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // 🔍 MONITOR: Rastreia TODAS as mudanças de estado
  useEffect(() => {
    // State monitoring removed for production
  }, [isAuthenticated, hasCluster, clusterName, clusterDisplayName, isAdmin, session]);

  // 🔍 MONITOR: Rastreia mudanças específicas do hasCluster
  useEffect(() => {
    // hasCluster change monitoring removed for production
  }, [hasCluster]);

  // 🔍 MONITOR: Rastreia mudanças de sessão
  useEffect(() => {
    // Session change monitoring removed for production
  }, [session]);

  const clearSessionData = async () => {
    try {
      setSession(null);
      setIsAuthenticated(false);
      setHasCluster(false);
      setClusterName(null);
      setClusterDisplayName(null);
      setIsAdmin(false);

      const keys = await AsyncStorage.getAllKeys();
      const clearKeys = keys.filter(key => 
        key.startsWith('supabase.auth.') || key === '@cluster_uuid'
      );
      if (clearKeys.length > 0) {
        await AsyncStorage.multiRemove(clearKeys);
      }

  await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Erro ao limpar dados da sessão:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Limpa os dados locais PRIMEIRO
      await clearSessionData();

      // Faz logout no Supabase DEPOIS
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ signOut - Erro ao fazer logout no Supabase:', error.message);
        // Mesmo com erro, continua o processo para garantir limpeza local
      } else {
      }

      // Força uma pequena espera antes do redirecionamento
      await new Promise(resolve => setTimeout(resolve, 300));

      await router.replace('/auth');
      // Logout complete - logs removed for production
    } catch (error) {
      console.error('💥 signOut - Erro crítico durante logout:', error);
      // Mesmo com erro, tenta redirecionar
      try {
        await router.replace('/auth');
      } catch (routerError) {
        console.error('💥 signOut - Erro ao redirecionar:', routerError);
      }
    } finally {
      // Sign out completed
    }
  };

  const fetchClusterInfo = async () => {
    try {
      // Starting cluster search - logs removed for production
      
      // Verifica diretamente no banco de dados
      if (session?.user.id) {
        const { data: member, error: memberError } = await supabase
          .from('cluster_members')
          .select('cluster_uuid, admin')
          .eq('user_id', session.user.id)
          .maybeSingle(); // Usa maybeSingle() para evitar erro quando não há resultados

        // Query result logging removed for production

        // Se houver erro E não for "nenhum resultado encontrado"
        if (memberError && memberError.code !== 'PGRST116') {
          console.error('❌ fetchClusterInfo - Erro ao verificar clube:', memberError.message);
          throw memberError;
        }

        if (member) {
          // Cluster found - logs removed for production
          
          // Buscar o nome_cluster da tabela clusters
          const { data: clusterData } = await supabase
            .from('clusters')
            .select('nome_cluster')
            .eq('cluster_uuid', member.cluster_uuid)
            .single();
          
          setHasCluster(true);
          setClusterName(member.cluster_uuid);
          setClusterDisplayName(clusterData?.nome_cluster || 'Cluster');
          setIsAdmin(member.admin || false);
          // States updated - logs removed for production
        } else {
          // No cluster found, clearing states - logs removed for production
          setHasCluster(false);
          setClusterName(null);
          setClusterDisplayName(null);
          setIsAdmin(false);
          // States cleared - logs removed for production
        }
      } else {
        // No session user id, clearing states - logs removed for production
        setHasCluster(false);
        setClusterName(null);
        setClusterDisplayName(null);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Erro ao buscar informações do clube:', error);
      setHasCluster(false);
      setClusterName(null);
      setClusterDisplayName(null);
      setIsAdmin(false);
    }
  };

  // signIn function removed - not used anywhere

  useEffect(() => {
    const initApp = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        // 🔒 CRÍTICO: Verifica validade do token antes de aceitar como autenticado
        // E garante que NUNCA define isAuthenticated=true sem session válida
        if (session?.user?.id && session.expires_at && (session.expires_at * 1000) > Date.now()) {
          setSession(session);
          setIsAuthenticated(true);
          await fetchClusterInfo();
        } else if (session) {
          // Sessão presente mas inválida/expirada -> limpar para evitar acesso não autorizado
          console.warn('⚠️ initApp - Sessão expirada detectada, limpando...');
          await clearSessionData();
        } else {
          // Sem sessão -> garantir estados limpos
          await clearSessionData();
        }
      } catch (error) {
        console.error('Erro ao inicializar auth:', error);
        // Em caso de erro ao obter sessão, limpamos dados locais por segurança
        try {
          await clearSessionData();
        } catch (_) {}
      } finally {
        // ⏱️ DELAY CRÍTICO: Pequeno delay antes de marcar como não-inicializando
        // Garante que todos os estados foram atualizados
        await new Promise(resolve => setTimeout(resolve, 100));
        setIsInitializing(false);
      }
    };

    // Inicializa a aplicação
    initApp();

    // Configura o listener de mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Auth state change event - logs removed for production
      
      if (session?.user?.id) {
        setSession(session);
        setIsAuthenticated(true);
        // Fetching cluster info - logs removed for production
        await fetchClusterInfo();
      } else {
        // No session, clearing data - logs removed for production
        await clearSessionData();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const updateClusterState = async () => {
    // updateClusterState called - logs removed for production
    await fetchClusterInfo();
  };

  const clearClusterState = () => {
    // clearClusterState - clearing cluster states immediately - logs removed for production
    setHasCluster(false);
    setClusterName(null);
    setClusterDisplayName(null);
    setIsAdmin(false);
    
    // Verificação imediata (não vai mostrar o novo valor por causa do batching do React)
    // States cleared - logs removed for production
    
    // Agendar verificação após o React fazer o batching
    setTimeout(() => {
      // Post-clear verification - logs removed for production
    }, 0);
  };

  const refreshClusterDisplayName = async () => {
    if (!clusterName) return;
    
    try {
      // Refreshing cluster display name - logs removed for production
      const { data: clusterData } = await supabase
        .from('clusters')
        .select('nome_cluster')
        .eq('cluster_uuid', clusterName)
        .single();
      
      if (clusterData) {
        setClusterDisplayName(clusterData.nome_cluster || 'Cluster');
        // Cluster name updated - logs removed for production
      }
    } catch (error) {
      console.error('❌ refreshClusterDisplayName - Erro:', error);
    }
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
      clusterDisplayName,
      isAdmin,
      signOut,
      updateClusterState,
      refreshClusterDisplayName,
      clearClusterState,
      isSessionValid,
      isInitializing
    }}>
      {children}
    </AuthContext.Provider>
  );
}