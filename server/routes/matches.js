import express from 'express';
import { getDatabase } from '../database.js';
import { generateId, calculateRatingChange } from '../utils.js';

const router = express.Router();
const INITIAL_RATING = 1000;
const K_FACTOR = 32;

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

        const playerIds = [match.team_a_p1, match.team_a_p2, match.team_b_p1, match.team_b_p2];

        // Delete match and its deltas
        db.run('DELETE FROM match_deltas WHERE match_id = ?', [req.params.id], (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          db.run('DELETE FROM matches WHERE id = ?', [req.params.id], (err) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }

            // Recalculate all affected players
            let recalcCount = 0;
            playerIds.forEach(playerId => {
              recalculatePlayerStats(db, playerId, () => {
                recalcCount++;
                if (recalcCount === 4) {
                  res.json({ message: 'Match deleted and ratings recalculated', id: req.params.id });
                }
              });
            });
          });
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function recalculatePlayerStats(db, playerId, callback) {
  // Reset player
  db.run(
    'UPDATE players SET rating = ?, games = 0, wins = 0, losses = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [INITIAL_RATING, playerId],
    (err) => {
      if (err) {
        return callback();
      }

      // Get all matches involving this player
      db.all(
        'SELECT * FROM matches WHERE team_a_p1 = ? OR team_a_p2 = ? OR team_b_p1 = ? OR team_b_p2 = ? ORDER BY played_at ASC',
        [playerId, playerId, playerId, playerId],
        (err, matches) => {
          if (err || !matches || matches.length === 0) {
            return callback();
          }

          let currentRating = INITIAL_RATING;
          let games = 0;
          let wins = 0;
          let matchCount = 0;

          matches.forEach(match => {
            const isTeamA = match.team_a_p1 === playerId || match.team_a_p2 === playerId;
            const won = (isTeamA && match.winner === 'A') || (!isTeamA && match.winner === 'B');

            const teammateName = isTeamA 
              ? (match.team_a_p1 === playerId ? match.team_a_p2 : match.team_a_p1)
              : (match.team_b_p1 === playerId ? match.team_b_p2 : match.team_b_p1);

            const opponents = isTeamA 
              ? [match.team_b_p1, match.team_b_p2]
              : [match.team_a_p1, match.team_a_p2];

            let dataReady = 0;
            let teammate, opp1, opp2;

            // Get teammate rating
            db.get('SELECT rating FROM players WHERE id = ?', [teammateName], (err, t) => {
              if (!err && t) teammate = t.rating;
              dataReady++;
              if (dataReady === 3) processMatch();
            });

            // Get opponent ratings
            db.get('SELECT rating FROM players WHERE id = ?', [opponents[0]], (err, o) => {
              if (!err && o) opp1 = o.rating;
              dataReady++;
              if (dataReady === 3) processMatch();
            });

            db.get('SELECT rating FROM players WHERE id = ?', [opponents[1]], (err, o) => {
              if (!err && o) opp2 = o.rating;
              dataReady++;
              if (dataReady === 3) processMatch();
            });

            function processMatch() {
              const teamAvg = (currentRating + (teammate || INITIAL_RATING)) / 2;
              const oppAvg = ((opp1 || INITIAL_RATING) + (opp2 || INITIAL_RATING)) / 2;

              const { deltaA, deltaB } = calculateRatingChange(teamAvg, oppAvg, won, K_FACTOR);
              const delta = isTeamA ? deltaA : deltaB;

              currentRating += delta;
              games += 1;
              if (won) wins += 1;

              matchCount++;
              if (matchCount === matches.length) {
                // Update player with recalculated stats
                db.run(
                  'UPDATE players SET rating = ?, games = ?, wins = ?, losses = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                  [currentRating, games, wins, games - wins, playerId],
                  (err) => {
                    callback();
                  }
                );
              }
            }
          });
        }
      );
    }
  );
}

export default router;
