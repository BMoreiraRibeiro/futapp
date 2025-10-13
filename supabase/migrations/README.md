# Migration: Update Cluster Policy

## 📝 Descrição
Esta migration atualiza a policy `admins_can_update_clusters` para permitir que administradores possam alterar o nome de display do cluster (coluna `nome_cluster`).

## 🎯 Objetivo
Permitir que a funcionalidade de "Alterar Nome do Cluster" na app funcione corretamente, permitindo que admins atualizem a coluna `nome_cluster` na tabela `clusters` sem alterar o `cluster_id` (chave primária).

## 📊 Estrutura da Tabela
- **`cluster_id`**: Identificador único (chave primária) - NÃO deve ser alterado
- **`nome_cluster`**: Nome de display do cluster - PODE ser alterado por admins
- **`admin`**: Indica se o usuário é administrador
- **`user_id`**: ID do usuário associado

## 🚀 Como Aplicar

### Opção 1: Via Supabase Dashboard (Recomendado)
1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Vá para o seu projeto
3. Navegue até **SQL Editor**
4. Cole o conteúdo do arquivo `APPLY_THIS.sql`
5. Clique em **Run** para executar

### Opção 2: Via Supabase CLI
```bash
# Certifique-se de que o Supabase CLI está instalado e configurado
supabase db push
```

## ⚠️ Importante
- Esta migration altera uma policy de segurança
- Apenas admins do cluster poderão alterar o nome de display
- O `cluster_id` permanece inalterado (é a chave primária)
- A validação continua usando `is_cluster_admin()`

## 📋 O que muda?
**Antes:** A policy `WITH CHECK` estava incompleta

**Depois:** A policy permite que admins atualizem a coluna `nome_cluster` do cluster, mantendo o `cluster_id` como identificador único

## ✅ Validação
Após aplicar a migration, teste:
1. Login como admin de um cluster
2. Vá para Settings → Administração → Nome do Cluster
3. Altere o nome de exibição
4. Clique em Guardar
5. Verifique se a operação é bem-sucedida e o nome aparece atualizado

