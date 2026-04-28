import type { RawData } from 'ws';
import type { WSClient } from './server.js';
import type { GameMove, CapSide, WSEvent, GameState } from '../types/index.js';
import { getGameState } from '../services/matchmaking.js';
import { commitMove } from '../engine/matchup.js';
import { sendToClient, broadcastToSession, getClientsForSession, removeClientFromSession } from './server.js';
import { prisma } from '../db/prisma.js';
import { scheduleBotMove } from '../engine/bot.js';
import { getCommittedMove } from '../services/matchmaking.js';

interface WSMessage {
  type: string;
  payload?: unknown;
}

const RECONNECT_WINDOW_MS = 30_000;
const disconnectTimers: Map<string, NodeJS.Timeout> = new Map();

function parseMessage(data: RawData): WSMessage | null {
  try {
    let str: string;
    if (typeof data === 'string') {
      str = data;
    } else if (data instanceof ArrayBuffer) {
      str = new TextDecoder().decode(data);
    } else if (Array.isArray(data)) {
      str = Buffer.concat(data).toString();
    } else {
      str = data.toString();
    }
    return JSON.parse(str) as WSMessage;
  } catch {
    return null;
  }
}

export async function handleConnection(ws: WSClient): Promise<void> {
  console.log(`Client connected: ${ws.userId} to session ${ws.sessionId}`);

  if (!ws.sessionId || !ws.userId) return;

  // Clear disconnect timer if reconnecting
  const timerKey = `${ws.sessionId}:${ws.userId}`;
  const existingTimer = disconnectTimers.get(timerKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
    disconnectTimers.delete(timerKey);
  }

  const gameState = await getGameState(ws.sessionId);
  if (gameState) {
    sendToClient(ws, 'GAME_STATE', gameState);
  }
}

export async function handleMessage(ws: WSClient, data: RawData): Promise<void> {
  const message = parseMessage(data);
  if (!message) return;

  const { type, payload } = message;

  switch (type) {
    case 'COMMIT_MOVE': {
      await handleCommitMove(ws, payload as { move: GameMove });
      break;
    }

    case 'PING': {
      sendToClient(ws, 'PONG', {});
      break;
    }

    case 'GET_GAME_STATE': {
      const gameState = await getGameState(ws.sessionId!);
      if (gameState) {
        sendToClient(ws, 'GAME_STATE', gameState);
      }
      break;
    }

    default: {
      console.warn(`Unknown WebSocket message type: ${type}`);
    }
  }
}

async function handleCommitMove(ws: WSClient, payload: { move: GameMove }): Promise<void> {
  const { move } = payload;
  const { userId, sessionId } = ws;

  if (!sessionId || !userId) {
    sendToClient(ws, 'ERROR', { message: 'Not authenticated' });
    return;
  }

  if (!move || !move.fromCapId || !move.toPosition) {
    sendToClient(ws, 'ERROR', { message: 'Invalid move format' });
    return;
  }

  const session = await prisma.matchupSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    sendToClient(ws, 'ERROR', { message: 'Session not found' });
    return;
  }

  if (session.status !== 'active') {
    sendToClient(ws, 'ERROR', { message: 'Session is not active' });
    return;
  }

  if (session.player1_id !== userId && session.player2_id !== userId) {
    sendToClient(ws, 'ERROR', { message: 'Not authorized for this session' });
    return;
  }

  const playerSide: CapSide = session.player1_id === userId ? (session.player1_side as CapSide) : (session.player2_side as CapSide);
  const gameState = await getGameState(sessionId);

  if (!gameState) {
    sendToClient(ws, 'ERROR', { message: 'Game state not found' });
    return;
  }

  const redisKey = playerSide;
  const existingMove = await getCommittedMove(sessionId, redisKey);
  if (existingMove) {
    sendToClient(ws, 'ERROR', { message: 'Already committed a move this turn' });
    return;
  }

  try {
    const result = await commitMove(sessionId, playerSide, move);

    if (result.status === 'resolved') {
      broadcastToSession(sessionId, 'TURN_RESOLVED', {
        gameState: result.gameState,
        resolution: result.resolution,
      });

      // Schedule bot for next turn if game is still active
      if (result.gameState.phase <= result.gameState.totalPhases) {
        const isBotGameAfterResolve = session.player2_id === null || await isBotPlayer(session.player2_id);
        if (isBotGameAfterResolve) {
          const botSideAfterResolve: CapSide = playerSide === 'home' ? 'away' : 'home';
          scheduleBotMove(sessionId, botSideAfterResolve).catch((err) => {
            console.error('Failed to schedule bot move after resolution:', err);
          });
        }
      }
    } else {
      sendToClient(ws, 'MOVE_COMMITTED', { 
        playerSide, 
        turnStatus: result.gameState.turnStatus 
      });
      
      broadcastToOpponents(sessionId, userId, 'OPPONENT_COMMITTED', {});

      const isBotGame = session.player2_id === null || await isBotPlayer(session.player2_id);
      if (isBotGame) {
        const botSide: CapSide = playerSide === 'home' ? 'away' : 'home';
        scheduleBotMove(sessionId, botSide).catch((err) => {
          console.error('Failed to schedule bot move:', err);
        });
      }
    }
  } catch (error) {
    console.error('Error committing move:', error);
    sendToClient(ws, 'ERROR', { message: 'Failed to commit move' });
  }
}

async function isBotPlayer(userId: string | null): Promise<boolean> {
  if (!userId) return true;
  const BOT_USER_ID = '00000000-0000-0000-0000-000000000001';
  return userId === BOT_USER_ID;
}

function broadcastToOpponents(sessionId: string, excludeUserId: string, event: string, payload: unknown): void {
  const clients = getClientsForSession(sessionId);
  const message = JSON.stringify({ type: event, payload });
  clients.forEach((client) => {
    if (client.userId !== excludeUserId && client.readyState === 1) {
      client.send(message);
    }
  });
}

export async function handleDisconnect(ws: WSClient): Promise<void> {
  const { userId, sessionId } = ws;

  if (!sessionId || !userId) return;

  console.log(`Client disconnected: ${userId} from session ${sessionId}`);

  removeClientFromSession(ws);

  const session = await prisma.matchupSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.status !== 'active') return;

  const opponentClient = getOpponentClient(sessionId, userId);
  if (opponentClient) {
    sendToClient(opponentClient, 'OPPONENT_DISCONNECTED', {
      reconnectWindowSeconds: RECONNECT_WINDOW_MS / 1000,
    });
  }

  const timerKey = `${sessionId}:${userId}`;
  const existing = disconnectTimers.get(timerKey);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    disconnectTimers.delete(timerKey);
    await handlePlayerTimeout(sessionId, userId);
  }, RECONNECT_WINDOW_MS);
  disconnectTimers.set(timerKey, timer);
}

async function handlePlayerTimeout(sessionId: string, userId: string): Promise<void> {
  const session = await prisma.matchupSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) return;
  if (session.status !== 'active') return;

  await prisma.matchupSession.update({
    where: { id: sessionId },
    data: { status: 'abandoned' },
  });

  broadcastToSession(sessionId, 'MATCHUP_ABANDONED', { reason: 'opponent_timeout' });
}

function getOpponentClient(sessionId: string, currentUserId: string): WSClient | null {
  const clients = getClientsForSession(sessionId);
  for (const client of clients) {
    if (client.userId && client.userId !== currentUserId) {
      return client;
    }
  }
  return null;
}