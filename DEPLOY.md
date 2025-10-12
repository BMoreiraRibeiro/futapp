# Deploy no Netlify - Guia Completo

## 📋 Pré-requisitos
- Conta no Netlify (gratuita): https://app.netlify.com/signup
- Git instalado
- Repositório no GitHub (opcional, mas recomendado)

## 🚀 Opção 1: Deploy Automático via GitHub (Recomendado)

### Passo 1: Criar repositório no GitHub
1. Vá para https://github.com/new
2. Crie um novo repositório (pode ser privado ou público)
3. **NÃO** inicialize com README

### Passo 2: Conectar o projeto ao GitHub
```powershell
# Inicializar Git (se ainda não estiver)
git init

# Adicionar todos os arquivos
git add .

# Fazer commit
git commit -m "Initial commit - FUT App"

# Adicionar o repositório remoto (substitua YOUR_USERNAME e YOUR_REPO)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Enviar para o GitHub
git branch -M main
git push -u origin main
```

### Passo 3: Conectar ao Netlify
1. Acesse https://app.netlify.com
2. Clique em "Add new site" → "Import an existing project"
3. Escolha "GitHub" e autorize o Netlify
4. Selecione seu repositório
5. Configure:
   - **Build command**: `npm run build:web`
   - **Publish directory**: `dist`
6. Clique em "Deploy site"

✅ **Pronto!** Cada push no GitHub fará deploy automático!

---

## 🚀 Opção 2: Deploy Manual via Netlify CLI

### Passo 1: Instalar Netlify CLI
```powershell
npm install -g netlify-cli
```

### Passo 2: Build local
```powershell
npm run build:web
```

### Passo 3: Login no Netlify
```powershell
netlify login
```

### Passo 4: Deploy
```powershell
# Deploy de teste
netlify deploy

# Quando estiver tudo OK, deploy em produção
netlify deploy --prod
```

---

## 🚀 Opção 3: Deploy via Drag & Drop

### Passo 1: Build local
```powershell
npm run build:web
```

### Passo 2: Upload manual
1. Acesse https://app.netlify.com
2. Arraste a pasta `dist` para a área de drop do Netlify

---

## 🔧 Configurações Importantes

### Variáveis de Ambiente (se necessário)
No painel do Netlify:
1. Site settings → Environment variables
2. Adicione suas variáveis (ex: API keys)

### Custom Domain (opcional)
1. Site settings → Domain management
2. Adicione seu domínio personalizado

---

## 📝 Notas
- O Supabase já está configurado com URL externa
- Build automático a cada commit (Opção 1)
- SSL/HTTPS gratuito incluído
- CDN global incluído

---

## 🐛 Troubleshooting

### Erro de build?
```powershell
# Limpar cache e tentar novamente
rm -rf node_modules dist
npm install
npm run build:web
```

### Build funciona local mas falha no Netlify?
- Verifique a versão do Node.js (adicione no `package.json`):
```json
"engines": {
  "node": ">=18.0.0"
}
```
