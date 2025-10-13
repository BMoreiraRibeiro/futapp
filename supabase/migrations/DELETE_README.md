# DELETE Policies - Permitir Eliminação de Clusters

## 🎯 Problema
A funcionalidade de "Eliminar Cluster" não estava funcionando porque as policies de DELETE não existiam nas tabelas relacionadas.

## 📝 Solução
Este script adiciona policies de DELETE para todas as tabelas relacionadas ao cluster, permitindo que administradores possam eliminar completamente um cluster.

## 🚀 Como Aplicar

### Via Supabase Dashboard (Recomendado)
1. Acesse https://app.supabase.com
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Copie e cole o conteúdo de `DELETE_POLICIES.sql`
5. Clique em **Run**

## 📊 Policies Criadas

O script cria policies de DELETE para as seguintes tabelas:

1. **calotes** - Eliminar pagamentos do cluster
2. **golos** - Eliminar golos do cluster
3. **jogos** - Eliminar jogos do cluster
4. **jogadores** - Eliminar jogadores do cluster
5. **cluster_members** - Eliminar membros do cluster
6. **clusters** - Eliminar o próprio cluster

## 🔐 Segurança

Todas as policies verificam se o usuário é admin do cluster usando:
```sql
is_cluster_admin(auth.uid(), cluster_id)
```

## ⚙️ Ordem de Eliminação

O código da app elimina na seguinte ordem para respeitar foreign keys:

```
1. calotes (pagamentos)
2. golos
3. jogos
4. jogadores
5. cluster_members
6. clusters
```

## ✅ Validação

Após aplicar:
1. Login como admin
2. Vá em Settings → Administração → Zona Perigosa
3. Clique em "Eliminar Cluster"
4. Confirme a eliminação
5. Verifique se o cluster foi eliminado e você foi deslogado
