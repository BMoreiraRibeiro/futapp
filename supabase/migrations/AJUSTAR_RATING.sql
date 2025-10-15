-- ========================================
-- MIGRAÇÃO: Ajustar rating (máximo 100, default 50)
-- ========================================
-- Objetivo: Normalizar rating de 0-2000 para 0-100
-- Autor: Sistema
-- Data: 2025-10-15
-- ========================================

BEGIN;

-- ========================================
-- PASSO 1: Normalizar ratings existentes (0-2000 para 0-100)
-- ========================================

-- Atualizar ratings existentes que estão fora do range
DO $$
BEGIN
  UPDATE jogadores
  SET rating = LEAST(100, GREATEST(0, ROUND((rating::numeric / 2000) * 100)))
  WHERE rating > 100;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'ERRO PASSO 1: Falha ao normalizar ratings - %', SQLERRM;
END $$;

-- ========================================
-- PASSO 2: Alterar default de rating para 50
-- ========================================

DO $$
BEGIN
  ALTER TABLE jogadores
  ALTER COLUMN rating SET DEFAULT 50;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'ERRO PASSO 2: Falha ao definir DEFAULT rating - %', SQLERRM;
END $$;

-- ========================================
-- PASSO 3: Adicionar constraint para rating entre 0 e 100
-- ========================================

DO $$
BEGIN
  -- Remover constraint antiga se existir
  ALTER TABLE jogadores
  DROP CONSTRAINT IF EXISTS jogadores_rating_check;
  
  -- Adicionar nova constraint
  ALTER TABLE jogadores
  ADD CONSTRAINT jogadores_rating_check CHECK (rating >= 0 AND rating <= 100);
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'ERRO PASSO 3: Falha ao adicionar constraint de rating - %', SQLERRM;
END $$;

-- ========================================
-- VERIFICAÇÃO
-- ========================================

-- Ver estatísticas dos ratings
SELECT 
  COUNT(*) as total_jogadores,
  MIN(rating) as rating_minimo,
  MAX(rating) as rating_maximo,
  ROUND(AVG(rating)::numeric, 2) as rating_medio
FROM jogadores;

-- Ver jogadores com ratings fora do range (não deveria ter nenhum)
SELECT id_jogador, nome, rating
FROM jogadores
WHERE rating < 0 OR rating > 100;

COMMIT;
