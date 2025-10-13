-- Verificar se cluster_uuid tem DEFAULT gen_random_uuid()
SELECT 
    table_name,
    column_name,
    column_default,
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_name IN ('clusters', 'resultados_jogos')
  AND column_name IN ('cluster_uuid', 'id_jogo')
ORDER BY table_name, column_name;
