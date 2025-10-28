import React, { createContext, useContext, useState } from 'react';
import { supabase } from './supabase';

type GameResult = {
  id_jogo: string;
  data: string;
  vencedor: 'A' | 'B' | 'E' | null;
  golos_a?: number | null;
  golos_b?: number | null;
  jogadores_equipa_a: string[]; // Array de nomes dos jogadores
  jogadores_equipa_b: string[]; // Array de nomes dos jogadores
};

type ResultsContextType = {
  results: GameResult[];
  fetchResults: (clusterId?: string | null) => Promise<void>;
  loading: boolean;
};

const ResultsContext = createContext<ResultsContextType>({
  results: [],
  fetchResults: async () => {},
  loading: false,
});

export const useResults = () => useContext(ResultsContext);

export function ResultsProvider({ children }: { children: React.ReactNode }) {
  const [results, setResults] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchResults = async (clusterId?: string | null) => {
    try {
      setLoading(true);
      if (!clusterId) {
        setResults([]);
        return;
      }

      // Buscar resultados com arrays de UUIDs
      const { data: rawData, error } = await supabase
        .from('resultados_jogos')
        .select('id_jogo, data, vencedor, golos_a, golos_b, jogadores_equipa_a, jogadores_equipa_b')
        .eq('cluster_uuid', clusterId)
        .order('data', { ascending: false });

      if (error) throw error;

      // Converter arrays de UUIDs para arrays de nomes
      const processedResults = await Promise.all(
        (rawData || []).map(async (game) => {
          // Buscar nomes dos jogadores da equipa A
          const { data: playersA } = await supabase
            .from('jogadores')
            .select('nome')
            .in('id_jogador', game.jogadores_equipa_a || []);

          // Buscar nomes dos jogadores da equipa B
          const { data: playersB } = await supabase
            .from('jogadores')
            .select('nome')
            .in('id_jogador', game.jogadores_equipa_b || []);

          return {
            ...game,
            jogadores_equipa_a: playersA?.map(p => p.nome) || [],
            jogadores_equipa_b: playersB?.map(p => p.nome) || [],
          };
        })
      );

      setResults(processedResults);
    } catch (error) {
      console.error('Erro ao buscar resultados:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResultsContext.Provider value={{ results, fetchResults, loading }}>
      {children}
    </ResultsContext.Provider>
  );
} 