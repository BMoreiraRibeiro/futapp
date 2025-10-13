-- Adicionar DEFAULT gen_random_uuid() à coluna cluster_uuid se não existir

-- Para a tabela clusters
ALTER TABLE clusters 
ALTER COLUMN cluster_uuid SET DEFAULT gen_random_uuid();

-- Verificar se funcionou
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'clusters' AND column_name = 'cluster_uuid';
