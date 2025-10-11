# 📘 Guia para Criar Repositório no GitHub

## Passo 1: Criar Repositório no GitHub

1. Acesse: https://github.com/new
2. Preencha os dados:
   - **Repository name:** `futapp`
   - **Description:** ⚽ Aplicativo React Native para gestão de futebol às quartas
   - **Visibility:** Escolha Public ou Private
   - ⚠️ **NÃO marque** "Add a README file"
   - ⚠️ **NÃO marque** "Add .gitignore"
   - ⚠️ **NÃO marque** "Choose a license"
3. Clique em **"Create repository"**

## Passo 2: Executar Script de Inicialização

Após criar o repositório no GitHub, execute o script batch:

```cmd
git-init.bat
```

Este script irá:
1. ✅ Inicializar o Git
2. ✅ Adicionar todos os arquivos
3. ✅ Criar commit inicial
4. ✅ Configurar branch main
5. ✅ Adicionar remote origin
6. ✅ Fazer push para GitHub

## Passo 3: Verificar no GitHub

Acesse: https://github.com/BMoreiraRibeiro/futapp

Você deverá ver todos os arquivos do projeto!

---

## 🔧 Comandos Manuais (Alternativa)

Se preferir executar manualmente via Git Bash:

```bash
# 1. Inicializar repositório
git init

# 2. Adicionar arquivos
git add .

# 3. Commit inicial
git commit -m "Initial commit - FUTAPP Expo SDK 54"

# 4. Configurar branch main
git branch -M main

# 5. Adicionar remote
git remote add origin https://github.com/BMoreiraRibeiro/futapp.git

# 6. Push para GitHub
git push -u origin main
```

---

## 📝 Comandos Úteis para o Futuro

```bash
# Ver status
git status

# Adicionar mudanças
git add .

# Fazer commit
git commit -m "Descrição das mudanças"

# Push para GitHub
git push

# Pull do GitHub
git pull

# Criar nova branch
git checkout -b feature/nome-da-feature

# Ver histórico
git log --oneline
```

---

## ⚠️ Problemas Comuns

### Erro: "git: command not found"
- **Solução:** Instale o Git: https://git-scm.com/download/win
- Reinicie o terminal após a instalação

### Erro: "fatal: remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/BMoreiraRibeiro/futapp.git
```

### Erro de autenticação no push
- Use **Personal Access Token** em vez de senha
- Crie um token em: https://github.com/settings/tokens

---

✅ **Projeto pronto para o GitHub!**
