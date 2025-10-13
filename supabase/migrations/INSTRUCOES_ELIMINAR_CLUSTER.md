# 🚀 COMO ATIVAR A FUNCIONALIDADE DE SAIR DO CLUSTER

## ⚠️ IMPORTANTE: Execute estes passos ANTES de testar

### 📋 Passo 1: Aplicar Policies no Supabase

1. Abra o **Supabase Dashboard** (https://supabase.com/dashboard)
2. Selecione o seu projeto
3. Vá para **SQL Editor** (no menu lateral)
4. Clique em **New Query**
5. Copie e cole TODO o conteúdo do ficheiro: `supabase/migrations/APPLY_ALL_POLICIES.sql`
6. Clique em **Run** (ou pressione Ctrl+Enter)
7. Verifique se a query executou com sucesso
8. Na parte inferior, deve ver uma tabela com as policies criadas

### ✅ O que as Policies Fazem

Estas policies permitem que administradores possam:
- ✏️ **UPDATE** - Alterar o nome do cluster
- 🚪 **DELETE** - Sair do cluster (remove cluster e membros)

### 🔍 Como Verificar se Funcionou

Após executar o SQL, deve ver esta tabela no resultado:

| schemaname | tablename       | policyname                        | cmd    |
|------------|-----------------|----------------------------------|--------|
| public     | cluster_members | admins_can_delete_cluster_members | DELETE |
| public     | clusters        | admins_can_update_clusters       | UPDATE |
| public     | clusters        | admins_can_delete_clusters       | DELETE |

### 🎯 Passo 2: Testar a Funcionalidade

1. **Faça login** na app como administrador
2. Vá para **Settings** (⚙️)
3. Clique no botão **Administração**
4. Vá até **Sair do Cluster**
5. Clique em **Sair do Cluster**
6. Deve aparecer um **modal de confirmação** com:
   - Título: "Sair do Cluster"
   - Nome do cluster
   - Informação de que você será removido
   - Botões: **Cancelar** e **Sair**
7. Clique em **Sair** para confirmar
8. A app deve:
   - Eliminar apenas o registo do cluster
   - Mostrar toast de sucesso
   - Fazer logout automaticamente após 1.5 segundos

### 🔧 Fluxo de Saída (ordem correta)

```
1. DELETE cluster_members WHERE cluster_id = 'xxx'  ✅
2. DELETE clusters WHERE cluster_id = 'xxx'         ✅
3. Toast de sucesso                                 ✅
4. Fechar modal                                     ✅
5. Logout automático (1.5s delay)                   ✅
```

### ℹ️ Importante: O que ACONTECE e o que NÃO acontece

**✅ ACONTECE:**
- Os membros do cluster são eliminados da tabela `cluster_members`
- O registo do cluster é eliminado da tabela `clusters`
- Você é removido do cluster
- Todos os outros membros também são removidos
- Logout automático
- Você volta para o ecrã de login

**❌ NÃO ACONTECE:**
- Os jogadores NÃO são eliminados
- Os jogos NÃO são eliminados
- Os golos NÃO são eliminados
- Os pagamentos NÃO são eliminados
- As configurações do cluster NÃO são eliminadas

**Todos os dados relacionados (jogadores, jogos, etc.) permanecem na base de dados!**

### 🐛 Troubleshooting

**Se aparecer erro de permissão:**
- Verifique se as policies foram aplicadas corretamente
- Confirme que está logado como admin
- Verifique se a função `is_cluster_admin()` existe no Supabase

**Para verificar a função is_cluster_admin:**
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'is_cluster_admin';
```

**Se o modal não aparecer:**
- O código já foi corrigido (Alert.alert não funciona dentro de Modal)
- Agora usa um Modal personalizado que funciona corretamente

**Se o logout não acontecer:**
- Verifique o console para logs começados com 🚪
- O logout acontece 1.5 segundos após eliminação bem-sucedida

### 📱 Comportamento Esperado

✅ **ANTES de sair:**
- Modal de confirmação aparece
- Informação clara de que dados serão mantidos
- Pode cancelar a qualquer momento

✅ **DURANTE a saída:**
- Log detalhado no console (🗑️ emoji)
- DELETE executado apenas na tabela clusters
- Erros são capturados e mostrados

✅ **DEPOIS de sair:**
- Toast de sucesso
- Modal fecha automaticamente
- Logout acontece após 1.5s
- Utilizador volta para ecrã de login

### 🎨 Melhorias Implementadas

1. **Modal personalizado** (substituiu Alert.alert que não funcionava)
2. **Confirmação visual clara** sobre o que acontecerá
3. **Feedback detalhado** com logs e toasts
4. **Logout automático** após saída
5. **Tratamento de erros** robusto
6. **Mantém os dados** - apenas remove o cluster

---

## 🚨 LEMBRE-SE

**Esta ação remove você do cluster mas mantém todos os dados!**

Os dados ficam "órfãos" na base de dados. Se quiser eliminar tudo, você precisa fazer isso manualmente no Supabase.
