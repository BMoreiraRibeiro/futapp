-- EXECUTAR ESTE SCRIPT NO SUPABASE SQL EDITOR
-- Este script atualiza a policy para permitir que admins atualizem o nome de display do cluster

-- 1. Remover a policy antiga
DROP POLICY IF EXISTS "admins_can_update_clusters" ON "public"."clusters";

-- 2. Criar nova policy que permite admins atualizarem o nome do cluster
CREATE POLICY "admins_can_update_clusters"
ON "public"."clusters"
FOR UPDATE
TO authenticated
USING (
  -- Usuário deve ser admin do cluster
  is_cluster_admin(auth.uid(), cluster_id)
)
WITH CHECK (
  -- Permite que o admin atualize o nome do cluster
  is_cluster_admin(auth.uid(), cluster_id)
);

-- 3. Verificar se a policy foi criada com sucesso
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
WHERE tablename = 'clusters' 
AND policyname = 'admins_can_update_clusters';
