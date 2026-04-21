import { WebSocketServer, WebSocket, type RawData } from 'ws';
import type { Server as HTTPServer } from 'http';
import { handleConnection, handleMessage, handleDisconnect } from './handlers.js';

export interface WSClient extends WebSocket {
  userId?: string;
  sessionId?: string;
  isAlive?: boolean;
}

const sessions: Map<string, Set<WSClient>> = new Map();
let wss: WebSocketServer | null = null;

export function createWSServer(server: HTTPServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/matchup' });

  wss.on('connection', (ws: WSClient, req) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');
    const token = url.searchParams.get('token');

    if (!sessionId || !token) {
      ws.close(4001, 'Missing sessionId or token');
      return;
    }

    ws.userId = 'user-id';
    ws.sessionId = sessionId;
    ws.isAlive = true;

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, new Set());
    }
    sessions.get(sessionId)!.add(ws);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data: RawData) => {
      handleMessage(ws, data);
    });

    ws.on('close', () => {
      handleDisconnect(ws);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  const interval = setInterval(() => {
    wss?.clients.forEach((ws: WSClient) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}

export function broadcastToSession(
  sessionId: string,
  event: string,
  payload: unknown
): void {
  const clients = sessions.get(sessionId);
  if (!clients) return;

  const message = JSON.stringify({ type: event, payload });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function sendToClient(ws: WSClient, event: string, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: event, payload }));
  }
}

export function closeWSServer(): void {
  if (wss) {
    wss.close();
    wss = null;
  }
}