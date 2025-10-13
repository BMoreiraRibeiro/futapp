-- ====================================
-- DIAGNÓSTICO: Verificar estrutura atual da BD
-- ====================================

-- 1. Verificar colunas da tabela clusters
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'clusters'
ORDER BY ordinal_position;

-- 2. Verificar colunas da tabela cluster_members  
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'cluster_members'
ORDER BY ordinal_position;

-- 3. Verificar colunas da tabela jogadores
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'jogadores'
ORDER BY ordinal_position;

-- 4. Verificar colunas da tabela resultados_jogos
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'resultados_jogos'
ORDER BY ordinal_position;

-- 5. Verificar colunas da tabela calotes_jogo
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'calotes_jogo'
ORDER BY ordinal_position;

-- 6. Verificar colunas da tabela golos_por_jogador
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'golos_por_jogador'
ORDER BY ordinal_position;

-- 7. Verificar constraints (chaves primárias, foreign keys)
SELECT
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name IN ('clusters', 'cluster_members', 'jogadores', 'resultados_jogos', 'calotes_jogo', 'golos_por_jogador')
ORDER BY tc.table_name, tc.constraint_type;
