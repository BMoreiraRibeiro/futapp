-- ============================================
-- APLICAR POLICY PARA SAIR DO CLUSTER
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. Policy para UPDATE de clusters (alterar nome)
DROP POLICY IF EXISTS "admins_can_update_clusters" ON "public"."clusters";
CREATE POLICY "admins_can_update_clusters"
ON "public"."clusters"
FOR UPDATE
TO authenticated
USING (is_cluster_admin(auth.uid(), cluster_id))
WITH CHECK (is_cluster_admin(auth.uid(), cluster_id));

-- 2. Policy para DELETE de membros do cluster
DROP POLICY IF EXISTS "admins_can_delete_cluster_members" ON "public"."cluster_members";
CREATE POLICY "admins_can_delete_cluster_members"
ON "public"."cluster_members"
FOR DELETE
TO authenticated
USING (is_cluster_admin(auth.uid(), cluster_id));

-- 3. Policy para DELETE de clusters (sair do cluster)
DROP POLICY IF EXISTS "admins_can_delete_clusters" ON "public"."clusters";
CREATE POLICY "admins_can_delete_clusters"
ON "public"."clusters"
FOR DELETE
TO authenticated
USING (is_cluster_admin(auth.uid(), cluster_id));

-- ============================================
-- VERIFICAÇÃO: Listar policies criadas
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual as "USING clause",
  with_check as "WITH CHECK clause"
FROM pg_policies 
WHERE policyname LIKE 'admins_can_%cluster%'
ORDER BY tablename, cmd;
