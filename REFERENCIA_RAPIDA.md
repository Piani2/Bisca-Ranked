# 📚 Referência Rápida - Bisca Ranked V2

## 📍 Índice

1. [Setup Rápido](#setup-rápido)
2. [Comandos Essenciais](#comandos-essenciais)
3. [Estrutura de Arquivos](#estrutura-de-arquivos)
4. [API Endpoints](#api-endpoints)
5. [Dados e Banco](#dados-e-banco)
6. [Deploy](#deploy)
7. [Troubleshooting](#troubleshooting)

---

## Setup Rápido

### 1. Instalar Node.js
```bash
# Acesse nodejs.org
# Download LTS
# Instale e reinicie terminal
```

### 2. Instalar Dependências
```bash
cd "c:\Users\vanes\OneDrive\Documents\Ranked bisca\Bisca-Ranked"
npm install
```

### 3. Iniciar Servidor
```bash
npm run dev
# Acesse: http://localhost:3000
```

---

## Comandos Essenciais

```bash
npm install          # Instalar dependências
npm run dev          # Iniciar em desenvolvimento (com watch)
npm start            # Iniciar em produção
npm test             # Rodar testes (quando implementar)
git add .            # Adicionar arquivos ao git
git commit -m "msg"  # Fazer commit
git push             # Enviar para GitHub
```

---

## Estrutura de Arquivos

```
📁 Bisca-Ranked/
├── 📁 server/                    # Backend (Node.js)
│   ├── index.js                  # Servidor principal
│   ├── database.js               # SQLite setup
│   ├── utils.js                  # Funções auxiliares
│   └── 📁 routes/
│       ├── players.js            # API /api/players
│       └── matches.js            # API /api/matches
│
├── 📁 public/                    # Frontend (HTML/CSS/JS)
│   ├── index.html                # Página principal
│   ├── app.js                    # Lógica JavaScript
│   └── styles.css                # Estilos CSS
│
├── 📁 data/                      # Banco de dados
│   └── bisca.db                  # SQLite (criado automaticamente)
│
├── 📄 package.json               # Dependências Node
├── 📄 .env                       # Configuração local
├── 📄 .gitignore                 # Arquivos ignorados
├── 📄 Procfile                   # Deploy Heroku/Railway
│
└── 📚 Documentação
    ├── README.md                 # Guia principal
    ├── QUICKSTART.md             # Setup rápido
    ├── DEPLOY.md                 # Deploy
    ├── ARCHITECTURE.md           # Arquitetura
    ├── CHECKLIST.md              # Checklist
    ├── REFERENCIA_RAPIDA.md      # Este arquivo
    └── RESUMO.txt                # Resumo visual
```

---

## API Endpoints

### Health Check
```
GET /api/health
Response: { status: "ok", timestamp: "..." }
```

### Players (Jogadores)

#### Listar todos
```
GET /api/players
Response: [
  { id, name, rating, games, wins, losses, created_at, updated_at },
  ...
]
Ordenado por: rating DESC
```

#### Criar novo
```
POST /api/players
Body: { name: "João" }
Response: { id, name, rating: 1000, games: 0, wins: 0, losses: 0, ... }
Status: 201
```

#### Obter um
```
GET /api/players/:id
Response: { id, name, rating, ... }
Status: 200 ou 404
```

#### Atualizar nome
```
PUT /api/players/:id
Body: { name: "João Silva" }
Response: { id, name, rating, ... }
Status: 200 ou 404
```

#### Deletar
```
DELETE /api/players/:id
Response: { message: "Player deleted", id }
Status: 200 ou 404
```

### Matches (Partidas)

#### Listar todas
```
GET /api/matches
Response: [
  { id, team_a_p1, team_a_p2, team_b_p1, team_b_p2, winner, played_at, deltas: {...} },
  ...
]
Limit: 100 | Ordenado por: played_at DESC
```

#### Registrar nova
```
POST /api/matches
Body: {
  teamA: ["player-id-1", "player-id-2"],
  teamB: ["player-id-3", "player-id-4"],
  winner: "A" ou "B"
}
Response: { id, team_a_p1, team_a_p2, team_b_p1, team_b_p2, winner, ... }
Status: 201
```

#### Obter uma
```
GET /api/matches/:id
Response: { id, team_a_p1, team_a_p2, team_b_p1, team_b_p2, winner, deltas: {...} }
Status: 200 ou 404
```

#### Reverter (deletar e recalcular)
```
DELETE /api/matches/:id
Response: { message: "Match deleted and ratings recalculated", id }
Status: 200 ou 404
Nota: Recalcula ratings de todos os 4 jogadores
```

---

## Dados e Banco

### Localização
- **Local**: `data/bisca.db`
- **Em Produção**: Servidor da plataforma (Railway, Heroku, etc)

### Tamanho
- ~1 MB por 1.000 partidas
- ~1.000 partidas/mês sem problemas

### Backup
```bash
# Local
cp data/bisca.db data/bisca.db.backup

# Railway
railway download data/bisca.db
railway upload data/bisca.db
```

### Tabelas

**players**
```
id (UUID primary key)
name (unique string)
rating (integer, default 1000)
games (integer)
wins (integer)
losses (integer)
created_at (datetime)
updated_at (datetime)
```

**matches**
```
id (UUID primary key)
team_a_p1 (foreign key → players.id)
team_a_p2 (foreign key → players.id)
team_b_p1 (foreign key → players.id)
team_b_p2 (foreign key → players.id)
winner (A ou B)
played_at (datetime)
created_at (datetime)
```

**match_deltas**
```
id (UUID primary key)
match_id (foreign key → matches.id)
player_id (foreign key → players.id)
delta_rating (integer)
rating_after (integer)
created_at (datetime)
```

---

## Deploy

### Opção 1: Railway (Recomendado)
```
1. railway.app
2. Login com GitHub
3. New Project → Deploy from GitHub
4. Selecionar bisca-ranked
5. Done! (2-3 minutos)
```

### Opção 2: Heroku
```bash
heroku login
heroku create seu-app-name
git push heroku main
heroku logs --tail
```

### Opção 3: Vercel
```
1. vercel.com
2. Import project
3. GitHub bisca-ranked
4. Deploy
Nota: SQLite pode ter limitações
```

### Opção 4: Render
```
1. render.com
2. New Web Service
3. GitHub bisca-ranked
4. Deploy
```

### Opção 5: Seu Servidor
```bash
git clone seu-repositorio
npm install
npm install -g pm2
pm2 start server/index.js
pm2 save
```

Mais detalhes em `DEPLOY.md`

---

## Troubleshooting

### Erro: "npm não é reconhecido"
```bash
# Solução: Instale Node.js de nodejs.org e reinicie
```

### Erro: "Porta 3000 já está em uso"
```bash
# Solução:
$env:PORT=3001
npm run dev
```

### Erro: "Não consegue criar pasta data/"
```bash
# Solução:
mkdir data
npm run dev
```

### Erro: "Banco de dados corrompido"
```bash
# Solução:
rm data/bisca.db
npm run dev  # Cria novo
```

### Erro: "API não responde"
```bash
# Solução:
# 1. Verifique se servidor está rodando (Ctrl+C = parou)
# 2. Veja os logs no terminal
# 3. Verifique erro 404: POST http://localhost:3000/api/players
# 4. Reinicie: npm run dev
```

### Erro: "Cannot find module 'better-sqlite3'"
```bash
# Solução:
npm install
npm run dev
```

---

## Variáveis de Ambiente

```env
PORT=3000                          # Porta (padrão 3000)
NODE_ENV=development               # development ou production
DATABASE_PATH=./data/bisca.db      # Caminho do banco
```

Para mudar porta:
```bash
$env:PORT=3001
npm run dev
```

---

## Sistema de Rating

### Constantes
- Initial Rating: **1000**
- K-Factor: **32**

### Fórmula (Elo)
```
Média A = (Rating A1 + Rating A2) / 2
Média B = (Rating B1 + Rating B2) / 2

Expectativa A = 1 / (1 + 10^((Média B - Média A) / 400))
Resultado Real = 1 (vitória) ou 0 (derrota)

Delta = 32 × (Resultado Real - Expectativa A)

Rating Novo = Rating Atual + Delta
```

### Exemplo
```
Time A: 1050 + 1000 = média 1025
Time B: 1000 + 950 = média 975

Time A é favorito (média maior)
Se Team A vence: ganha ~15 pontos
Se Team A perde: perde ~17 pontos

Se Team B vence: ganha ~20 pontos
Se Team B perde: perde ~15 pontos
```

---

## Git & GitHub

### Configuração Inicial
```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
```

### Usar Git
```bash
git add .                          # Adicionar tudo
git commit -m "mensagem"           # Fazer commit
git push origin main               # Enviar para GitHub
git pull                           # Atualizar local
git status                         # Ver status
git log                            # Ver histórico
```

---

## Referências

- [Express.js Docs](https://expressjs.com)
- [SQLite Docs](https://www.sqlite.org)
- [Node.js Docs](https://nodejs.org/docs)
- [MDN Web Docs](https://developer.mozilla.org)
- [Railway Docs](https://docs.railway.app)

---

## Documentação do Projeto

| Arquivo | Conteúdo |
|---------|----------|
| README.md | Visão geral completa |
| QUICKSTART.md | Setup em 5 minutos |
| DEPLOY.md | 5 opções de deployment |
| ARCHITECTURE.md | Arquitetura técnica |
| CHECKLIST.md | Progresso e próximos passos |
| REFERENCIA_RAPIDA.md | **Este arquivo** |
| RESUMO.txt | Resumo visual |

---

## Atalhos Úteis

```
http://localhost:3000              # Seu app
http://localhost:3000/api/health   # Verificar saúde
http://localhost:3000/api/players  # Lista de jogadores
http://localhost:3000/api/matches  # Histórico de partidas
```

---

## Support & Links

- 📖 Documentação: Veja arquivos .md
- 🐛 Bugs: Abra uma issue no GitHub
- 💬 Dúvidas: Leia os arquivos de documentação
- 🚀 Deploy: Siga DEPLOY.md

---

**Versão**: 2.0.0  
**Última atualização**: Janeiro 2024  
**Status**: ✅ Pronto para Produção
