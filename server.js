require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const GAME_URL = process.env.GAME_URL;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const FILE_UTENTI = process.env.FILE_UTENTI || path.join(__dirname, 'utenti.txt');

if (!GAME_URL) {
  console.error('Manca GAME_URL nel file .env (il link del tuo gioco).');
  process.exit(1);
}

// Il file utenti.txt ha una riga per utente, nel formato: username<TAB>data
function leggiUtenti() {
  if (!fs.existsSync(FILE_UTENTI)) return [];
  return fs
    .readFileSync(FILE_UTENTI, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((riga) => riga.split('\t')[0].toLowerCase());
}

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
app.use(express.json({ limit: '1kb' }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/registrati', (req, res) => {
  const { username } = req.body || {};

  if (typeof username !== 'string' || !/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({
      errore: 'Username non valido: 3-20 caratteri, solo lettere, numeri e underscore.',
    });
  }
  if (leggiUtenti().includes(username.toLowerCase())) {
    return res.status(409).json({ errore: 'Questo username è già preso.' });
  }

  fs.appendFileSync(FILE_UTENTI, `${username}\t${new Date().toISOString()}\n`);

  // Notifica opzionale su Discord con lo username
  if (DISCORD_WEBHOOK_URL) {
    fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `Nuova registrazione: **${username}**` }),
    }).catch(() => {});
  }

  res.json({ ok: true, redirect: GAME_URL });
});

app.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
});
