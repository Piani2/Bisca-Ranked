import express from 'express';
import { getDatabase } from '../database.js';
import { generateId } from '../utils.js';

const router = express.Router();

// Bulk import or update players stats
router.post('/import-stats', (req, res) => {
  try {
    const requiredKey = process.env.PLAYER_IMPORT_KEY;
    const providedKey = req.get('x-admin-key') || req.query.key;

    if (requiredKey && providedKey !== requiredKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = req.body;
    const players = Array.isArray(payload) ? payload : payload?.players;

    if (!Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: 'Body must be a non-empty array of players or { players: [...] }' });
    }

    const normalized = [];
    for (const item of players) {
      const name = typeof item?.name === 'string' ? item.name.trim() : '';
      const rating = Number(item?.rating);
      const games = Number(item?.games);
      const wins = Number(item?.wins);
      const losses = Number(item?.losses);

      if (!name || !Number.isFinite(rating) || !Number.isFinite(games) || !Number.isFinite(wins) || !Number.isFinite(losses)) {
        return res.status(400).json({ error: 'Each player needs name, rating, games, wins, losses as valid values' });
      }

      if (games < 0 || wins < 0 || losses < 0 || wins + losses !== games) {
        return res.status(400).json({ error: `Invalid stats for ${name}. Require games >= 0, wins >= 0, losses >= 0 and wins + losses = games` });
      }

      normalized.push({
        name,
        rating: Math.round(rating),
        games: Math.round(games),
        wins: Math.round(wins),
        losses: Math.round(losses)
      });
    }

    const db = getDatabase();
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) {
          return res.status(500).json({ error: beginErr.message });
        }

        const result = {
          inserted: 0,
          updated: 0,
          total: normalized.length
        };

        processImportedPlayer(db, normalized, 0, result, (err) => {
          if (err) {
            return db.run('ROLLBACK', () => res.status(500).json({ error: err.message }));
          }

          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              return db.run('ROLLBACK', () => res.status(500).json({ error: commitErr.message }));
            }

            res.json({
              message: 'Players imported successfully',
              ...result
            });
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all players ranked by rating
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    db.all(
      'SELECT * FROM players ORDER BY rating DESC, wins DESC, name ASC',
      (err, players) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json(players);
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single player by ID
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.get(
      'SELECT * FROM players WHERE id = ?',
      [req.params.id],
      (err, player) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else if (!player) {
          res.status(404).json({ error: 'Player not found' });
        } else {
          res.json(player);
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new player
router.post('/', (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Invalid name' });
    }

    const db = getDatabase();
    
    db.get(
      'SELECT id FROM players WHERE LOWER(name) = LOWER(?)',
      [name],
      (err, exists) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (exists) {
          return res.status(409).json({ error: 'Player already exists' });
        }

        const id = generateId();
        db.run(
          'INSERT INTO players (id, name, rating, games, wins, losses) VALUES (?, ?, 1000, 0, 0, 0)',
          [id, name],
          function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }

            db.get('SELECT * FROM players WHERE id = ?', [id], (err, player) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              res.status(201).json(player);
            });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update player name
router.put('/:id', (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Invalid name' });
    }

    const db = getDatabase();
    
    db.get(
      'SELECT * FROM players WHERE id = ?',
      [req.params.id],
      (err, player) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (!player) {
          return res.status(404).json({ error: 'Player not found' });
        }

        db.get(
          'SELECT id FROM players WHERE LOWER(name) = LOWER(?) AND id != ?',
          [name, req.params.id],
          (err, exists) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }

            if (exists) {
              return res.status(409).json({ error: 'Player name already in use' });
            }

            db.run(
              'UPDATE players SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [name, req.params.id],
              (err) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }

                db.get('SELECT * FROM players WHERE id = ?', [req.params.id], (err, updated) => {
                  if (err) {
                    return res.status(500).json({ error: err.message });
                  }
                  res.json(updated);
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete player
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    
    db.get(
      'SELECT * FROM players WHERE id = ?',
      [req.params.id],
      (err, player) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (!player) {
          return res.status(404).json({ error: 'Player not found' });
        }

        db.run('DELETE FROM players WHERE id = ?', [req.params.id], (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({ message: 'Player deleted', id: req.params.id });
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function processImportedPlayer(db, players, index, result, callback) {
  if (index >= players.length) {
    return callback();
  }

  const player = players[index];

  db.get(
    'SELECT id FROM players WHERE LOWER(name) = LOWER(?)',
    [player.name],
    (findErr, existing) => {
      if (findErr) {
        return callback(findErr);
      }

      if (existing) {
        db.run(
          'UPDATE players SET name = ?, rating = ?, games = ?, wins = ?, losses = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [player.name, player.rating, player.games, player.wins, player.losses, existing.id],
          (updateErr) => {
            if (updateErr) {
              return callback(updateErr);
            }

            result.updated += 1;
            processImportedPlayer(db, players, index + 1, result, callback);
          }
        );
      } else {
        db.run(
          'INSERT INTO players (id, name, rating, games, wins, losses) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), player.name, player.rating, player.games, player.wins, player.losses],
          (insertErr) => {
            if (insertErr) {
              return callback(insertErr);
            }

            result.inserted += 1;
            processImportedPlayer(db, players, index + 1, result, callback);
          }
        );
      }
    }
  );
}

export default router;
