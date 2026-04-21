const API_BASE = '/api';
const HISTORY_PAGE_SIZE = 5;

let state = {
  players: [],
  matches: []
};

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
  rankingBody: document.getElementById('rankingBody'),
  historyList: document.getElementById('historyList'),
  historyPageInfo: document.getElementById('historyPageInfo'),
  prevHistoryPageBtn: document.getElementById('prevHistoryPageBtn'),
  nextHistoryPageBtn: document.getElementById('nextHistoryPageBtn'),
  totalPlayers: document.getElementById('totalPlayers'),
  totalMatches: document.getElementById('totalMatches'),
  toast: document.getElementById('toast')
};

init();

async function init() {
  wireEvents();
  await loadData();
  refreshUI();
}

function wireEvents() {
  els.playerForm.addEventListener('submit', addPlayer);
  els.editPlayerSelect.addEventListener('change', onPlayerSelectChange);
  els.editPlayerForm.addEventListener('submit', updatePlayerName);
  els.deletePlayerBtn.addEventListener('click', deletePlayer);
  els.matchForm.addEventListener('submit', recordMatch);
  els.prevHistoryPageBtn.addEventListener('click', () => {
    historyPage = Math.max(1, historyPage - 1);
    renderHistory();
  });
  els.nextHistoryPageBtn.addEventListener('click', () => {
    historyPage++;
    renderHistory();
  });
}

// API calls
async function apiCall(method, endpoint, body = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || response.statusText);
    }

    return await response.json();
  } catch (error) {
    toast(error.message);
    console.error(error);
    throw error;
  }
}

async function loadData() {
  try {
    state.players = await apiCall('GET', '/players');
    state.matches = await apiCall('GET', '/matches');
  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

async function addPlayer(event) {
  event.preventDefault();
  const name = els.playerName.value.trim();
  
  if (!name) return;

  try {
    await apiCall('POST', '/players', { name });
    await loadData();
    refreshUI();
    els.playerForm.reset();
    toast('Jogador adicionado com sucesso.');
  } catch (error) {
    // Error already shown in apiCall
  }
}

function onPlayerSelectChange() {
  const player = state.players.find((p) => p.id === els.editPlayerSelect.value);
  els.editPlayerName.value = player?.name ?? '';
}

async function updatePlayerName(event) {
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

  try {
    await apiCall('PUT', `/players/${playerId}`, { name: newName });
    await loadData();
    refreshUI();
    toast('Nome do jogador atualizado.');
  } catch (error) {
    // Error already shown
  }
}

async function deletePlayer() {
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

  const ok = confirm(`Remover ${player.name}? Todas as suas partidas também serão removidas.`);
  if (!ok) return;

  try {
    await apiCall('DELETE', `/players/${playerId}`);
    await loadData();
    refreshUI();
    els.editPlayerName.value = '';
    toast('Jogador removido com sucesso.');
  } catch (error) {
    // Error already shown
  }
}

async function recordMatch(event) {
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

  try {
    await apiCall('POST', '/matches', { teamA, teamB, winner });
    await loadData();
    refreshUI();
    els.matchForm.reset();
    historyPage = 1;
    toast('Partida registrada com sucesso.');
  } catch (error) {
    // Error already shown
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
  const items = [...state.matches].reverse();
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
      const teamA = `${byId.get(m.team_a_p1) ?? 'Desconhecido'} + ${byId.get(m.team_a_p2) ?? 'Desconhecido'}`;
      const teamB = `${byId.get(m.team_b_p1) ?? 'Desconhecido'} + ${byId.get(m.team_b_p2) ?? 'Desconhecido'}`;
      const winner = m.winner === 'A' ? 'Dupla A' : 'Dupla B';
      const date = new Date(m.played_at).toLocaleString('pt-BR');

      const deltas = m.deltas || {};
      const a1Delta = deltas[m.team_a_p1]?.delta ?? 0;
      const a2Delta = deltas[m.team_a_p2]?.delta ?? 0;
      const b1Delta = deltas[m.team_b_p1]?.delta ?? 0;
      const b2Delta = deltas[m.team_b_p2]?.delta ?? 0;
      const a1After = deltas[m.team_a_p1]?.after ?? 1000;
      const a2After = deltas[m.team_a_p2]?.after ?? 1000;
      const b1After = deltas[m.team_b_p1]?.after ?? 1000;
      const b2After = deltas[m.team_b_p2]?.after ?? 1000;

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
                <small class="${a1Delta >= 0 ? 'pointWin' : 'pointLoss'}">${escapeHtml(byId.get(m.team_a_p1) ?? 'Desconhecido')}: ${formatPointDelta(a1Delta)} | saldo: ${a1After}</small>
                <small class="${a2Delta >= 0 ? 'pointWin' : 'pointLoss'}">${escapeHtml(byId.get(m.team_a_p2) ?? 'Desconhecido')}: ${formatPointDelta(a2Delta)} | saldo: ${a2After}</small>
              </div>
              <div class="matchSide">
                <strong>Dupla B</strong>
                <small class="${b1Delta >= 0 ? 'pointWin' : 'pointLoss'}">${escapeHtml(byId.get(m.team_b_p1) ?? 'Desconhecido')}: ${formatPointDelta(b1Delta)} | saldo: ${b1After}</small>
                <small class="${b2Delta >= 0 ? 'pointWin' : 'pointLoss'}">${escapeHtml(byId.get(m.team_b_p2) ?? 'Desconhecido')}: ${formatPointDelta(b2Delta)} | saldo: ${b2After}</small>
              </div>
            </div>
          </div>
          <button type="button" class="secondary" onclick="deleteMatch('${m.id}')">Reverter resultado</button>
        </li>
      `;
    })
    .join('');
}

async function deleteMatch(matchId) {
  const ok = confirm('Reverter esta partida? O ranking será recalculado.');
  if (!ok) return;

  try {
    await apiCall('DELETE', `/matches/${matchId}`);
    await loadData();
    refreshUI();
    toast('Partida revertida com sucesso.');
  } catch (error) {
    // Error already shown
  }
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.style.display = 'block';
  setTimeout(() => {
    els.toast.style.display = 'none';
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatPointDelta(delta) {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta}`;
}
