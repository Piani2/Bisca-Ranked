#!/usr/bin/env pwsh

<#
    Bisca Ranked V2 - Setup Automático
    Script para configurar o projeto automaticamente
#>

Write-Host @"
╔════════════════════════════════════════════════════════╗
║   🚀 BISCA RANKED V2 - SETUP AUTOMÁTICO 🚀           ║
╚════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green

# Verificar se Node.js está instalado
Write-Host "`n🔍 Verificando Node.js..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "✅ Node.js $nodeVersion detectado" -ForegroundColor Green
    Write-Host "✅ npm $npmVersion detectado" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js não encontrado!" -ForegroundColor Red
    Write-Host "   Acesse: https://nodejs.org" -ForegroundColor Yellow
    Write-Host "   Baixe a versão LTS e instale" -ForegroundColor Yellow
    exit 1
}

# Verificar se .env existe
if (-Not (Test-Path ".env")) {
    Write-Host "`n📝 Criando arquivo .env..." -ForegroundColor Cyan
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Arquivo .env criado" -ForegroundColor Green
}

# Verificar se pasta data/ existe
if (-Not (Test-Path "data")) {
    Write-Host "`n📁 Criando pasta data/..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path "data" | Out-Null
    Write-Host "✅ Pasta data/ criada" -ForegroundColor Green
}

# Instalar dependências
Write-Host "`n📦 Instalando dependências..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependências instaladas com sucesso" -ForegroundColor Green
} else {
    Write-Host "❌ Erro ao instalar dependências" -ForegroundColor Red
    exit 1
}

# Perguntar se deseja iniciar o servidor
Write-Host "`n❓ Deseja iniciar o servidor agora? (S/N)" -ForegroundColor Yellow
$response = Read-Host

if ($response -eq "S" -or $response -eq "s" -or $response -eq "Y" -or $response -eq "y") {
    Write-Host "`n🚀 Iniciando servidor..." -ForegroundColor Green
    Write-Host "   Acesse: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "   Pressione Ctrl+C para parar`n" -ForegroundColor Cyan
    npm run dev
} else {
    Write-Host @"
✨ Setup completo!

Próximos passos:
  npm run dev        # Iniciar servidor
  npm run start      # Iniciar em produção

Para mais informações:
  - README.md        # Documentação principal
  - QUICKSTART.md    # Setup rápido
  - DEPLOY.md        # Deploy em plataformas
"@ -ForegroundColor Green
}
