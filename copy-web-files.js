// Script para copiar arquivos web para dist após build
const fs = require('fs');
const path = require('path');

console.log('Copiando arquivos web para dist...');

// Verificar se dist existe
if (!fs.existsSync('dist')) {
    console.error('Pasta dist não encontrada. Execute "npm run build:web" primeiro.');
    process.exit(1);
}

// Arquivos para copiar
const filesToCopy = {
    'futebolasquartas/index.html': 'dist/email-callback.html',
    'futebolasquartas/reset.html': 'dist/reset-password.html',
    'futebolasquartas/delete-account.js': 'dist/delete-account.js',
    'public/manifest.json': 'dist/manifest.json',
    'public/sw.js': 'dist/sw.js'
};

let successCount = 0;
let errorCount = 0;

Object.entries(filesToCopy).forEach(([source, destination]) => {
    try {
        if (fs.existsSync(source)) {
            fs.copyFileSync(source, destination);
            const fileName = path.basename(destination);
            console.log(`✓ Copiado: ${fileName}`);
            successCount++;
        } else {
            console.warn(`⚠ Arquivo não encontrado: ${source}`);
            errorCount++;
        }
    } catch (error) {
        console.error(`✗ Erro ao copiar ${source}: ${error.message}`);
        errorCount++;
    }
});

console.log(`\nConcluído: ${successCount} copiados, ${errorCount} com problemas`);
