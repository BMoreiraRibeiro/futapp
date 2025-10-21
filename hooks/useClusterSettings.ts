import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ClusterSettings {
  team_a_name: string;
  team_b_name: string;
  team_a_color: string;
  team_b_color: string;
  rating_variation: number;
}

const DEFAULT_SETTINGS: ClusterSettings = {
  team_a_name: 'Equipa A',
  team_b_name: 'Equipa B',
  team_a_color: '#3498db',
  team_b_color: '#e74c3c',
  rating_variation: 2,
};

export function useClusterSettings(clusterName: string | null) {
  const [settings, setSettings] = useState<ClusterSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Carregar configurações do cluster
  const loadSettings = async () => {
    if (!clusterName) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);


      // Buscar na tabela clusters, coluna configuracoes (JSONB)
      const { data, error: fetchError } = await supabase
        .from('clusters')
        .select('configuracoes')
        .eq('cluster_uuid', clusterName)
        .single();

      if (fetchError) {
        console.error('❌ Erro ao buscar configurações:', fetchError);
        throw fetchError;
      }


      // Se existe configurações, usar; senão, criar padrão
      if (data?.configuracoes) {
        const mergedSettings = { ...DEFAULT_SETTINGS, ...data.configuracoes };
        setSettings(mergedSettings);
        await cacheSettings(mergedSettings);
      } else {
        // Criar configurações padrão
        await updateSettings(DEFAULT_SETTINGS);
      }
    } catch (err) {
      console.error('Erro ao carregar configurações do cluster:', err);
      setError(err as Error);
      
      // Tentar carregar do cache local
      const cached = await loadCachedSettings(clusterName);
      if (cached) {
        setSettings(cached);
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } finally {
      setLoading(false);
    }
  };

  // Atualizar configurações
  const updateSettings = async (
    updates: Partial<ClusterSettings>
  ): Promise<void> => {
    if (!clusterName) {
      throw new Error('Nome do cluster não definido');
    }

    try {
      // Merge com configurações existentes
      const newSettings = { ...settings, ...updates };

      const { error: updateError } = await supabase
        .from('clusters')
        .update({ configuracoes: newSettings })
        .eq('cluster_uuid', clusterName);

      if (updateError) {
        throw updateError;
      }

      setSettings(newSettings);
      await cacheSettings(newSettings);
    } catch (err) {
      console.error('Erro ao atualizar configurações:', err);
      throw err;
    }
  };

  // Cache local (fallback offline)
  const cacheSettings = async (data: ClusterSettings) => {
    try {
      await AsyncStorage.setItem(
        `@cluster_settings_${clusterName}`,
        JSON.stringify(data)
      );
    } catch (err) {
      console.error('Erro ao salvar cache:', err);
    }
  };

  const loadCachedSettings = async (cluster: string): Promise<ClusterSettings | null> => {
    try {
      const cached = await AsyncStorage.getItem(`@cluster_settings_${cluster}`);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      console.error('Erro ao carregar cache:', err);
      return null;
    }
  };

  // Carregar ao montar e quando o cluster mudar
  useEffect(() => {
    loadSettings();
  }, [clusterName]);

  // Subscrever mudanças em tempo real
  useEffect(() => {
    if (!clusterName) return;

    const subscription = supabase
      .channel(`clusters:${clusterName}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'clusters',
          filter: `cluster_uuid=eq.${clusterName}`,
        },
        (payload: any) => {
          if (payload.new?.configuracoes) {
            const mergedSettings = { ...DEFAULT_SETTINGS, ...payload.new.configuracoes };
            setSettings(mergedSettings);
            cacheSettings(mergedSettings);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [clusterName]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    refreshSettings: loadSettings,
  };
}
