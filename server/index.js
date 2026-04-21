import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { initDatabase } from './database.js';
import playersRouter from './routes/players.js';
import matchesRouter from './routes/matches.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(dirname(__dirname) + '/public'));

// Initialize database
initDatabase();

// Routes
app.use('/api/players', playersRouter);
app.use('/api/matches', matchesRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for SPA
app.get('/', (req, res) => {
  res.sendFile(dirname(__dirname) + '/public/index.html');
});

app.listen(PORT, () => {
  console.log(`✨ Bisca Ranked rodando em http://localhost:${PORT}`);
});
