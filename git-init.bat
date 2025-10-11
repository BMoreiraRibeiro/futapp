@echo off
echo ========================================
echo  Inicializando Repositorio Git - FUTAPP
echo ========================================
echo.

REM Navegar para o diretório do projeto
cd /d "%~dp0"

REM Verificar se Git está instalado
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Git nao encontrado! Por favor, instale o Git primeiro.
    echo Download: https://git-scm.com/download/win
    pause
    exit /b 1
)

echo.
echo ========================================
echo  AVISO DE SEGURANCA
echo ========================================
echo.
echo Este projeto contem credenciais do Supabase no codigo!
echo Por favor, leia o arquivo SECURITY-WARNING.md antes de continuar.
echo.
echo Deseja continuar mesmo assim? (S/N)
set /p CONTINUAR="> "
if /i not "%CONTINUAR%"=="S" (
    echo.
    echo Operacao cancelada. Leia SECURITY-WARNING.md para mais info.
    pause
    exit /b 0
)

echo.
echo [1/7] Inicializando repositorio Git...
git init

echo.
echo [2/7] Configurando usuario Git (se necessario)...
git config user.name >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Digite seu nome para o Git:
    set /p GIT_NAME="> "
    git config user.name "!GIT_NAME!"
    echo Digite seu email para o Git:
    set /p GIT_EMAIL="> "
    git config user.email "!GIT_EMAIL!"
)

echo.
echo [3/7] Adicionando arquivos ao staging...
git add .

echo.
echo [4/7] Criando commit inicial...
git commit -m "Initial commit - FUTAPP Expo SDK 54"

echo.
echo [5/7] Renomeando branch para 'main'...
git branch -M main

echo.
echo [6/7] Adicionando repositorio remoto...
git remote add origin https://github.com/BMoreiraRibeiro/futapp.git

echo.
echo ========================================
echo IMPORTANTE: Crie o repositorio no GitHub primeiro!
echo ========================================
echo.
echo 1. Acesse: https://github.com/new
echo 2. Nome do repositorio: futapp
echo 3. NAO adicione README, .gitignore ou licenca
echo 4. Clique em "Create repository"
echo.
echo Ja criou o repositorio no GitHub? (S/N)
set /p REPO_CRIADO="> "
if /i not "%REPO_CRIADO%"=="S" (
    echo.
    echo Por favor, crie o repositorio primeiro e execute este script novamente.
    pause
    exit /b 0
)

echo.
echo [7/7] Fazendo push para GitHub...
git push -u origin main

echo.
echo ========================================
echo  Concluido! Repositorio criado com sucesso!
echo ========================================
echo.
echo Repositorio: https://github.com/BMoreiraRibeiro/futapp
echo.
echo Proximos passos:
echo - Verifique se os arquivos foram enviados corretamente
echo - Configure as RLS policies no Supabase
echo - Considere tornar o repositorio privado
echo.
pause
