-- Adicionar policies de DELETE para permitir que admins eliminem clusters

-- Policy para eliminar pagamentos (calotes)
DROP POLICY IF EXISTS "admins_can_delete_calotes" ON "public"."calotes";
CREATE POLICY "admins_can_delete_calotes"
ON "public"."calotes"
FOR DELETE
TO authenticated
USING (
  is_cluster_admin(auth.uid(), cluster_id)
);

-- Policy para eliminar golos
DROP POLICY IF EXISTS "admins_can_delete_golos" ON "public"."golos";
CREATE POLICY "admins_can_delete_golos"
ON "public"."golos"
FOR DELETE
TO authenticated
USING (
  is_cluster_admin(auth.uid(), cluster_id)
);

-- Policy para eliminar jogos
DROP POLICY IF EXISTS "admins_can_delete_jogos" ON "public"."jogos";
CREATE POLICY "admins_can_delete_jogos"
ON "public"."jogos"
FOR DELETE
TO authenticated
USING (
  is_cluster_admin(auth.uid(), cluster_id)
);

-- Policy para eliminar jogadores
DROP POLICY IF EXISTS "admins_can_delete_jogadores" ON "public"."jogadores";
CREATE POLICY "admins_can_delete_jogadores"
ON "public"."jogadores"
FOR DELETE
TO authenticated
USING (
  is_cluster_admin(auth.uid(), cluster_id)
);

-- Policy para eliminar membros do cluster
DROP POLICY IF EXISTS "admins_can_delete_cluster_members" ON "public"."cluster_members";
CREATE POLICY "admins_can_delete_cluster_members"
ON "public"."cluster_members"
FOR DELETE
TO authenticated
USING (
  is_cluster_admin(auth.uid(), cluster_id)
);

-- Policy para eliminar clusters
DROP POLICY IF EXISTS "admins_can_delete_clusters" ON "public"."clusters";
CREATE POLICY "admins_can_delete_clusters"
ON "public"."clusters"
FOR DELETE
TO authenticated
USING (
  is_cluster_admin(auth.uid(), cluster_id)
);

-- Verificar policies criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE policyname LIKE 'admins_can_delete%'
ORDER BY tablename;
