import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { RoomManager } from './platform/rooms/roomManager.js';
import { registerSocketHandlers } from './platform/net/socketHandlers.js';
import { GAME_RULES } from './games/hazari/rules.js';

const PORT = Number(process.env.PORT ?? 3001);

/**
 * Allowed browser origins.
 *
 * The previous build defaulted to '*', which lets any website on the internet
 * open a socket to this server and start creating rooms. For a private table
 * that is unnecessary exposure, so production now requires an explicit list.
 * Local development still defaults to the Vite dev server.
 */
function resolveCorsOrigins(): string[] | string {
  const configured = (process.env.ALLOWED_ORIGINS ?? process.env.CORS_ORIGIN ?? '').trim();

  if (configured) {
    if (configured === '*') return '*';
    return configured.split(',').map((o) => o.trim()).filter(Boolean);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ALLOWED_ORIGINS is not set. Set it to your Netlify site address, ' +
        'e.g. ALLOWED_ORIGINS=https://your-site.netlify.app'
    );
  }

  // Development default: the Vite dev server, on localhost and over the LAN.
  return ['http://localhost:5173', 'http://127.0.0.1:5173'];
}

const CORS_ORIGIN = resolveCorsOrigins();

// Safety: TEST_MODE must never be on in a deployed server (Section 43).
if (GAME_RULES.TEST_MODE && process.env.NODE_ENV === 'production') {
  throw new Error('GAME_RULES.TEST_MODE must be false in production.');
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
  // Slightly above Socket.IO's 1MB default to comfortably fit base64-encoded
  // voice notes (capped at ~700KB in socketHandlers.ts) plus room for
  // ordinary message overhead.
  maxHttpBufferSize: 2 * 1024 * 1024,
});

const rooms = new RoomManager();

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'haazari-server' });
});

registerSocketHandlers(io, rooms);

// Periodically clean up rooms nobody has reconnected to.
setInterval(() => rooms.sweepStaleRooms(), 60_000).unref();

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Haazari server listening on :${PORT}`);
});
