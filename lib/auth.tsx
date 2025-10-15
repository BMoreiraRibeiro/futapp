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
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const { t } = useLanguage();

  // 🔍 MONITOR: Rastreia TODAS as mudanças de estado
  useEffect(() => {
    console.log('📊 [STATE MONITOR] Estado atual:', {
      isAuthenticated,
      hasCluster,
      clusterName,
      clusterDisplayName,
      isAdmin,
      sessionExists: !!session,
      userId: session?.user?.id || 'N/A'
    });
  }, [isAuthenticated, hasCluster, clusterName, clusterDisplayName, isAdmin, session]);

  // 🔍 MONITOR: Rastreia mudanças específicas do hasCluster
  useEffect(() => {
    console.log('🎯 [hasCluster CHANGED] Novo valor:', hasCluster);
    console.log('🎯 [hasCluster CONTEXT] isAuthenticated:', isAuthenticated, 'clusterName:', clusterName);
  }, [hasCluster]);

  // 🔍 MONITOR: Rastreia mudanças de sessão
  useEffect(() => {
    if (session) {
      console.log('🔐 [SESSION CHANGED] Nova sessão:', session.user.id);
    } else {
      console.log('🔐 [SESSION CHANGED] Sessão removida');
    }
  }, [session]);

  const clearSessionData = async () => {
    try {
      console.log('🧹 clearSessionData - Limpando todos os dados da sessão');
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
      console.log('✅ clearSessionData - Dados limpos com sucesso');
    } catch (error) {
      console.error('Erro ao limpar dados da sessão:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setIsSigningOut(true);
      console.log('🚪 signOut - Iniciando processo de logout...');

      // Limpa os dados locais PRIMEIRO
      console.log('🧹 signOut - Limpando dados locais...');
      await clearSessionData();

      // Faz logout no Supabase DEPOIS
      console.log('🔓 signOut - Fazendo logout no Supabase...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ signOut - Erro ao fazer logout no Supabase:', error.message);
        // Mesmo com erro, continua o processo para garantir limpeza local
      } else {
        console.log('✅ signOut - Logout no Supabase concluído');
      }

      // Força uma pequena espera antes do redirecionamento
      await new Promise(resolve => setTimeout(resolve, 300));

      console.log('🔄 signOut - Redirecionando para /auth');
      await router.replace('/auth');
      console.log('✅ signOut - Logout completo');
    } catch (error) {
      console.error('💥 signOut - Erro crítico durante logout:', error);
      // Mesmo com erro, tenta redirecionar
      try {
        await router.replace('/auth');
      } catch (routerError) {
        console.error('💥 signOut - Erro ao redirecionar:', routerError);
      }
    } finally {
      setIsSigningOut(false);
    }
  };

  const fetchClusterInfo = async () => {
    try {
      console.log('🔍 fetchClusterInfo - Iniciando busca de cluster...');
      console.log('🔍 fetchClusterInfo - session.user.id:', session?.user.id);
      
      // Verifica diretamente no banco de dados
      if (session?.user.id) {
        const { data: member, error: memberError } = await supabase
          .from('cluster_members')
          .select('cluster_uuid, admin')
          .eq('user_id', session.user.id)
          .maybeSingle(); // Usa maybeSingle() para evitar erro quando não há resultados

        console.log('🔍 fetchClusterInfo - Resultado da query:', { member, error: memberError });

        // Se houver erro E não for "nenhum resultado encontrado"
        if (memberError && memberError.code !== 'PGRST116') {
          console.error('❌ fetchClusterInfo - Erro ao verificar clube:', memberError.message);
          throw memberError;
        }

        if (member) {
          console.log('✅ fetchClusterInfo - Cluster encontrado:', member);
          
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
          console.log('✅ fetchClusterInfo - Estados atualizados: hasCluster=true, clusterName=', member.cluster_uuid);
        } else {
          console.log('� fetchClusterInfo - Nenhum cluster encontrado, limpando estados...');
          setHasCluster(false);
          setClusterName(null);
          setClusterDisplayName(null);
          setIsAdmin(false);
          console.log('✅ fetchClusterInfo - Estados limpos: hasCluster=false, clusterName=null');
        }
      } else {
        console.log('⚠️ fetchClusterInfo - Sem session.user.id, limpando estados...');
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
          .select('cluster_uuid, admin')
          .eq('user_id', data.session.user.id)
          .maybeSingle(); // Usa maybeSingle() para evitar erro quando não há resultados

        // Se houver erro E não for "nenhum resultado encontrado"
        if (memberError && memberError.code !== 'PGRST116') {
          console.error('Erro ao buscar clube:', memberError.message);
        } else if (member) {
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
        } else {
          console.log('📋 Utilizador sem cluster após login');
          setHasCluster(false);
          setClusterName(null);
          setClusterDisplayName(null);
          setIsAdmin(false);
        }

        // NÃO fazer router.replace aqui - deixar o _layout.tsx decidir
        // baseado na validação completa (session + cluster)
        console.log('✅ Login bem-sucedido, aguardando validação no _layout');
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
    console.log('🔄 updateClusterState - Chamado');
    await fetchClusterInfo();
  };

  const clearClusterState = () => {
    console.log('🧹 clearClusterState - Limpando estados do cluster IMEDIATAMENTE');
    console.log('🧹 clearClusterState - Estados ANTES:', { hasCluster, clusterName, clusterDisplayName, isAdmin });
    
    setHasCluster(false);
    setClusterName(null);
    setClusterDisplayName(null);
    setIsAdmin(false);
    
    // Verificação imediata (não vai mostrar o novo valor por causa do batching do React)
    console.log('✅ clearClusterState - Estados limpos (comandos executados)');
    
    // Agendar verificação após o React fazer o batching
    setTimeout(() => {
      console.log('🔍 clearClusterState - VERIFICAÇÃO PÓS-CLEAR:', { hasCluster, clusterName, clusterDisplayName, isAdmin });
    }, 0);
  };

  const refreshClusterDisplayName = async () => {
    if (!clusterName) return;
    
    try {
      console.log('🔄 refreshClusterDisplayName - Atualizando nome do cluster...');
      const { data: clusterData } = await supabase
        .from('clusters')
        .select('nome_cluster')
        .eq('cluster_uuid', clusterName)
        .single();
      
      if (clusterData) {
        setClusterDisplayName(clusterData.nome_cluster || 'Cluster');
        console.log('✅ refreshClusterDisplayName - Nome atualizado:', clusterData.nome_cluster);
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