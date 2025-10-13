# 🔄 Migração: cluster_id → cluster_uuid

## 📋 Problema Identificado

O código da aplicação foi atualizado para usar `cluster_uuid` (UUID) em vez de `cluster_id` (TEXT), mas a base de dados ainda mantém a estrutura antiga. Isso causa erros ao tentar criar ou juntar-se a clubes.

## 🎯 Solução

Execute a migração SQL que irá:
1. ✅ Adicionar coluna `cluster_uuid` (UUID) em todas as tabelas
2. ✅ Adicionar coluna `nome_cluster` para display
3. ✅ Gerar UUIDs para todos os registros existentes
4. ✅ Copiar valores de `cluster_id` para `nome_cluster`
5. ✅ Atualizar todas as foreign keys
6. ✅ Atualizar todas as primary keys
7. ✅ Criar índices para performance
8. ⏸️ Opcionalmente remover colunas antigas (após teste)

## 📝 Passos para Executar

### 1. Diagnóstico (Opcional mas Recomendado)

Primeiro, execute o arquivo `DIAGNOSTICO_BD.sql` no SQL Editor do Supabase para ver a estrutura atual:

```
📁 supabase/DIAGNOSTICO_BD.sql
```

Isso vai mostrar todas as colunas atuais de cada tabela.

### 2. Backup (MUITO IMPORTANTE!)

Antes de executar a migração, faça backup dos dados:

No Supabase Dashboard:
1. Vá para **Database** → **Backups**
2. Crie um backup manual
3. Ou exporte os dados via SQL:

```sql
-- Exportar dados importantes
COPY (SELECT * FROM clusters) TO '/tmp/clusters_backup.csv' CSV HEADER;
COPY (SELECT * FROM cluster_members) TO '/tmp/cluster_members_backup.csv' CSV HEADER;
COPY (SELECT * FROM jogadores) TO '/tmp/jogadores_backup.csv' CSV HEADER;
```

### 3. Executar a Migração

No Supabase Dashboard → SQL Editor:

1. Abra o arquivo `MIGRACAO_CLUSTER_UUID.sql`
2. Copie todo o conteúdo
3. Cole no SQL Editor
4. Clique em **Run** (ou Ctrl+Enter)

```
📁 supabase/migrations/MIGRACAO_CLUSTER_UUID.sql
```

### 4. Verificação

Após executar, verifique se:

```sql
-- 1. Todos os registros têm cluster_uuid preenchido
SELECT COUNT(*) as total, COUNT(cluster_uuid) as com_uuid 
FROM clusters;

-- 2. Todas as foreign keys foram criadas
SELECT constraint_name, table_name 
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' 
AND constraint_name LIKE '%cluster_uuid%';

-- 3. Teste criar um novo cluster
SELECT gen_random_uuid(); -- deve gerar um UUID
```

### 5. Testar a Aplicação

1. Reinicie a aplicação
2. Tente criar um novo clube
3. Tente juntar-se a um clube existente
4. Verifique os logs no console

### 6. Remover Colunas Antigas (Após Confirmação)

**⚠️ APENAS APÓS CONFIRMAR QUE TUDO ESTÁ FUNCIONANDO!**

Descomente as linhas no final do arquivo `MIGRACAO_CLUSTER_UUID.sql`:

```sql
ALTER TABLE cluster_members DROP COLUMN IF EXISTS cluster_id;
ALTER TABLE jogadores DROP COLUMN IF EXISTS cluster_id;
ALTER TABLE resultados_jogos DROP COLUMN IF EXISTS cluster_id;
ALTER TABLE calotes_jogo DROP COLUMN IF EXISTS cluster_id;
ALTER TABLE golos_por_jogador DROP COLUMN IF EXISTS cluster_id;
ALTER TABLE clusters DROP COLUMN IF EXISTS cluster_id;
```

## 🔍 Estrutura Final Esperada

### Tabela: clusters
- `cluster_uuid` (UUID, PRIMARY KEY) - Identificador único
- `nome_cluster` (TEXT) - Nome de display do cluster
- `created_by` (UUID) - Quem criou
- `configuracoes` (JSONB) - Configurações do cluster

### Tabela: cluster_members
- `cluster_uuid` (UUID, PRIMARY KEY) - Referência ao cluster
- `user_id` (UUID, PRIMARY KEY) - ID do usuário
- `nome` (TEXT) - Nome do membro
- `admin` (BOOLEAN) - Se é admin

### Tabela: jogadores
- `cluster_uuid` (UUID, PRIMARY KEY) - Referência ao cluster
- `nome` (TEXT, PRIMARY KEY) - Nome do jogador
- `rating` (NUMERIC) - Rating do jogador
- ... outros campos

### Outras Tabelas
Todas seguem o mesmo padrão usando `cluster_uuid` como foreign key.

## 🚨 Troubleshooting

### Erro: "column cluster_uuid already exists"
Significa que a migração já foi parcialmente executada. Execute apenas as partes que faltam.

### Erro: "cannot drop column cluster_id because other objects depend on it"
Execute primeiro as queries de remoção de foreign keys (passo 7 da migração).

### Erro: "duplicate key value violates unique constraint"
Pode haver dados duplicados. Verifique com:
```sql
SELECT cluster_uuid, COUNT(*) 
FROM clusters 
GROUP BY cluster_uuid 
HAVING COUNT(*) > 1;
```

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs detalhados no console da aplicação
2. Execute o `DIAGNOSTICO_BD.sql` novamente
3. Reverta para o backup se necessário
4. Contacte o suporte com os logs de erro

## ✅ Checklist de Validação

- [ ] Backup realizado
- [ ] Migração executada sem erros
- [ ] Todas as tabelas têm `cluster_uuid`
- [ ] Foreign keys criadas corretamente
- [ ] Aplicação consegue criar clube
- [ ] Aplicação consegue juntar-se a clube
- [ ] Dados existentes preservados
- [ ] Colunas antigas removidas (opcional)
