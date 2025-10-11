# ⚽ FUTAPP - Aplicativo de Futebol às Quartas

Aplicativo mobile para gerenciamento de partidas de futebol, rankings de jogadores e estatísticas.

## 📱 Tecnologias

- **React Native** com **Expo SDK 54**
- **TypeScript**
- **Expo Router** (navegação baseada em arquivos)
- **Supabase** (backend e banco de dados)
- **React Native Reanimated** (animações)

## 🚀 Funcionalidades

- ✅ Autenticação de usuários
- ✅ Gestão de jogadores por clube/cluster
- ✅ Registro de resultados de jogos
- ✅ Rankings dinâmicos com estatísticas
- ✅ Artilharia com ícone da chuteira dourada
- ✅ Troféu 🏆 para o 1º colocado
- ✅ Suporte a múltiplos idiomas (PT/EN)
- ✅ Tema claro/escuro

## 📦 Instalação

```bash
# Clonar o repositório
git clone https://github.com/BMoreiraRibeiro/futapp.git
cd futapp

# Instalar dependências
npm install

# Configurar variáveis de ambiente (opcional)
# Copie .env.example para .env e configure suas credenciais Supabase
cp .env.example .env

# Iniciar o projeto no Expo Go
npm start

# Ou usar o script de limpeza de cache
start-clean.bat
```

## 🔐 Configuração do Supabase

As credenciais do Supabase estão configuradas em `lib/supabase.ts`. Para usar suas próprias credenciais:

1. Crie um projeto no [Supabase](https://supabase.com)
2. Copie a URL e a ANON KEY do projeto
3. Atualize o arquivo `lib/supabase.ts`

## 🏗️ Estrutura do Projeto

```
app/
  (tabs)/          # Telas principais (tabs)
    index.tsx      # Home
    players.tsx    # Gestão de jogadores
    rankings.tsx   # Rankings e estatísticas
    results.tsx    # Resultados de jogos
    settings.tsx   # Configurações
  auth.tsx         # Autenticação
components/        # Componentes reutilizáveis
lib/              # Utilitários e configurações
assets/           # Imagens e recursos
```

## 🎨 Screenshots

_Em breve..._

## 📝 Licença

Este projeto é de uso privado.

## 👨‍💻 Autor

**Bruno Moreira Ribeiro**
- GitHub: [@BMoreiraRibeiro](https://github.com/BMoreiraRibeiro)

---

Desenvolvido com ⚽ e ☕
