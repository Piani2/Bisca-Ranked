const STORAGE_KEY = 'bisca-ranked-v1';
const INITIAL_RATING = 1000;
const K_FACTOR = 32;

const state = loadState();

const els = {
  playerForm: document.getElementById('playerForm'),
  playerName: document.getElementById('playerName'),
  matchForm: document.getElementById('matchForm'),
  teamA1: document.getElementById('teamA1'),
  teamA2: document.getElementById('teamA2'),
  teamB1: document.getElementById('teamB1'),
  teamB2: document.getElementById('teamB2'),
  rankingBody: document.getElementById('rankingBody'),
  historyList: document.getElementById('historyList'),
  totalPlayers: document.getElementById('totalPlayers'),
  totalMatches: document.getElementById('totalMatches'),
  toast: document.getElementById('toast')
};

init();

function init() {
  ensureStateShape();
  recalculateFromHistory();
  wireEvents();
  refreshUI();
}

function ensureStateShape() {
  if (!Array.isArray(state.players)) state.players = [];
  if (!Array.isArray(state.matches)) state.matches = [];
}

function wireEvents() {
  els.playerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = els.playerName.value.trim();
    if (!name) return;

    const exists = state.players.some((p) => p.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      toast('Já existe jogador com este nome.');
      return;
    }

    state.players.push(createPlayer(name));
    saveState();
    refreshUI();
    els.playerForm.reset();
    toast('Jogador adicionado.');
  });

  els.matchForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (state.players.length < 4) {
      toast('Adicione pelo menos 4 jogadores.');
      return;
    }

    const teamA = [els.teamA1.value, els.teamA2.value];
    const teamB = [els.teamB1.value, els.teamB2.value];
    const winner = new FormData(els.matchForm).get('winner');

    if (!winner) {
      toast('Selecione a dupla vencedora.');
      return;
    }

    const all = [...teamA, ...teamB];
    const unique = new Set(all);
    if (all.includes('') || unique.size !== 4) {
      toast('Escolha 4 jogadores diferentes.');
      return;
    }

    state.matches.push({
      id: uid(),
      playedAt: new Date().toISOString(),
      teamA,
      teamB,
      winner
    });

    recalculateFromHistory();
    saveState();
    refreshUI();
    els.matchForm.reset();
    toast('Partida registrada.');
  });

  els.historyList.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-undo-id]');
    if (!btn) return;

    const matchId = btn.getAttribute('data-undo-id');
    const ok = confirm('Reverter esta partida? O ranking será recalculado.');
    if (!ok) return;

    state.matches = state.matches.filter((m) => m.id !== matchId);
    recalculateFromHistory();
    saveState();
    refreshUI();
    toast('Partida revertida com sucesso.');
  });
}

function createPlayer(name) {
  return {
    id: uid(),
    name,
    rating: INITIAL_RATING,
    games: 0,
    wins: 0,
    losses: 0
  };
}

function recalculateFromHistory() {
  for (const p of state.players) {
    p.rating = INITIAL_RATING;
    p.games = 0;
    p.wins = 0;
    p.losses = 0;
  }

  const playersById = new Map(state.players.map((p) => [p.id, p]));

  for (const match of state.matches) {
    applyMatch(match, playersById);
  }
}

function applyMatch(match, playersById) {
  const a1 = playersById.get(match.teamA[0]);
  const a2 = playersById.get(match.teamA[1]);
  const b1 = playersById.get(match.teamB[0]);
  const b2 = playersById.get(match.teamB[1]);

  if (!a1 || !a2 || !b1 || !b2) return;

  const avgA = (a1.rating + a2.rating) / 2;
  const avgB = (b1.rating + b2.rating) / 2;
  const actualA = match.winner === 'A' ? 1 : 0;

  const expectedA = 1 / (1 + 10 ** ((avgB - avgA) / 400));
  const deltaA = Math.round(K_FACTOR * (actualA - expectedA));
  const deltaB = -deltaA;

  a1.rating += deltaA;
  a2.rating += deltaA;
  b1.rating += deltaB;
  b2.rating += deltaB;

  for (const p of [a1, a2, b1, b2]) {
    p.games += 1;
  }

  if (match.winner === 'A') {
    a1.wins += 1;
    a2.wins += 1;
    b1.losses += 1;
    b2.losses += 1;
  } else {
    b1.wins += 1;
    b2.wins += 1;
    a1.losses += 1;
    a2.losses += 1;
  }
}

function refreshUI() {
  renderSelects();
  renderRanking();
  renderHistory();
  els.totalPlayers.textContent = String(state.players.length);
  els.totalMatches.textContent = String(state.matches.length);
}

function renderSelects() {
  const selects = [els.teamA1, els.teamA2, els.teamB1, els.teamB2];
  const options = [
    '<option value="">Selecione jogador</option>',
    ...state.players.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
  ].join('');

  for (const select of selects) {
    const current = select.value;
    select.innerHTML = options;
    if (current && state.players.some((p) => p.id === current)) {
      select.value = current;
    }
  }
}

function renderRanking() {
  const ranked = [...state.players].sort((a, b) => b.rating - a.rating);

  if (ranked.length === 0) {
    els.rankingBody.innerHTML = '<tr><td colspan="7" class="empty">Nenhum jogador cadastrado.</td></tr>';
    return;
  }

  els.rankingBody.innerHTML = ranked
    .map((p, i) => {
      const winRate = p.games ? ((p.wins / p.games) * 100).toFixed(1) : '0.0';
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${p.rating}</td>
          <td>${p.games}</td>
          <td>${p.wins}</td>
          <td>${p.losses}</td>
          <td>${winRate}%</td>
        </tr>
      `;
    })
    .join('');
}

function renderHistory() {
  if (state.matches.length === 0) {
    els.historyList.innerHTML = '<li class="empty">Nenhuma partida registrada.</li>';
    return;
  }

  const byId = new Map(state.players.map((p) => [p.id, p.name]));
  const items = [...state.matches].reverse();

  els.historyList.innerHTML = items
    .map((m) => {
      const teamA = `${byId.get(m.teamA[0]) ?? 'Desconhecido'} + ${byId.get(m.teamA[1]) ?? 'Desconhecido'}`;
      const teamB = `${byId.get(m.teamB[0]) ?? 'Desconhecido'} + ${byId.get(m.teamB[1]) ?? 'Desconhecido'}`;
      const winner = m.winner === 'A' ? 'Dupla A' : 'Dupla B';
      const date = new Date(m.playedAt).toLocaleString('pt-BR');

      return `
        <li class="matchItem">
          <div class="matchTop">
            <strong>${escapeHtml(teamA)} vs ${escapeHtml(teamB)}</strong>
            <small>${date}</small>
          </div>
          <div>
            <small>Vencedores: ${winner}</small>
          </div>
          <button type="button" class="secondary" data-undo-id="${m.id}">Reverter resultado</button>
        </li>
      `;
    })
    .join('');
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    els.toast.classList.remove('show');
  }, 2200);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { players: [], matches: [] };
    const parsed = JSON.parse(raw);
    return {
      players: Array.isArray(parsed.players) ? parsed.players : [],
      matches: Array.isArray(parsed.matches) ? parsed.matches : []
    };
  } catch {
    return { players: [], matches: [] };
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
