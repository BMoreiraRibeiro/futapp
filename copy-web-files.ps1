# Script para copiar arquivos web para o dist apos build
Write-Host "Copiando arquivos web para dist..." -ForegroundColor Cyan

# Verificar se dist existe
if (-Not (Test-Path "dist")) {
    Write-Host "Pasta dist nao encontrada. Execute 'npm run build:web' primeiro." -ForegroundColor Red
    exit 1
}

# Copiar arquivos da pasta futebolasquartas para dist com nomes diferentes
# para nao sobrescrever o index.html do Expo
$filesToCopy = @{
    "futebolasquartas/index.html" = "dist/email-callback.html"
    "futebolasquartas/reset.html" = "dist/reset-password.html"
    "futebolasquartas/delete-account.js" = "dist/delete-account.js"
}

foreach ($source in $filesToCopy.Keys) {
    $destination = $filesToCopy[$source]
    if (Test-Path $source) {
        Copy-Item $source $destination -Force
        $fileName = Split-Path $destination -Leaf
        Write-Host "Copiado: $fileName" -ForegroundColor Green
    } else {
        Write-Host "Arquivo nao encontrado: $source" -ForegroundColor Yellow
    }
}

# Copiar arquivos PWA
Write-Host "Copiando arquivos PWA..." -ForegroundColor Cyan

$pwaFiles = @{
    "public/manifest.json" = "dist/manifest.json"
    "public/sw.js" = "dist/sw.js"
}

foreach ($source in $pwaFiles.Keys) {
    $destination = $pwaFiles[$source]
    if (Test-Path $source) {
        Copy-Item $source $destination -Force
        $fileName = Split-Path $destination -Leaf
        Write-Host "Copiado PWA: $fileName" -ForegroundColor Green
    } else {
        Write-Host "Arquivo PWA nao encontrado: $source" -ForegroundColor Yellow
    }
}

Write-Host "Arquivos copiados com sucesso!" -ForegroundColor Green
