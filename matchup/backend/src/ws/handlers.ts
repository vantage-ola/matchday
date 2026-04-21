import type { RawData } from 'ws';
import type { WSClient } from './server.js';
import type { Move, PlayerNumber, WSEvent } from '../types/index.js';
import { commitMove } from '../engine/matchup.js';
import { sendToClient } from './server.js';

interface CommitMovePayload {
  move: Move;
}

interface WSMessage {
  type: string;
  payload?: unknown;
}

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

}

export async function handleMessage(ws: WSClient, data: RawData): Promise<void> {
  const message = parseMessage(data);
  if (!message) return;

  const { type, payload } = message;

  switch (type) {
    case 'COMMIT_MOVE': {
      const { move } = payload as CommitMovePayload;
      const player = (ws.userId === 'p1' ? 'p1' : 'p2') as PlayerNumber;

      // TODO: Verify player belongs to session and is their turn
      // TODO: Call engine.commitMove()
      // TODO: Check if both moves committed -> resolve turn

      await commitMove(ws.sessionId!, player, move);
      break;
    }

    case 'PING': {
      sendToClient(ws, 'PONG', {});
      break;
    }

    default: {
      console.warn(`Unknown WebSocket message type: ${type}`);
    }
  }
}

export async function handleDisconnect(ws: WSClient): Promise<void> {
  const { userId, sessionId } = ws;

  if (sessionId) {
    console.log(`Client disconnected: ${userId} from session ${sessionId}`);

    // TODO: Mark player as disconnected
    // TODO: Notify opponent
    // TODO: Start 30s reconnect timer
    // TODO: If timer expires -> replace with bot
  }
}

export async function notifyOpponentCommitted(
  ws: WSClient,
  opponent: string
): Promise<void> {
  const event = 'OPPONENT_COMMITTED';
  sendToClient(ws, event, { opponent });
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