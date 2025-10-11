# ⚠️ AVISOS DE SEGURANÇA - LEIA ANTES DE FAZER PUSH

## 🔴 CREDENCIAIS EXPOSTAS

O arquivo `lib/supabase.ts` contém credenciais do Supabase **hardcoded**:
- URL: `https://yfekpdyinxaxjofkqvbe.supabase.co`
- ANON KEY: `eyJhbGci...` (exposto)

### ⚡ AÇÃO NECESSÁRIA ANTES DO PUSH:

#### Opção 1: Manter Credenciais no Código (Menos Seguro)
Se você quer fazer push mesmo com as credenciais expostas:
- ⚠️ **CUIDADO:** Qualquer pessoa com acesso ao repositório terá acesso ao seu Supabase
- ✅ Configure as **Row Level Security (RLS)** policies no Supabase para proteger seus dados
- ✅ Use apenas a **ANON KEY** (nunca a SERVICE KEY)
- ✅ Considere tornar o repositório **PRIVADO**

#### Opção 2: Usar Variáveis de Ambiente (Recomendado)

1. **Criar arquivo `.env` local:**
```bash
EXPO_PUBLIC_SUPABASE_URL=https://yfekpdyinxaxjofkqvbe.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmZWtwZHlpbnhheGpvZmtxdmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTI4NzUsImV4cCI6MjA3NTY4ODg3NX0.YBm8otsxnn2oXtH4E-SaQO_5-6nlIhJ1R0Cowr7o71Q
```

2. **Atualizar `lib/supabase.ts`:**
```typescript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
```

3. **Verificar que `.env` está no `.gitignore`** ✅ (já está)

---

## 📁 ARQUIVOS QUE NÃO DEVEM IR PARA O GITHUB

### ✅ Já no .gitignore:
- `node_modules/`
- `.expo/`
- `*.keystore`
- `.env`

### ⚠️ ARQUIVOS SENSÍVEIS DETECTADOS:
- `my-upload-key.keystore` - ✅ Já está no .gitignore (*.keystore)
- `android/app/debug.keystore` - ✅ Já está no .gitignore

### 🗑️ Arquivos de Build (podem ser grandes):
- `android/app/build/` - ✅ Já está no .gitignore
- `android/build/` - ✅ Já está no .gitignore

---

## ✅ CHECKLIST ANTES DO PUSH

- [ ] Revisei as credenciais do Supabase
- [ ] Configurei RLS (Row Level Security) no Supabase
- [ ] Decidi se o repositório será PÚBLICO ou PRIVADO
- [ ] Revisei o .gitignore
- [ ] Removi arquivos sensíveis (keystores, builds)
- [ ] Li o arquivo GITHUB-SETUP.md

---

## 🚀 PRÓXIMOS PASSOS

1. **Criar repositório no GitHub** (siga GITHUB-SETUP.md)
2. **Executar `git-init.bat`** (ou comandos manuais)
3. **Verificar no GitHub** se tudo está correto

---

## 📞 Em caso de exposição acidental de credenciais:

1. **Regenerar keys no Supabase:**
   - Acesse: https://supabase.com/dashboard/project/yfekpdyinxaxjofkqvbe/settings/api
   - Gere uma nova ANON KEY
   - Atualize seu projeto local

2. **Limpar histórico Git (se necessário):**
   - Use `git filter-branch` ou ferramentas como BFG Repo-Cleaner
   - Force push: `git push --force`

---

✅ **Leia este arquivo cuidadosamente antes de fazer push para o GitHub!**
