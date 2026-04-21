import crypto from 'crypto';

export function generateId() {
  return crypto.randomUUID();
}

export function calculateRatingChange(teamAAvg, teamBAvg, teamAWon, kFactor = 32) {
  const expectedA = 1 / (1 + Math.pow(10, (teamBAvg - teamAAvg) / 400));
  const actualA = teamAWon ? 1 : 0;
  const deltaA = Math.round(kFactor * (actualA - expectedA));
  return { deltaA, deltaB: -deltaA };
}

export function recalculatePlayerStats(db, playerId) {
  const playerStmts = {
    reset: db.prepare(`
      UPDATE players 
      SET rating = 1000, games = 0, wins = 0, losses = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `),
    getMatches: db.prepare(`
      SELECT * FROM matches 
      WHERE team_a_p1 = ? OR team_a_p2 = ? OR team_b_p1 = ? OR team_b_p2 = ?
      ORDER BY played_at ASC
    `),
    getPlayer: db.prepare('SELECT * FROM players WHERE id = ?'),
    update: db.prepare(`
      UPDATE players 
      SET rating = ?, games = ?, wins = ?, losses = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
  };

  playerStmts.reset.run(playerId);
  
  const matches = playerStmts.getMatches.all(playerId, playerId, playerId, playerId);
  const player = playerStmts.getPlayer.get(playerId);

  if (!player) return;

  let stats = { rating: 1000, games: 0, wins: 0, losses: 0 };

  for (const match of matches) {
    const isTeamA = match.team_a_p1 === playerId || match.team_a_p2 === playerId;
    const won = (isTeamA && match.winner === 'A') || (!isTeamA && match.winner === 'B');

    // Get teammate rating
    const teammateName = isTeamA 
      ? (match.team_a_p1 === playerId ? match.team_a_p2 : match.team_a_p1)
      : (match.team_b_p1 === playerId ? match.team_b_p2 : match.team_b_p1);
    
    const teammate = playerStmts.getPlayer.get(teammateName.replace('team_a_p1', '').replace('team_a_p2', '').replace('team_b_p1', '').replace('team_b_p2', ''));
    
    // This is simplified - you'd get actual teammate rating from deltas table
    const delta = db.prepare(`
      SELECT delta_rating FROM match_deltas 
      WHERE match_id = ? AND player_id = ?
    `).get(match.id, playerId);

    if (delta) {
      stats.rating += delta.delta_rating;
    }

    stats.games += 1;
    if (won) stats.wins += 1;
    else stats.losses += 1;
  }

  playerStmts.update.run(stats.rating, stats.games, stats.wins, stats.losses, playerId);
}
