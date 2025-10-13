-- ====================================
-- DIAGNÓSTICO: Verificar políticas RLS e permissões
-- ====================================

-- 1. Verificar se RLS está ativado na tabela jogadores
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'jogadores';

-- 2. Listar todas as políticas da tabela jogadores
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'jogadores';

-- 3. Testar INSERT direto (execute como admin no SQL Editor)
INSERT INTO jogadores (
    cluster_uuid,
    nome,
    rating,
    numero_jogos,
    numero_vitorias,
    empates,
    derrotas,
    golos_marcados,
    visivel
) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, -- Substitua por um cluster_uuid válido
    'Teste Manual',
    1000,
    0,
    0,
    0,
    0,
    0,
    true
) RETURNING *;

-- 4. Verificar jogadores existentes
SELECT 
    cluster_uuid,
    nome,
    rating,
    visivel,
    numero_jogos
FROM jogadores
ORDER BY nome
LIMIT 10;

-- 5. Contar jogadores por cluster
SELECT 
    cluster_uuid,
    COUNT(*) as total_jogadores
FROM jogadores
GROUP BY cluster_uuid
ORDER BY total_jogadores DESC;
