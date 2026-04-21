import express from 'express';
import { getDatabase } from '../database.js';
import { generateId } from '../utils.js';

const router = express.Router();

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

export default router;
