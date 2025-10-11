import React, { createContext, useContext, useState } from 'react';
import { supabase } from './supabase';

type GameResult = {
  id_jogo: string;
  data: string;
  vencedor: 'A' | 'B' | 'E' | null;
  jogadores_equipa_a: string;
  jogadores_equipa_b: string;
};

type ResultsContextType = {
  results: GameResult[];
  fetchResults: (clusterId?: string | null) => Promise<void>;
};

const ResultsContext = createContext<ResultsContextType>({
  results: [],
  fetchResults: async () => {},
});

export const useResults = () => useContext(ResultsContext);

export function ResultsProvider({ children }: { children: React.ReactNode }) {
  const [results, setResults] = useState<GameResult[]>([]);

  const fetchResults = async (clusterId?: string | null) => {
    try {
      if (!clusterId) {
        setResults([]);
        return;
      }

      const { data, error } = await supabase
        .from('resultados_jogos')
        .select('*')
        .eq('cluster_id', clusterId)
        .order('data', { ascending: false });

      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error('Erro ao buscar resultados:', error);
      setResults([]);
    }
  };

  return (
    <ResultsContext.Provider value={{ results, fetchResults }}>
      {children}
    </ResultsContext.Provider>
  );
} 