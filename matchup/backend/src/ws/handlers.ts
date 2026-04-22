import type { RawData } from 'ws';
import type { WSClient } from './server.js';
import type { Move, PlayerNumber, WSEvent, GameState } from '../types/index.js';
import { getGameState } from '../services/matchmaking.js';
import { commitMove } from '../engine/matchup.js';
import { sendToClient, broadcastToSession, getClientsForSession, removeClientFromSession } from './server.js';
import { prisma } from '../db/prisma.js';
import { scheduleBotMove } from '../engine/bot.js';
import { getCommittedMove } from '../services/matchmaking.js';

interface CommitMovePayload {
  move: Move;
}

interface WSMessage {
  type: string;
  payload?: unknown;
}

const RECONNECT_WINDOW_MS = 30_000;
const reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

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
      await handleCommitMove(ws, payload as CommitMovePayload);
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

async function handleCommitMove(ws: WSClient, payload: CommitMovePayload): Promise<void> {
  const { move } = payload;
  const { userId, sessionId } = ws;

  if (!sessionId || !userId) {
    sendToClient(ws, 'ERROR', { message: 'Not authenticated' });
    return;
  }

  const validMoves: Move[] = ['pass', 'long_ball', 'run', 'press', 'tackle', 'hold_shape', 'shoot', 'sprint'];
  if (!validMoves.includes(move)) {
    sendToClient(ws, 'ERROR', { message: 'Invalid move' });
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

  const player: PlayerNumber = session.player1_id === userId ? 'p1' : 'p2';
  const gameState = await getGameState(sessionId);

  if (!gameState) {
    sendToClient(ws, 'ERROR', { message: 'Game state not found' });
    return;
  }

  // Check if player has already committed this turn
  const existingMove = await getCommittedMove(sessionId, player);
  if (existingMove) {
    sendToClient(ws, 'ERROR', { message: 'Already committed a move this turn' });
    return;
  }

  try {
    const result = await commitMove(sessionId, player, move);

    if (result.status === 'resolved') {
      // Both moves were committed — broadcast resolution to all clients
      broadcastToSession(sessionId, 'TURN_RESOLVED', {
        gameState: result.gameState,
        resolution: result.resolution,
      });

      // Schedule next bot move only if game is NOT complete
      // Don't schedule here - let bot.ts handle the recursive scheduling to avoid double-schedule
    } else {
      // Only one player committed — notify the committer
      sendToClient(ws, 'MOVE_COMMITTED', { 
        player, 
        turnStatus: result.gameState.turnStatus 
      });
      
      // Notify opponent that a move was committed (no details revealed)
      broadcastToOpponents(sessionId, userId, 'OPPONENT_COMMITTED', {});

      // If opponent is a bot, schedule their move
      const isBotGame = session.player2_id === null || await isBotPlayer(session.player2_id);
      if (isBotGame) {
        const botSide: PlayerNumber = session.player1_id === userId ? 'p2' : 'p1';
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

function getOpponentClient(sessionId: string, currentPlayer: PlayerNumber): WSClient | null {
  const clients = getClientsForSession(sessionId);
  for (const client of clients) {
    if (client.userId && client.userId !== currentPlayer) {
      return client;
    }
  }
  return null;
}

export async function handleDisconnect(ws: WSClient): Promise<void> {
  const { userId, sessionId } = ws;

  if (!sessionId || !userId) return;

  console.log(`Client disconnected: ${userId} from session ${sessionId}`);

  removeClientFromSession(ws);

  clearTimeout(reconnectTimers.get(sessionId));

  const timer = setTimeout(async () => {
    await handlePlayerTimeout(sessionId, userId);
  }, RECONNECT_WINDOW_MS);

  reconnectTimers.set(sessionId, timer);

  const opponentClient = getOpponentForSession(sessionId, userId);
  if (opponentClient) {
    sendToClient(opponentClient, 'OPPONENT_DISCONNECTED', {
      reconnectWindowSeconds: RECONNECT_WINDOW_MS / 1000,
    });
  }
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

function getOpponentForSession(sessionId: string, excludeUserId: string): WSClient | null {
  const clients = getClientsForSession(sessionId);
  for (const client of clients) {
    if (client.userId && client.userId !== excludeUserId) {
      return client;
    }
  }
  return null;
}

export async function notifyOpponentCommitted(
  ws: WSClient,
  opponent: string
): Promise<void> {
  sendToClient(ws, 'OPPONENT_COMMITTED', { opponent });
}

export async function notifyOpponentDisconnected(
  ws: WSClient,
  reconnectWindowSeconds: number
): Promise<void> {
  sendToClient(ws, 'OPPONENT_DISCONNECTED', {
    reconnectWindowSeconds,
  });
}

export async function notifyBotSubstituted(ws: WSClient): Promise<void> {
  sendToClient(ws, 'BOT_SUBSTITUTED', {});
}