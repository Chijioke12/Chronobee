import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static assets from the root directory
app.use(express.static('.'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Highscore storage (custom gameplay scoreboard server-side proxy)
const highScores = [
  { name: 'KAI_MASTER', score: 1250, date: '2026-05-28T10:15:00Z' },
  { name: 'CYBER_BEE', score: 840, date: '2026-05-29T14:22:00Z' },
  { name: 'GLIDE_BOT', score: 510, date: '2026-05-30T11:45:00Z' }
];

app.get('/api/scores', (req, res) => {
  res.json(highScores);
});

app.post('/api/scores', express.json(), (req, res) => {
  const { name, score } = req.body;
  if (score !== undefined) {
    highScores.push({ name: name || 'PLAYER', score: Number(score), date: new Date().toISOString() });
    highScores.sort((a, b) => b.score - a.score);
    // Keep top 10 positions
    if (highScores.length > 10) highScores.length = 10;
  }
  res.json({ success: true, scores: highScores });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Custom lightweight server starting up on configuration port ${PORT}`);
});
