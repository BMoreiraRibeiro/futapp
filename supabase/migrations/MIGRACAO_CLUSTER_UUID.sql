-- ====================================
-- MIGRAÇÃO: cluster_id → cluster_uuid
-- ====================================
-- Esta migração converte todas as tabelas para usar cluster_uuid (UUID)
-- em vez de cluster_id (TEXT), e adiciona nome_cluster para display
-- ====================================

BEGIN;

-- ====================================
-- 1. ADICIONAR NOVA COLUNA cluster_uuid na tabela clusters
-- ====================================
ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS cluster_uuid UUID DEFAULT gen_random_uuid();

-- Gerar UUIDs para registros existentes que não têm
UPDATE clusters 
SET cluster_uuid = gen_random_uuid() 
WHERE cluster_uuid IS NULL;

-- Tornar cluster_uuid NOT NULL
ALTER TABLE clusters 
ALTER COLUMN cluster_uuid SET NOT NULL;

-- Adicionar coluna nome_cluster se não existir
ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS nome_cluster TEXT;

-- Copiar cluster_id para nome_cluster se nome_cluster estiver vazio
UPDATE clusters 
SET nome_cluster = cluster_id 
WHERE nome_cluster IS NULL OR nome_cluster = '';

-- ====================================
-- 2. ADICIONAR cluster_uuid em cluster_members
-- ====================================
ALTER TABLE cluster_members 
ADD COLUMN IF NOT EXISTS cluster_uuid UUID;

-- Preencher cluster_uuid baseado no cluster_id
UPDATE cluster_members cm
SET cluster_uuid = c.cluster_uuid
FROM clusters c
WHERE cm.cluster_id = c.cluster_id
AND cm.cluster_uuid IS NULL;

-- ====================================
-- 3. ADICIONAR cluster_uuid em jogadores
-- ====================================
ALTER TABLE jogadores 
ADD COLUMN IF NOT EXISTS cluster_uuid UUID;

-- Preencher cluster_uuid baseado no cluster_id
UPDATE jogadores j
SET cluster_uuid = c.cluster_uuid
FROM clusters c
WHERE j.cluster_id = c.cluster_id
AND j.cluster_uuid IS NULL;

-- ====================================
-- 4. ADICIONAR cluster_uuid em resultados_jogos
-- ====================================
ALTER TABLE resultados_jogos 
ADD COLUMN IF NOT EXISTS cluster_uuid UUID;

-- Preencher cluster_uuid baseado no cluster_id
UPDATE resultados_jogos rj
SET cluster_uuid = c.cluster_uuid
FROM clusters c
WHERE rj.cluster_id = c.cluster_id
AND rj.cluster_uuid IS NULL;

-- ====================================
-- 5. ADICIONAR cluster_uuid em calotes_jogo
-- ====================================
ALTER TABLE calotes_jogo 
ADD COLUMN IF NOT EXISTS cluster_uuid UUID;

-- Preencher cluster_uuid baseado no cluster_id
UPDATE calotes_jogo cj
SET cluster_uuid = c.cluster_uuid
FROM clusters c
WHERE cj.cluster_id = c.cluster_id
AND cj.cluster_uuid IS NULL;

-- ====================================
-- 6. ADICIONAR cluster_uuid em golos_por_jogador
-- ====================================
ALTER TABLE golos_por_jogador 
ADD COLUMN IF NOT EXISTS cluster_uuid UUID;

-- Preencher cluster_uuid baseado no cluster_id
UPDATE golos_por_jogador g
SET cluster_uuid = c.cluster_uuid
FROM clusters c
WHERE g.cluster_id = c.cluster_id
AND g.cluster_uuid IS NULL;

-- ====================================
-- 7. REMOVER CONSTRAINTS ANTIGAS (foreign keys baseadas em cluster_id)
-- ====================================

-- Listar e remover foreign keys antigas
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name, table_name
        FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%cluster_id%'
    ) LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
    END LOOP;
END $$;

-- ====================================
-- 8. REMOVER PRIMARY KEYS ANTIGAS E CRIAR NOVAS
-- ====================================

-- Clusters: cluster_id → cluster_uuid
ALTER TABLE clusters DROP CONSTRAINT IF EXISTS clusters_pkey;
ALTER TABLE clusters ADD PRIMARY KEY (cluster_uuid);

-- Cluster members: ajustar unique constraint
ALTER TABLE cluster_members DROP CONSTRAINT IF EXISTS cluster_members_pkey;
ALTER TABLE cluster_members DROP CONSTRAINT IF EXISTS cluster_members_cluster_id_user_id_key;
ALTER TABLE cluster_members ADD CONSTRAINT cluster_members_pkey PRIMARY KEY (cluster_uuid, user_id);

-- Jogadores: ajustar primary key
ALTER TABLE jogadores DROP CONSTRAINT IF EXISTS jogadores_pkey;
ALTER TABLE jogadores ADD CONSTRAINT jogadores_pkey PRIMARY KEY (cluster_uuid, nome);

-- Resultados jogos: ajustar primary key
ALTER TABLE resultados_jogos DROP CONSTRAINT IF EXISTS resultados_jogos_pkey;
ALTER TABLE resultados_jogos ADD CONSTRAINT resultados_jogos_pkey PRIMARY KEY (cluster_uuid, id_jogo);

-- Calotes jogo: ajustar primary key
ALTER TABLE calotes_jogo DROP CONSTRAINT IF EXISTS calotes_jogo_pkey;
ALTER TABLE calotes_jogo ADD CONSTRAINT calotes_jogo_pkey PRIMARY KEY (cluster_uuid, id_jogo, nome_jogador);

-- Golos por jogador: ajustar primary key
ALTER TABLE golos_por_jogador DROP CONSTRAINT IF EXISTS golos_por_jogador_pkey;
ALTER TABLE golos_por_jogador ADD CONSTRAINT golos_por_jogador_pkey PRIMARY KEY (cluster_uuid, nome_jogador, id_jogo);

-- ====================================
-- 9. CRIAR NOVAS FOREIGN KEYS
-- ====================================

-- cluster_members → clusters
ALTER TABLE cluster_members
ADD CONSTRAINT cluster_members_cluster_uuid_fkey
FOREIGN KEY (cluster_uuid) REFERENCES clusters(cluster_uuid) ON DELETE CASCADE;

-- jogadores → clusters
ALTER TABLE jogadores
ADD CONSTRAINT jogadores_cluster_uuid_fkey
FOREIGN KEY (cluster_uuid) REFERENCES clusters(cluster_uuid) ON DELETE CASCADE;

-- resultados_jogos → clusters
ALTER TABLE resultados_jogos
ADD CONSTRAINT resultados_jogos_cluster_uuid_fkey
FOREIGN KEY (cluster_uuid) REFERENCES clusters(cluster_uuid) ON DELETE CASCADE;

-- calotes_jogo → clusters
ALTER TABLE calotes_jogo
ADD CONSTRAINT calotes_jogo_cluster_uuid_fkey
FOREIGN KEY (cluster_uuid) REFERENCES clusters(cluster_uuid) ON DELETE CASCADE;

-- golos_por_jogador → clusters
ALTER TABLE golos_por_jogador
ADD CONSTRAINT golos_por_jogador_cluster_uuid_fkey
FOREIGN KEY (cluster_uuid) REFERENCES clusters(cluster_uuid) ON DELETE CASCADE;

-- ====================================
-- 10. TORNAR cluster_uuid NOT NULL em todas as tabelas
-- ====================================

ALTER TABLE cluster_members ALTER COLUMN cluster_uuid SET NOT NULL;
ALTER TABLE jogadores ALTER COLUMN cluster_uuid SET NOT NULL;
ALTER TABLE resultados_jogos ALTER COLUMN cluster_uuid SET NOT NULL;
ALTER TABLE calotes_jogo ALTER COLUMN cluster_uuid SET NOT NULL;
ALTER TABLE golos_por_jogador ALTER COLUMN cluster_uuid SET NOT NULL;

-- ====================================
-- 11. CRIAR ÍNDICES para melhor performance
-- ====================================

CREATE INDEX IF NOT EXISTS idx_cluster_members_cluster_uuid ON cluster_members(cluster_uuid);
CREATE INDEX IF NOT EXISTS idx_jogadores_cluster_uuid ON jogadores(cluster_uuid);
CREATE INDEX IF NOT EXISTS idx_resultados_jogos_cluster_uuid ON resultados_jogos(cluster_uuid);
CREATE INDEX IF NOT EXISTS idx_calotes_jogo_cluster_uuid ON calotes_jogo(cluster_uuid);
CREATE INDEX IF NOT EXISTS idx_golos_por_jogador_cluster_uuid ON golos_por_jogador(cluster_uuid);
CREATE INDEX IF NOT EXISTS idx_clusters_nome_cluster ON clusters(nome_cluster);

-- ====================================
-- 12. OPCIONAL: REMOVER COLUNAS cluster_id ANTIGAS (COMENTADO POR SEGURANÇA)
-- ====================================
-- ATENÇÃO: Apenas execute estas linhas depois de confirmar que tudo está funcionando!
-- Descomente as linhas abaixo quando tiver certeza:

-- ALTER TABLE cluster_members DROP COLUMN IF EXISTS cluster_id;
-- ALTER TABLE jogadores DROP COLUMN IF EXISTS cluster_id;
-- ALTER TABLE resultados_jogos DROP COLUMN IF EXISTS cluster_id;
-- ALTER TABLE calotes_jogo DROP COLUMN IF EXISTS cluster_id;
-- ALTER TABLE golos_por_jogador DROP COLUMN IF EXISTS cluster_id;
-- ALTER TABLE clusters DROP COLUMN IF EXISTS cluster_id;

COMMIT;

-- ====================================
-- VERIFICAÇÃO FINAL
-- ====================================
-- Execute estas queries para verificar se a migração foi bem sucedida:

SELECT 'clusters' as tabela, COUNT(*) as total FROM clusters;
SELECT 'cluster_members' as tabela, COUNT(*) as total FROM cluster_members;
SELECT 'jogadores' as tabela, COUNT(*) as total FROM jogadores;
SELECT 'resultados_jogos' as tabela, COUNT(*) as total FROM resultados_jogos;
SELECT 'calotes_jogo' as tabela, COUNT(*) as total FROM calotes_jogo;
SELECT 'golos_por_jogador' as tabela, COUNT(*) as total FROM golos_por_jogador;
