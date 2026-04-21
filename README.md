# Bisca Ranked V2

Sistema de ranking para o jogo Bisca em duplas com sistema MMR (similar a Elo).

## 🚀 Funcionalidades

- ✅ Gerenciamento de jogadores
- ✅ Registro de partidas em duplas
- ✅ Cálculo automático de ratings (MMR/Elo)
- ✅ Ranking ordenado por rating
- ✅ Histórico completo de partidas
- ✅ API RESTful
- ✅ Banco de dados SQLite persistente
- ✅ Pronto para deploy em qualquer plataforma

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn

## 🛠️ Instalação Local

1. Clone o repositório:
```bash
git clone https://github.com/seu-user/bisca-ranked.git
cd bisca-ranked
```

2. Instale as dependências:
```bash
npm install
```

3. Crie arquivo `.env`:
```bash
cp .env.example .env
```

4. Inicie o servidor:
```bash
npm run dev
```

5. Acesse em `http://localhost:3000`

## 📦 Estrutura do Projeto

```
bisca-ranked/
├── server/
│   ├── index.js           # Servidor Express
│   ├── database.js        # Inicialização SQLite
│   ├── utils.js           # Funções utilitárias
│   └── routes/
│       ├── players.js     # API de jogadores
│       └── matches.js     # API de partidas
├── public/
│   ├── index.html         # Frontend SPA
│   ├── app.js             # Lógica do frontend
│   └── styles.css         # Estilos
├── data/
│   └── bisca.db           # Banco de dados SQLite (gerado)
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Jogadores
- `GET /api/players` - Listar todos os jogadores (ordenado por rating)
- `GET /api/players/:id` - Obter jogador específico
- `POST /api/players` - Criar novo jogador
- `PUT /api/players/:id` - Atualizar nome do jogador
- `DELETE /api/players/:id` - Remover jogador

### Partidas
- `GET /api/matches` - Listar todas as partidas
- `GET /api/matches/:id` - Obter partida específica
- `POST /api/matches` - Registrar nova partida
- `DELETE /api/matches/:id` - Remover partida (recalcula ratings)

### Saúde
- `GET /api/health` - Status do servidor

## 📝 Exemplo de Uso da API

### Criar jogador
```bash
curl -X POST http://localhost:3000/api/players \
  -H "Content-Type: application/json" \
  -d '{"name":"João"}'
```

### Registrar partida
```bash
curl -X POST http://localhost:3000/api/matches \
  -H "Content-Type: application/json" \
  -d '{
    "teamA": ["player-id-1", "player-id-2"],
    "teamB": ["player-id-3", "player-id-4"],
    "winner": "A"
  }'
```

## 🚀 Deploy

### Opção 1: Railway (Recomendado)

1. Crie conta em [railway.app](https://railway.app)
2. Conecte seu repositório GitHub
3. Railway detectará automaticamente que é um app Node.js
4. Configure variável de ambiente `PORT` (normalmente automático)
5. Deploy realizado! 🎉

### Opção 2: Vercel

1. Crie conta em [vercel.com](https://vercel.com)
2. Importe seu repositório
3. Vercel pode não suportar SQLite em serverless, considere usar Railway ou Heroku

### Opção 3: Heroku

1. Crie conta em [heroku.com](https://www.heroku.com)
2. Instale Heroku CLI
3. Execute:
```bash
heroku create seu-app-name
git push heroku main
```

### Opção 4: Deploy em seu próprio servidor

```bash
# Clone o repositório
git clone seu-repositorio
cd bisca-ranked

# Instale dependências
npm install

# Inicie em produção
NODE_ENV=production npm start
```

Use um process manager como PM2:
```bash
npm install -g pm2
pm2 start server/index.js --name bisca-ranked
pm2 save
pm2 startup
```

## ⚙️ Variáveis de Ambiente

```env
PORT=3000                          # Porta do servidor
NODE_ENV=development               # development ou production
DATABASE_PATH=./data/bisca.db      # Caminho do banco SQLite
```

## 🎮 Sistema de Ranking (MMR)

- Rating inicial: **1000 pontos**
- K-Factor: **32** (determina quantos pontos você pode ganhar/perder)
- Fórmula: Elo/Glicko-like com médias de duplas

## 📊 Backup do Banco de Dados

O arquivo do banco de dados é armazenado em `data/bisca.db`. Para fazer backup:

```bash
cp data/bisca.db data/bisca.db.backup
```

## 🐛 Troubleshooting

### Porta já em uso
```bash
# Mude a porta
PORT=3001 npm run dev
```

### Permissões de escrita
```bash
# Certifique-se que a pasta data/ existe
mkdir -p data
chmod 755 data
```

### Erro ao instalar dependências
```bash
# Limpe cache e reinstale
rm -rf node_modules package-lock.json
npm install
```

## 📄 Licença

MIT

## 👤 Contribuições

Contribuições são bem-vindas! Abra uma issue ou pull request.

---

**Desenvolvido com ❤️ para os amantes de Bisca**
