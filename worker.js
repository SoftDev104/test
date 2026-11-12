// Cloudflare Worker: riceve lo username da /registrati, lo salva in KV e risponde con il link del gioco.
// La pagina (public/index.html) viene servita direttamente da Cloudflare.

function risposta(corpo, stato = 200) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname !== '/registrati') {
      return new Response('Non trovato', { status: 404 });
    }
    if (request.method !== 'POST') {
      return risposta({ errore: 'Metodo non consentito.' }, 405);
    }

    let corpo;
    try {
      const testo = await request.text();
      if (testo.length > 1024) return risposta({ errore: 'Richiesta troppo grande.' }, 413);
      corpo = JSON.parse(testo);
    } catch {
      return risposta({ errore: 'Richiesta non valida.' }, 400);
    }

    const username = corpo && corpo.username;
    if (typeof username !== 'string' || !/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      return risposta(
        { errore: 'Username non valido: 3-20 caratteri, solo lettere, numeri e underscore.' },
        400
      );
    }

    const chiave = username.toLowerCase();

    try {
      if ((await env.UTENTI.get(chiave)) !== null) {
        return risposta({ errore: 'Questo username è già preso.' }, 409);
      }
      await env.UTENTI.put(
        chiave,
        JSON.stringify({ username, creato_il: new Date().toISOString() })
      );
    } catch (err) {
      return risposta({ errore: 'Errore del server, riprova.' }, 500);
    }

    // Notifica opzionale su Discord con lo username
    if (env.DISCORD_WEBHOOK_URL) {
      ctx.waitUntil(
        fetch(env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: `Nuova registrazione: **${username}**` }),
        }).catch(() => {})
      );
    }

    return risposta({ ok: true, redirect: env.GAME_URL });
  },
};
