import express from 'express';
import { getDatabase } from '../database.js';
import { generateId, calculateRatingChange } from '../utils.js';

const router = express.Router();
const INITIAL_RATING = 1000;
const K_FACTOR = 32;
const WIN_LOSS_STEP = 16;

// Get all matches
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    db.all(
      'SELECT * FROM matches ORDER BY played_at DESC LIMIT 100',
      (err, matches) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (!matches) {
          return res.json([]);
        }

        // Enrich with player details and deltas
        let enrichedCount = 0;
        const enriched = matches.map(match => {
          const result = { ...match, deltas: {} };
          
          db.all(
            'SELECT player_id, delta_rating, rating_after FROM match_deltas WHERE match_id = ?',
            [match.id],
            (err, deltas) => {
              if (!err && deltas) {
                deltas.forEach(d => {
                  result.deltas[d.player_id] = { delta: d.delta_rating, after: d.rating_after };
                });
              }
              enrichedCount++;
              if (enrichedCount === matches.length) {
                res.json(enriched);
              }
            }
          );
          
          return result;
        });

        if (matches.length === 0) {
          res.json([]);
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get match by ID
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.get(
      'SELECT * FROM matches WHERE id = ?',
      [req.params.id],
      (err, match) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (!match) {
          return res.status(404).json({ error: 'Match not found' });
        }

        db.all(
          'SELECT player_id, delta_rating, rating_after FROM match_deltas WHERE match_id = ?',
          [req.params.id],
          (err, deltas) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }

            const deltaMap = {};
            if (deltas) {
              deltas.forEach(d => {
                deltaMap[d.player_id] = { delta: d.delta_rating, after: d.rating_after };
              });
            }

            res.json({ ...match, deltas: deltaMap });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record new match
router.post('/', (req, res) => {
  try {
    const { teamA, teamB, winner } = req.body;

    if (!teamA || !teamB || teamA.length !== 2 || teamB.length !== 2) {
      return res.status(400).json({ error: 'Invalid teams' });
    }

    if (winner !== 'A' && winner !== 'B') {
      return res.status(400).json({ error: 'Invalid winner' });
    }

    const uniquePlayers = new Set([...teamA, ...teamB]);
    if (uniquePlayers.size !== 4) {
      return res.status(400).json({ error: 'All players in a match must be unique' });
    }

    const db = getDatabase();

    // Validate all players exist
    const playerIds = [...teamA, ...teamB];
    let validPlayers = 0;

    playerIds.forEach(playerId => {
      db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, player) => {
        if (!player && !err) {
          return res.status(400).json({ error: `Player ${playerId} not found` });
        }
        validPlayers++;

        if (validPlayers === 4) {
          // All players exist, proceed with match recording
          recordMatchWithRatings(db, teamA, teamB, winner, res);
        }
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recalculate all ratings using only wins/losses (+16/-16 per match)
router.post('/recalculate-mmr', (req, res) => {
  try {
    const requiredKey = process.env.MMR_RECALC_KEY;
    const providedKey = req.get('x-admin-key') || req.query.key;

    if (requiredKey && providedKey !== requiredKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDatabase();

    recalculateByWinsAndLosses(db, (err, summary) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({
        message: 'MMR recalculated from wins/losses',
        ...summary
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function recordMatchWithRatings(db, teamA, teamB, winner, res) {
  // Get current ratings
  let playersData = {};
  let playerCount = 0;

  [teamA[0], teamA[1], teamB[0], teamB[1]].forEach(id => {
    db.get('SELECT * FROM players WHERE id = ?', [id], (err, player) => {
      if (!err && player) {
        playersData[id] = player;
      }
      playerCount++;

      if (playerCount === 4) {
        const a1 = playersData[teamA[0]];
        const a2 = playersData[teamA[1]];
        const b1 = playersData[teamB[0]];
        const b2 = playersData[teamB[1]];

        if (!a1 || !a2 || !b1 || !b2) {
          return res.status(400).json({ error: 'Invalid player data' });
        }

        const avgA = (a1.rating + a2.rating) / 2;
        const avgB = (b1.rating + b2.rating) / 2;
        const teamAWon = winner === 'A';

        const { deltaA, deltaB } = calculateRatingChange(avgA, avgB, teamAWon, K_FACTOR);

        const matchId = generateId();
        const newRatingA1 = a1.rating + deltaA;
        const newRatingA2 = a2.rating + deltaA;
        const newRatingB1 = b1.rating + deltaB;
        const newRatingB2 = b2.rating + deltaB;

        // Insert match
        db.run(
          'INSERT INTO matches (id, team_a_p1, team_a_p2, team_b_p1, team_b_p2, winner, played_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
          [matchId, teamA[0], teamA[1], teamB[0], teamB[1], winner],
          (err) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }

            // Update player ratings
            const players = [
              [newRatingA1, teamAWon ? 1 : 0, teamA[0]],
              [newRatingA2, teamAWon ? 1 : 0, teamA[1]],
              [newRatingB1, teamAWon ? 0 : 1, teamB[0]],
              [newRatingB2, teamAWon ? 0 : 1, teamB[1]]
            ];

            let updatedCount = 0;
            players.forEach(([newRating, win, playerId]) => {
              const isWin = win === 1;
              db.run(
                `UPDATE players SET rating = ?, games = games + 1, ${isWin ? 'wins = wins + 1' : 'losses = losses + 1'}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [newRating, playerId],
                (err) => {
                  updatedCount++;
                  if (updatedCount === 4) {
                    // Insert deltas
                    insertDeltas(db, matchId, teamA, teamB, deltaA, deltaB, newRatingA1, newRatingA2, newRatingB1, newRatingB2, res);
                  }
                }
              );
            });
          }
        );
      }
    });
  });
}

function insertDeltas(db, matchId, teamA, teamB, deltaA, deltaB, newRatingA1, newRatingA2, newRatingB1, newRatingB2, res) {
  const deltas = [
    [matchId, teamA[0], deltaA, newRatingA1],
    [matchId, teamA[1], deltaA, newRatingA2],
    [matchId, teamB[0], deltaB, newRatingB1],
    [matchId, teamB[1], deltaB, newRatingB2]
  ];

  let deltaCount = 0;
  deltas.forEach(([mid, pid, delta, ratingAfter]) => {
    db.run(
      'INSERT INTO match_deltas (id, match_id, player_id, delta_rating, rating_after) VALUES (?, ?, ?, ?, ?)',
      [generateId(), mid, pid, delta, ratingAfter],
      (err) => {
        deltaCount++;
        if (deltaCount === 4) {
          db.get('SELECT * FROM matches WHERE id = ?', [matchId], (err, match) => {
            res.status(201).json(match);
          });
        }
      }
    );
  });
}

// Delete match and recalculate ratings
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.get(
      'SELECT * FROM matches WHERE id = ?',
      [req.params.id],
      (err, match) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (!match) {
          return res.status(404).json({ error: 'Match not found' });
        }

        // Delete match and its deltas
        db.run('DELETE FROM match_deltas WHERE match_id = ?', [req.params.id], (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          db.run('DELETE FROM matches WHERE id = ?', [req.params.id], (err) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }

            recalculateAllRatingsAndDeltas(db, (recalcErr) => {
              if (recalcErr) {
                return res.status(500).json({ error: recalcErr.message });
              }

              res.json({ message: 'Match deleted and ratings recalculated', id: req.params.id });
            });
          });
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function recalculateAllRatingsAndDeltas(db, callback) {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) {
        return callback(beginErr);
      }

      db.run(
        'UPDATE players SET rating = ?, games = 0, wins = 0, losses = 0, updated_at = CURRENT_TIMESTAMP',
        [INITIAL_RATING],
        (resetErr) => {
          if (resetErr) {
            return db.run('ROLLBACK', () => callback(resetErr));
          }

          db.run('DELETE FROM match_deltas', (deleteDeltasErr) => {
            if (deleteDeltasErr) {
              return db.run('ROLLBACK', () => callback(deleteDeltasErr));
            }

            db.all(
              'SELECT * FROM matches ORDER BY played_at ASC, created_at ASC, id ASC',
              (matchesErr, matches) => {
                if (matchesErr) {
                  return db.run('ROLLBACK', () => callback(matchesErr));
                }

                if (!matches || matches.length === 0) {
                  return db.run('COMMIT', callback);
                }

                db.all('SELECT id FROM players', (playersErr, players) => {
                  if (playersErr) {
                    return db.run('ROLLBACK', () => callback(playersErr));
                  }

                  const playerStats = new Map(
                    (players || []).map((player) => [
                      player.id,
                      { rating: INITIAL_RATING, games: 0, wins: 0, losses: 0 }
                    ])
                  );

                  const deltaRows = [];

                  for (const match of matches) {
                    const ids = [match.team_a_p1, match.team_a_p2, match.team_b_p1, match.team_b_p2];
                    const [a1Id, a2Id, b1Id, b2Id] = ids;
                    const a1 = playerStats.get(a1Id);
                    const a2 = playerStats.get(a2Id);
                    const b1 = playerStats.get(b1Id);
                    const b2 = playerStats.get(b2Id);

                    if (!a1 || !a2 || !b1 || !b2) {
                      continue;
                    }

                    const teamAWon = match.winner === 'A';
                    const avgA = (a1.rating + a2.rating) / 2;
                    const avgB = (b1.rating + b2.rating) / 2;
                    const { deltaA, deltaB } = calculateRatingChange(avgA, avgB, teamAWon, K_FACTOR);

                    a1.rating += deltaA;
                    a2.rating += deltaA;
                    b1.rating += deltaB;
                    b2.rating += deltaB;

                    a1.games += 1;
                    a2.games += 1;
                    b1.games += 1;
                    b2.games += 1;

                    if (teamAWon) {
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

                    deltaRows.push(
                      [generateId(), match.id, a1Id, deltaA, a1.rating],
                      [generateId(), match.id, a2Id, deltaA, a2.rating],
                      [generateId(), match.id, b1Id, deltaB, b1.rating],
                      [generateId(), match.id, b2Id, deltaB, b2.rating]
                    );
                  }

                  const updates = Array.from(playerStats.entries());
                  runPlayerUpdates(db, updates, 0, (updateErr) => {
                    if (updateErr) {
                      return db.run('ROLLBACK', () => callback(updateErr));
                    }

                    runDeltaInserts(db, deltaRows, 0, (deltaErr) => {
                      if (deltaErr) {
                        return db.run('ROLLBACK', () => callback(deltaErr));
                      }

                      db.run('COMMIT', callback);
                    });
                  });
                });
              }
            );
          });
        }
      );
    });
  });
}

function runPlayerUpdates(db, updates, index, callback) {
  if (index >= updates.length) {
    return callback();
  }

  const [playerId, stats] = updates[index];

  db.run(
    'UPDATE players SET rating = ?, games = ?, wins = ?, losses = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [stats.rating, stats.games, stats.wins, stats.losses, playerId],
    (err) => {
      if (err) {
        return callback(err);
      }

      runPlayerUpdates(db, updates, index + 1, callback);
    }
  );
}

function runDeltaInserts(db, deltaRows, index, callback) {
  if (index >= deltaRows.length) {
    return callback();
  }

  const [id, matchId, playerId, delta, ratingAfter] = deltaRows[index];

  db.run(
    'INSERT INTO match_deltas (id, match_id, player_id, delta_rating, rating_after) VALUES (?, ?, ?, ?, ?)',
    [id, matchId, playerId, delta, ratingAfter],
    (err) => {
      if (err) {
        return callback(err);
      }

      runDeltaInserts(db, deltaRows, index + 1, callback);
    }
  );
}

function recalculateByWinsAndLosses(db, callback) {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) {
        return callback(beginErr);
      }

      db.all('SELECT id FROM players', (playersErr, players) => {
        if (playersErr) {
          return db.run('ROLLBACK', () => callback(playersErr));
        }

        const statsById = new Map(
          (players || []).map((player) => [
            player.id,
            { rating: INITIAL_RATING, games: 0, wins: 0, losses: 0 }
          ])
        );

        db.run(
          'UPDATE players SET rating = ?, games = 0, wins = 0, losses = 0, updated_at = CURRENT_TIMESTAMP',
          [INITIAL_RATING],
          (resetErr) => {
            if (resetErr) {
              return db.run('ROLLBACK', () => callback(resetErr));
            }

            db.run('DELETE FROM match_deltas', (deleteErr) => {
              if (deleteErr) {
                return db.run('ROLLBACK', () => callback(deleteErr));
              }

              db.all(
                'SELECT * FROM matches ORDER BY played_at ASC, created_at ASC, id ASC',
                (matchesErr, matches) => {
                  if (matchesErr) {
                    return db.run('ROLLBACK', () => callback(matchesErr));
                  }

                  const deltaRows = [];

                  for (const match of matches || []) {
                    const teamAIds = [match.team_a_p1, match.team_a_p2];
                    const teamBIds = [match.team_b_p1, match.team_b_p2];
                    const winners = match.winner === 'A' ? teamAIds : teamBIds;
                    const losers = match.winner === 'A' ? teamBIds : teamAIds;
                    const participants = [...teamAIds, ...teamBIds];

                    const allPresent = participants.every((id) => statsById.has(id));
                    if (!allPresent) {
                      continue;
                    }

                    for (const playerId of participants) {
                      const stats = statsById.get(playerId);
                      stats.games += 1;
                    }

                    for (const playerId of winners) {
                      const stats = statsById.get(playerId);
                      stats.wins += 1;
                      stats.rating += WIN_LOSS_STEP;
                      deltaRows.push([generateId(), match.id, playerId, WIN_LOSS_STEP, stats.rating]);
                    }

                    for (const playerId of losers) {
                      const stats = statsById.get(playerId);
                      stats.losses += 1;
                      stats.rating -= WIN_LOSS_STEP;
                      deltaRows.push([generateId(), match.id, playerId, -WIN_LOSS_STEP, stats.rating]);
                    }
                  }

                  const updates = Array.from(statsById.entries());
                  runPlayerUpdates(db, updates, 0, (updateErr) => {
                    if (updateErr) {
                      return db.run('ROLLBACK', () => callback(updateErr));
                    }

                    runDeltaInserts(db, deltaRows, 0, (deltaErr) => {
                      if (deltaErr) {
                        return db.run('ROLLBACK', () => callback(deltaErr));
                      }

                      db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                          return callback(commitErr);
                        }

                        callback(null, {
                          playersUpdated: updates.length,
                          matchesProcessed: (matches || []).length,
                          stepPerWin: WIN_LOSS_STEP
                        });
                      });
                    });
                  });
                }
              );
            });
          }
        );
      });
    });
  });
}

export default router;
