import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../data');
const dbFile = path.join(dbPath, 'bisca.db');

// Ensure data directory exists
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}

let db;

export function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(dbFile, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      }
    });
    db.run('PRAGMA journal_mode = WAL');
  }
  return db;
}

export function initDatabase() {
  const database = getDatabase();
  
  database.serialize(() => {
    // Create tables
    database.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        rating INTEGER DEFAULT 1000,
        games INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        team_a_p1 TEXT NOT NULL,
        team_a_p2 TEXT NOT NULL,
        team_b_p1 TEXT NOT NULL,
        team_b_p2 TEXT NOT NULL,
        winner TEXT NOT NULL CHECK(winner IN ('A', 'B')),
        played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(team_a_p1) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY(team_a_p2) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY(team_b_p1) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY(team_b_p2) REFERENCES players(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS match_deltas (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        delta_rating INTEGER NOT NULL,
        rating_after INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
        FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches(played_at);
      CREATE INDEX IF NOT EXISTS idx_match_deltas_player ON match_deltas(player_id);
    `, (err) => {
      if (err) {
        console.error('Error creating tables:', err);
      } else {
        console.log('✅ Database initialized');
      }
    });
  });
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
