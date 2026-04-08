const STORAGE_KEY = 'bisca-ranked-v1';
const INITIAL_RATING = 1000;
const K_FACTOR = 32;
const HISTORY_PAGE_SIZE = 5;

const state = loadState();
let historyPage = 1;

const els = {
  playerForm: document.getElementById('playerForm'),
  playerName: document.getElementById('playerName'),
  editPlayerForm: document.getElementById('editPlayerForm'),
  editPlayerSelect: document.getElementById('editPlayerSelect'),
  editPlayerName: document.getElementById('editPlayerName'),
  deletePlayerBtn: document.getElementById('deletePlayerBtn'),
  matchForm: document.getElementById('matchForm'),
  teamA1: document.getElementById('teamA1'),
  teamA2: document.getElementById('teamA2'),
  teamB1: document.getElementById('teamB1'),
  teamB2: document.getElementById('teamB2'),
  historyPlayerFilter: document.getElementById('historyPlayerFilter'),
  historyWinnerFilter: document.getElementById('historyWinnerFilter'),
  rankingBody: document.getElementById('rankingBody'),
  historyList: document.getElementById('historyList'),
  historyPageInfo: document.getElementById('historyPageInfo'),
  prevHistoryPageBtn: document.getElementById('prevHistoryPageBtn'),
  nextHistoryPageBtn: document.getElementById('nextHistoryPageBtn'),
  undoLastActionBtn: document.getElementById('undoLastActionBtn'),
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
  if (!Array.isArray(state.undoStack)) state.undoStack = [];
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

    const player = createPlayer(name);
    state.players.push(player);
    pushUndoAction({ type: 'deletePlayer', playerId: player.id });
    historyPage = 1;
    saveState();
    refreshUI();
    els.playerForm.reset();
    toast('Jogador adicionado.');
  });

  els.editPlayerSelect.addEventListener('change', () => {
    const player = state.players.find((p) => p.id === els.editPlayerSelect.value);
    els.editPlayerName.value = player?.name ?? '';
  });

  els.editPlayerForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const playerId = els.editPlayerSelect.value;
    if (!playerId) {
      toast('Selecione um jogador para editar.');
      return;
    }

    const newName = els.editPlayerName.value.trim();
    if (!newName) {
      toast('Digite o novo nome do jogador.');
      return;
    }

    const player = state.players.find((p) => p.id === playerId);
    if (!player) {
      toast('Jogador não encontrado.');
      return;
    }

    const duplicated = state.players.some((p) => p.id !== playerId && p.name.toLowerCase() === newName.toLowerCase());
    if (duplicated) {
      toast('Já existe outro jogador com este nome.');
      return;
    }

    player.name = newName;
    saveState();
    refreshUI();
    toast('Nome do jogador atualizado.');
  });

  els.deletePlayerBtn.addEventListener('click', () => {
    const playerId = els.editPlayerSelect.value;
    if (!playerId) {
      toast('Selecione um jogador para remover.');
      return;
    }

    const player = state.players.find((p) => p.id === playerId);
    if (!player) {
      toast('Jogador não encontrado.');
      return;
    }

    const relatedMatches = state.matches.filter(
      (m) => m.teamA.includes(playerId) || m.teamB.includes(playerId)
    ).length;

    const message = relatedMatches
      ? `Remover ${player.name}? ${relatedMatches} partida(s) deste jogador também serão removidas.`
      : `Remover ${player.name}?`;

    const ok = confirm(message);
    if (!ok) return;

    state.players = state.players.filter((p) => p.id !== playerId);
    state.matches = state.matches.filter(
      (m) => !m.teamA.includes(playerId) && !m.teamB.includes(playerId)
    );

    recalculateFromHistory();
    saveState();
    refreshUI();
    els.editPlayerName.value = '';
    toast('Jogador removido com sucesso.');
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

    const match = {
      id: uid(),
      playedAt: new Date().toISOString(),
      teamA,
      teamB,
      winner
    };

    state.matches.push(match);
    pushUndoAction({ type: 'deleteMatch', matchId: match.id });
    recalculateFromHistory();
    historyPage = 1;
    saveState();
    refreshUI();
    els.matchForm.reset();
    toast('Partida registrada.');
  });

  els.prevHistoryPageBtn.addEventListener('click', () => {
    historyPage = Math.max(1, historyPage - 1);
    renderHistory();
  });

  els.nextHistoryPageBtn.addEventListener('click', () => {
    historyPage = Math.min(getHistoryTotalPages(), historyPage + 1);
    renderHistory();
  });

  els.undoLastActionBtn.addEventListener('click', () => {
    undoLastAction();
  });

  els.historyList.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-undo-id]');
    if (!btn) return;

    const matchId = btn.getAttribute('data-undo-id');
    const matchToRestore = findMatchById(matchId);
    if (!matchToRestore) {
      toast('Partida não encontrada.');
      return;
    }

    const ok = confirm('Reverter esta partida? O ranking será recalculado.');
    if (!ok) return;

    state.matches = state.matches.filter((m) => m.id !== matchId);
    pushUndoAction({ type: 'restoreMatch', match: matchToRestore });
    recalculateFromHistory();
    historyPage = 1;
    saveState();
    refreshUI();
    toast('Partida revertida com sucesso.');
  });

  els.historyPlayerFilter.addEventListener('change', () => {
    renderHistory();
  });

  els.historyWinnerFilter.addEventListener('change', () => {
    renderHistory();
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

function buildHistoryTimeline() {
  const playersById = new Map(state.players.map((p) => [p.id, p]));
  const ratingsById = new Map(state.players.map((p) => [p.id, INITIAL_RATING]));
  const timeline = [];

  for (const match of state.matches) {
    const a1 = playersById.get(match.teamA[0]);
    const a2 = playersById.get(match.teamA[1]);
    const b1 = playersById.get(match.teamB[0]);
    const b2 = playersById.get(match.teamB[1]);

    if (!a1 || !a2 || !b1 || !b2) continue;

    const prevA1 = ratingsById.get(a1.id) ?? INITIAL_RATING;
    const prevA2 = ratingsById.get(a2.id) ?? INITIAL_RATING;
    const prevB1 = ratingsById.get(b1.id) ?? INITIAL_RATING;
    const prevB2 = ratingsById.get(b2.id) ?? INITIAL_RATING;

    const avgA = (prevA1 + prevA2) / 2;
    const avgB = (prevB1 + prevB2) / 2;
    const actualA = match.winner === 'A' ? 1 : 0;
    const expectedA = 1 / (1 + 10 ** ((avgB - avgA) / 400));
    const deltaA = Math.round(K_FACTOR * (actualA - expectedA));
    const deltaB = -deltaA;

    ratingsById.set(a1.id, prevA1 + deltaA);
    ratingsById.set(a2.id, prevA2 + deltaA);
    ratingsById.set(b1.id, prevB1 + deltaB);
    ratingsById.set(b2.id, prevB2 + deltaB);

    timeline.push({
      ...match,
      deltas: {
        teamA: [deltaA, deltaA],
        teamB: [deltaB, deltaB]
      },
      ratingsAfter: {
        [a1.id]: prevA1 + deltaA,
        [a2.id]: prevA2 + deltaA,
        [b1.id]: prevB1 + deltaB,
        [b2.id]: prevB2 + deltaB
      }
    });
  }

  return timeline;
}

function getHistoryTotalPages() {
  return Math.max(1, Math.ceil(buildHistoryTimeline().length / HISTORY_PAGE_SIZE));
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
  els.undoLastActionBtn.disabled = state.undoStack.length === 0;
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

  const currentEditPlayer = els.editPlayerSelect.value;
  els.editPlayerSelect.innerHTML = [
    '<option value="">Selecione jogador</option>',
    ...state.players.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
  ].join('');
  if (currentEditPlayer && state.players.some((p) => p.id === currentEditPlayer)) {
    els.editPlayerSelect.value = currentEditPlayer;
  } else {
    els.editPlayerName.value = '';
  }

  const currentHistoryPlayer = els.historyPlayerFilter.value || 'all';
  els.historyPlayerFilter.innerHTML = [
    '<option value="all">Todos os jogadores</option>',
    ...state.players.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
  ].join('');
  if (currentHistoryPlayer === 'all' || state.players.some((p) => p.id === currentHistoryPlayer)) {
    els.historyPlayerFilter.value = currentHistoryPlayer;
  } else {
    els.historyPlayerFilter.value = 'all';
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
    els.historyPageInfo.textContent = 'Página 1 de 1';
    els.prevHistoryPageBtn.disabled = true;
    els.nextHistoryPageBtn.disabled = true;
    return;
  }

  const byId = new Map(state.players.map((p) => [p.id, p.name]));
  const items = buildHistoryTimeline().reverse();
  const totalPages = Math.max(1, Math.ceil(items.length / HISTORY_PAGE_SIZE));
  historyPage = Math.min(historyPage, totalPages);
  historyPage = Math.max(1, historyPage);

  const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
  const pageItems = items.slice(start, start + HISTORY_PAGE_SIZE);

  els.historyPageInfo.textContent = `Página ${historyPage} de ${totalPages}`;
  els.prevHistoryPageBtn.disabled = historyPage <= 1;
  els.nextHistoryPageBtn.disabled = historyPage >= totalPages;

  els.historyList.innerHTML = pageItems
    .map((m) => {
      const teamA = `${byId.get(m.teamA[0]) ?? 'Desconhecido'} + ${byId.get(m.teamA[1]) ?? 'Desconhecido'}`;
      const teamB = `${byId.get(m.teamB[0]) ?? 'Desconhecido'} + ${byId.get(m.teamB[1]) ?? 'Desconhecido'}`;
      const winner = m.winner === 'A' ? 'Dupla A' : 'Dupla B';
      const date = new Date(m.playedAt).toLocaleString('pt-BR');
      const a1Delta = m.deltas?.teamA?.[0] ?? 0;
      const a2Delta = m.deltas?.teamA?.[1] ?? 0;
      const b1Delta = m.deltas?.teamB?.[0] ?? 0;
      const b2Delta = m.deltas?.teamB?.[1] ?? 0;
      const a1After = m.ratingsAfter?.[m.teamA[0]] ?? INITIAL_RATING;
      const a2After = m.ratingsAfter?.[m.teamA[1]] ?? INITIAL_RATING;
      const b1After = m.ratingsAfter?.[m.teamB[0]] ?? INITIAL_RATING;
      const b2After = m.ratingsAfter?.[m.teamB[1]] ?? INITIAL_RATING;

      return `
        <li class="matchItem">
          <div class="matchTop">
            <strong>${escapeHtml(teamA)} vs ${escapeHtml(teamB)}</strong>
            <small>${date}</small>
          </div>
          <div class="matchTeams">
            <small>Vencedores: ${winner}</small>
            <div class="matchSides">
              <div class="matchSide">
                <strong>Dupla A</strong>
                <small class="${a1Delta >= 0 ? 'pointWin' : 'pointLoss'}">${escapeHtml(byId.get(m.teamA[0]) ?? 'Desconhecido')}: ${formatPointDelta(a1Delta)} | saldo: ${a1After}</small>
                <small class="${a2Delta >= 0 ? 'pointWin' : 'pointLoss'}">${escapeHtml(byId.get(m.teamA[1]) ?? 'Desconhecido')}: ${formatPointDelta(a2Delta)} | saldo: ${a2After}</small>
              </div>
              <div class="matchSide">
                <strong>Dupla B</strong>
                <small class="${b1Delta >= 0 ? 'pointWin' : 'pointLoss'}">${escapeHtml(byId.get(m.teamB[0]) ?? 'Desconhecido')}: ${formatPointDelta(b1Delta)} | saldo: ${b1After}</small>
                <small class="${b2Delta >= 0 ? 'pointWin' : 'pointLoss'}">${escapeHtml(byId.get(m.teamB[1]) ?? 'Desconhecido')}: ${formatPointDelta(b2Delta)} | saldo: ${b2After}</small>
              </div>
            </div>
          </div>
          <button type="button" class="secondary" data-undo-id="${m.id}">Reverter resultado</button>
        </li>
      `;
    })
    .join('');
}

function findMatchById(matchId) {
  return structuredCloneSafe(state.matches.find((m) => m.id === matchId));
}

function pushUndoAction(action) {
  state.undoStack.push(structuredCloneSafe(action));
  if (state.undoStack.length > 50) state.undoStack.shift();
}

function undoLastAction() {
  const action = state.undoStack.pop();
  if (!action) {
    toast('Não há ação para desfazer.');
    return;
  }

  if (action.type === 'deletePlayer') {
    state.matches = state.matches.filter((m) => !m.teamA.includes(action.playerId) && !m.teamB.includes(action.playerId));
    state.players = state.players.filter((p) => p.id !== action.playerId);
  }

  if (action.type === 'deleteMatch') {
    state.matches = state.matches.filter((m) => m.id !== action.matchId);
  }

  if (action.type === 'restoreMatch' && action.match) {
    state.matches.push(action.match);
  }

  recalculateFromHistory();
  historyPage = 1;
  saveState();
  refreshUI();
  toast('Última ação desfeita.');
}

function formatPointDelta(value) {
  return value > 0 ? `+${value}` : String(value);
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
    if (!raw) return { players: [], matches: [], undoStack: [] };
    const parsed = JSON.parse(raw);
    return {
      players: Array.isArray(parsed.players) ? parsed.players : [],
      matches: Array.isArray(parsed.matches) ? parsed.matches : [],
      undoStack: Array.isArray(parsed.undoStack) ? parsed.undoStack : []
    };
  } catch {
    return { players: [], matches: [], undoStack: [] };
  }
}

function structuredCloneSafe(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
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
