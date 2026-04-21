# 🏗️ Arquitetura - Bisca Ranked V2

## Visão Geral

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTE (Browser)                      │
│  HTML5 + CSS3 + JavaScript (SPA - Single Page Application) │
│              (public/index.html, app.js, styles.css)       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    HTTP/HTTPS API
                    (JSON-based)
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              SERVIDOR NODE.JS + EXPRESS                     │
│                   (server/index.js)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ROTAS DA API                                          │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ GET    /api/players          - Listar jogadores  │ │ │
│  │  │ POST   /api/players          - Criar jogador     │ │ │
│  │  │ PUT    /api/players/:id      - Atualizar        │ │ │
│  │  │ DELETE /api/players/:id      - Deletar          │ │ │
│  │  │                                                  │ │ │
│  │  │ GET    /api/matches          - Listar partidas  │ │ │
│  │  │ POST   /api/matches          - Registrar        │ │ │
│  │  │ DELETE /api/matches/:id      - Reverter         │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  LÓGICA DE NEGÓCIO (server/utils.js)                  │ │
│  │  ├─ Cálculo de Rating (Elo)                          │ │
│  │  ├─ Validação de dados                               │ │
│  │  └─ Recalculação de stats                            │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    SQL/SQLite
                           │
┌──────────────────────────▼──────────────────────────────────┐
│            BANCO DE DADOS (SQLite3)                         │
│                  (data/bisca.db)                            │
│                                                              │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────────────┐ │
│  │   PLAYERS    │  │   MATCHES  │  │  MATCH_DELTAS       │ │
│  ├──────────────┤  ├────────────┤  ├─────────────────────┤ │
│  │ id (PK)      │  │ id (PK)    │  │ id (PK)             │ │
│  │ name (UNIQUE)│  │ team_a_p1  │  │ match_id (FK)       │ │
│  │ rating       │  │ team_a_p2  │  │ player_id (FK)      │ │
│  │ games        │  │ team_b_p1  │  │ delta_rating        │ │
│  │ wins         │  │ team_b_p2  │  │ rating_after        │ │
│  │ losses       │  │ winner     │  │ created_at          │ │
│  │ created_at   │  │ played_at  │  │                     │ │
│  │ updated_at   │  │ created_at │  │                     │ │
│  └──────────────┘  └────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Stack Tecnológico

### Frontend
- **HTML5** - Semântica e estrutura
- **CSS3** - Grid, Flexbox, CSS Variables
- **Vanilla JavaScript** - Sem dependências externas
- **Fetch API** - Comunicação com backend

### Backend
- **Node.js 18+** - Runtime JavaScript server-side
- **Express.js 4** - Framework web minimalista
- **SQLite3** - Banco de dados relacional
- **CORS** - Cross-Origin Resource Sharing
- **dotenv** - Variáveis de ambiente

### DevOps
- **npm** - Package manager
- **Git** - Versionamento
- **GitHub** - Repositório
- **.gitignore** - Exclusão de arquivos
- **Procfile** - Para deploy em Heroku/Railway
- **.env** - Configuração local

## Fluxo de Dados

### 1️⃣ Criar Jogador

```
Frontend (user) 
  ↓ (POST /api/players {name: "João"})
Backend (validar nome único)
  ↓ 
Database (INSERT INTO players)
  ↓
Backend (retornar novo jogador)
  ↓
Frontend (atualizar lista, mostrar mensagem)
```

### 2️⃣ Registrar Partida

```
Frontend (seleciona times e vencedor)
  ↓ (POST /api/matches {teamA, teamB, winner})
Backend (validar 4 jogadores diferentes)
  ↓
Backend (calcular deltas de rating)
  ↓
Backend (iniciar transação SQL)
  ├─ INSERT INTO matches
  ├─ UPDATE players ratings
  └─ INSERT INTO match_deltas
  ↓
Backend (retornar partida com deltas)
  ↓
Frontend (recarregar dados, atualizar ranking)
```

### 3️⃣ Deletar Partida

```
Frontend (user clica "Reverter")
  ↓ (DELETE /api/matches/:id)
Backend (encontrar partida)
  ↓
Backend (iniciar transação SQL)
  ├─ DELETE FROM match_deltas
  ├─ DELETE FROM matches
  └─ RECALCULAR ratings de todos os 4 jogadores
  ↓
Backend (retornar sucesso)
  ↓
Frontend (recarregar ranking, mostrar mensagem)
```

## Modelo de Dados

### Entidade: Player

```javascript
{
  id: "uuid",                  // UUID único
  name: "João Silva",          // String única
  rating: 1050,               // Integer (inicial 1000)
  games: 15,                  // Integer
  wins: 9,                    // Integer
  losses: 6,                  // Integer
  created_at: "2024-01-15",   // DateTime
  updated_at: "2024-01-20"    // DateTime
}
```

### Entidade: Match

```javascript
{
  id: "uuid",                  // UUID único
  team_a_p1: "player-id-1",   // FK para Player
  team_a_p2: "player-id-2",   // FK para Player
  team_b_p1: "player-id-3",   // FK para Player
  team_b_p2: "player-id-4",   // FK para Player
  winner: "A",                // 'A' ou 'B'
  played_at: "2024-01-20",    // DateTime
  created_at: "2024-01-20",   // DateTime
  deltas: {
    "player-id-1": {delta: +20, after: 1070},
    "player-id-2": {delta: +20, after: 1080},
    "player-id-3": {delta: -20, after: 1030},
    "player-id-4": {delta: -20, after: 980}
  }
}
```

### Entidade: MatchDelta (Histórico de Mudanças)

```javascript
{
  id: "uuid",              // UUID único
  match_id: "match-uuid",  // FK para Match
  player_id: "player-id",  // FK para Player
  delta_rating: 20,        // Mudança de rating
  rating_after: 1070,      // Rating após partida
  created_at: "2024-01-20" // DateTime
}
```

## API REST

### Padrão de Resposta

**Sucesso (2xx):**
```json
{
  "id": "uuid",
  "name": "João",
  "rating": 1050,
  ...
}
```

**Erro (4xx/5xx):**
```json
{
  "error": "Player already exists"
}
```

### Endpoints Detalhados

#### Players

```
GET /api/players
Response: [
  { id, name, rating, games, wins, losses, created_at, updated_at },
  ...
]
Order by: rating DESC

POST /api/players
Body: { name: string (30 chars max, unique) }
Response: { id, name, rating: 1000, games: 0, wins: 0, losses: 0, ... }
Status: 201

GET /api/players/:id
Response: { id, name, rating, games, wins, losses, ... }
Status: 200 ou 404

PUT /api/players/:id
Body: { name: string }
Response: { id, name, rating, games, wins, losses, ... }
Status: 200 ou 404

DELETE /api/players/:id
Response: { message: "Player deleted", id }
Status: 200 ou 404
```

#### Matches

```
GET /api/matches
Response: [
  { id, team_a_p1, team_a_p2, team_b_p1, team_b_p2, winner, played_at, deltas: {...} },
  ...
]
Limit: 100 | Order by: played_at DESC

POST /api/matches
Body: {
  teamA: [player-id-1, player-id-2],
  teamB: [player-id-3, player-id-4],
  winner: "A" | "B"
}
Response: { id, team_a_p1, team_a_p2, team_b_p1, team_b_p2, winner, played_at, ... }
Status: 201

DELETE /api/matches/:id
Response: { message: "Match deleted and ratings recalculated", id }
Status: 200 | Recalcula ratings de todos os 4 jogadores
```

## Algoritmo de Rating (MMR/Elo)

### Fórmula

```
Média Time A = (Rating Jogador A1 + Rating Jogador A2) / 2
Média Time B = (Rating Jogador B1 + Rating Jogador B2) / 2

Expectativa A = 1 / (1 + 10^((Média B - Média A) / 400))

Resultado Real A = 1 (se venceu) ou 0 (se perdeu)

Delta = K-Factor × (Resultado Real A - Expectativa A)

Rating Novo = Rating Atual + Delta
```

### Constantes

```
Initial Rating = 1000
K-Factor = 32
```

## Segurança

### Implementado
- ✅ SQL Injection Prevention (Prepared Statements)
- ✅ Input Validation (name max length, type checks)
- ✅ Unique Constraints (nomes de jogadores)
- ✅ CORS Headers (controla cross-origin requests)
- ✅ Foreign Keys (integridade referencial)

### Recomendado para Produção
- ⚠️ Autenticação (JWT/OAuth)
- ⚠️ Rate Limiting
- ⚠️ HTTPS/TLS obrigatório
- ⚠️ Logging de auditoria
- ⚠️ Backup automático de dados

## Performance

### Otimizações Implementadas
- ✅ Índices no banco (played_at, player_id)
- ✅ Lazy loading do frontend
- ✅ Caching de lista de jogadores
- ✅ Paginação de histórico
- ✅ Transações SQL (atomicidade)

### Métricas Esperadas
- Tempo resposta: < 100ms (em conexão local)
- Capacidade: ~10.000 partidas/mês em um server modesto
- Tamanho BD: ~1MB por 1000 partidas

## Escalabilidade Futura

### Possíveis Melhorias
1. **PostgreSQL** - Para grande volume
2. **Redis** - Cache de rankings
3. **Message Queue** - Para processamento assíncrono
4. **GraphQL** - API mais eficiente
5. **WebSockets** - Real-time updates
6. **Microserviços** - Rating service separado
7. **Load Balancer** - Múltiplas instâncias

---

**Perguntas? Leia [README.md](README.md) ou [DEPLOY.md](DEPLOY.md)**
