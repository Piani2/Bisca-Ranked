# 🚀 Guia Rápido de Setup - Bisca Ranked V2

## ⚠️ Pré-requisito: Instalar Node.js

1. Acesse [nodejs.org](https://nodejs.org)
2. Baixe a versão **LTS** (recomendada)
3. Execute o instalador e siga os passos:
   - ✅ Accept the license agreement
   - ✅ Use o caminho padrão
   - ✅ Marque "Add to PATH" (importante!)
   - ✅ Instale npm (vem junto)
4. Reinicie o computador ou abra um novo terminal PowerShell

## ✅ Verificar Instalação

Após instalar Node.js, abra um novo PowerShell e digite:

```powershell
node --version
npm --version
```

Você deve ver algo como:
```
v20.x.x
9.x.x
```

## 🛠️ Setup do Projeto

Após Node.js instalado, abra PowerShell na pasta do projeto:

```powershell
cd "c:\Users\vanes\OneDrive\Documents\Ranked bisca\Bisca-Ranked"
```

Instale as dependências:

```powershell
npm install
```

## 🎮 Rodar Localmente

```powershell
npm run dev
```

Acesse: http://localhost:3000

## 📋 Estrutura Criada

```
Bisca-Ranked/
├── server/
│   ├── index.js              ← Servidor Express
│   ├── database.js           ← SQLite3
│   ├── utils.js              ← Funções auxiliares
│   └── routes/
│       ├── players.js        ← GET/POST/PUT/DELETE jogadores
│       └── matches.js        ← GET/POST/DELETE partidas
├── public/
│   ├── index.html            ← Interface web
│   ├── app.js                ← Lógica (consome API)
│   └── styles.css            ← Estilo
├── data/
│   └── bisca.db              ← Banco de dados (criado automaticamente)
├── package.json
├── .env
├── README.md
└── Procfile                  ← Para deploy em Heroku
```

## 🌐 Deploy Gratuito (Railway)

1. Acesse [railway.app](https://railway.app)
2. Faça login com GitHub
3. Clique "New Project" → "Deploy from GitHub repo"
4. Selecione seu repositório `Bisca-Ranked`
5. Railway fará deploy automático!

## 🔗 API Endpoints

```
GET  /api/players              - Listar jogadores
POST /api/players              - Criar jogador
GET  /api/players/:id          - Obter jogador
PUT  /api/players/:id          - Atualizar jogador
DELETE /api/players/:id        - Deletar jogador

GET  /api/matches              - Listar partidas
POST /api/matches              - Registrar partida
GET  /api/matches/:id          - Obter partida
DELETE /api/matches/:id        - Deletar partida

GET  /api/health               - Status do servidor
```

## 🎯 Exemplo de Requisição

### Criar jogador via cURL:
```powershell
$body = @{"name"="João"} | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:3000/api/players" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

### Registrar partida:
```powershell
$body = @{
  teamA = @("id1", "id2")
  teamB = @("id3", "id4")
  winner = "A"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/matches" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

## 📊 Sistema de Rating (MMR)

- **Rating Inicial**: 1000 pontos
- **K-Factor**: 32 (influencia em mudanças de rating)
- **Cálculo**: Fórmula Elo com média de duplas

## 🔒 Backup de Dados

O banco de dados é um arquivo único:

```powershell
# Fazer backup
Copy-Item "data/bisca.db" "data/bisca.db.backup"
```

## ❓ Problemas Comuns

**Erro: "npm não é reconhecido"**
→ Node.js não foi instalado ou reinicie o terminal

**Porta 3000 já está em uso**
```powershell
$env:PORT=3001; npm run dev
```

**Erro ao criar/editar jogadores**
→ Certifique-se que a pasta `data/` existe:
```powershell
if (!(Test-Path "data")) { mkdir data }
```

---

**👉 Próximo passo**: Instale Node.js, execute `npm install` e `npm run dev`!
