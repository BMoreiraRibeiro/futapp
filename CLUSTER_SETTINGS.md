# Configurações do Cluster - Base de Dados

## 📋 Visão Geral

As configurações do cluster (nomes das equipas, cores e variação de rating) são armazenadas na coluna `configuracoes` (JSONB) da tabela `clusters` no Supabase.

## 🗄️ Estrutura

### Tabela: `clusters`
```sql
clusters {
  id: UUID (PK)
  nome: TEXT (UNIQUE)
  configuracoes: JSONB  ← Armazena as configurações
  created_at: TIMESTAMP
  ...
}
```

### Formato do JSONB `configuracoes`:
```json
{
  "team_a_name": "Equipa A",
  "team_b_name": "Equipa B",
  "team_a_color": "#3498db",
  "team_b_color": "#e74c3c",
  "rating_variation": 2
}
```

## 🚀 Não é Necessária Migração SQL

✅ A tabela `clusters` já existe  
✅ A coluna `configuracoes` já existe  
✅ Apenas use os hooks no código  

## ✨ Funcionalidades

### 1. **Configurações por Cluster**
- Cada cluster tem suas próprias configurações no campo JSONB
- Configurações sincronizadas em tempo real
- Fallback para cache local se estiver offline
- Se não existir, cria automaticamente com valores padrão

### 2. **Valores Padrão**
```javascript
{
  team_a_name: 'Equipa A',
  team_b_name: 'Equipa B',
  team_a_color: '#3498db',  // Azul
  team_b_color: '#e74c3c',  // Vermelho
  rating_variation: 2
}
```

## 🔧 Como Usar no Código

### Hook Principal: `useClusterSettings`

```typescript
import { useClusterSettings } from '../hooks/useClusterSettings';

function MyComponent() {
  const { clusterName } = useAuth();
  const { settings, updateSettings, loading } = useClusterSettings(clusterName);

  // Ler configurações
  console.log(settings?.team_a_name);
  console.log(settings?.team_a_color);

  // Atualizar configurações (apenas admins)
  await updateSettings({
    team_a_name: 'Novo Nome',
    team_a_color: '#ff0000',
  });
}
```

### Hook Simplificado: `useTeamConfig`

```typescript
import { useTeamConfig } from '../hooks/useTeamConfig';

function MyComponent() {
  const { teamAName, teamBName, teamAColor, teamBColor, ratingVariation } = useTeamConfig();

  return (
    <Text style={{ color: teamAColor }}>{teamAName}</Text>
  );
}
```

## 📡 Sincronização em Tempo Real

As configurações são sincronizadas automaticamente quando qualquer admin as altera:

```typescript
// Subscrição automática no hook useClusterSettings
supabase
  .channel(`cluster_settings:${clusterName}`)
  .on('postgres_changes', ...)
  .subscribe()
```

## 🔄 Migração de Dados Existentes

A migração SQL inclui um comando para criar configurações padrão para clusters existentes:

```sql
INSERT INTO cluster_settings (cluster_name)
SELECT DISTINCT cluster
FROM players
WHERE cluster IS NOT NULL
ON CONFLICT (cluster_name) DO NOTHING;
```

## 💾 Cache Local

O hook mantém um cache local para:
- ✅ Funcionar offline
- ✅ Carregamento mais rápido
- ✅ Fallback em caso de erro

```typescript
// Cache automático no AsyncStorage
`@cluster_settings_${clusterName}`
```

## 🎨 Cores Disponíveis

```javascript
const TEAM_COLORS = [
  { name: 'Azul', value: '#3498db' },
  { name: 'Vermelho', value: '#e74c3c' },
  { name: 'Verde', value: '#2ecc71' },
  { name: 'Amarelo', value: '#f1c40f' },
  { name: 'Roxo', value: '#9b59b6' },
  { name: 'Laranja', value: '#e67e22' },
];
```

## 🔐 Permissões

### Ver Configurações
- ✅ Todos os usuários do cluster

### Editar Configurações
- ✅ Apenas administradores
- ✅ Verificação via RLS do Supabase
- ✅ Validação no frontend (botão desabilitado)

## 🧪 Testar

1. **Como Admin:**
   - Acesse Settings
   - Altere os nomes das equipas
   - Altere as cores
   - Altere a variação de rating
   - Clique em "Salvar"

2. **Como Usuário Normal:**
   - Acesse Settings
   - Veja as configurações
   - Botão "Salvar" desabilitado
   - Não consegue editar

3. **Sincronização:**
   - Abra em 2 dispositivos
   - Altere como admin em um
   - Veja atualizar em tempo real no outro

## 📊 Monitoramento

Verifique os logs no Supabase Dashboard:
1. **Logs** → **Database**
2. Veja INSERT/UPDATE em `cluster_settings`
3. Verifique políticas RLS

## 🐛 Troubleshooting

### Erro: "permission denied"
- ✅ Verifique se o usuário é admin
- ✅ Verifique políticas RLS
- ✅ Confirme que `players.admin = true`

### Configurações não carregam
- ✅ Verifique conexão internet
- ✅ Verifique se migração foi aplicada
- ✅ Veja cache local como fallback

### Não sincroniza em tempo real
- ✅ Verifique subscription
- ✅ Confirme Realtime habilitado no Supabase
- ✅ Veja console logs
