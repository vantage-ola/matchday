import type { PlayerSide, GameMode, MatchupSession, GameState, CapSide } from '../types/index.js';
import { initSession } from '../engine/matchup.js';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001';
const BOT_TIMEOUT_MS = 20_000;
const GAME_STATE_TTL = 60 * 60 * 24;

interface QueueEntry {
  userId: string;
  fixtureId: string;
  side: PlayerSide;
  stake: number;
  gameMode: GameMode;
  joinedAt: Date;
  timeoutId?: NodeJS.Timeout;
}

const queues: Map<string, { home: QueueEntry[]; away: QueueEntry[] }> = new Map();

async function ensureBotUser(): Promise<string> {
  let bot = await prisma.user.findUnique({
    where: { id: BOT_USER_ID },
  });

  if (!bot) {
    bot = await prisma.user.create({
      data: {
        id: BOT_USER_ID,
        username: 'bot',
        password_hash: '$2a$10$placeholder',
        display_name: 'Matchup Bot',
        is_bot: true,
        wallet_balance: 999999999,
      },
    });
  }

  return bot.id;
}

async function getOrCreateLobby(fixtureId: string): Promise<string> {
  const existing = await prisma.lobby.findFirst({
    where: {
      fixture_id: fixtureId,
      status: 'open',
    },
  });

  if (existing) {
    return existing.id;
  }

  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
  });

  if (!fixture) {
    throw new Error('Fixture not found');
  }

  const lobby = await prisma.lobby.create({
    data: {
      fixture_id: fixtureId,
      opens_at: new Date(),
      closes_at: fixture.kickoff_at,
      status: 'open',
    },
  });

  return lobby.id;
}

async function saveSessionToDB(session: MatchupSession): Promise<void> {
  const lobbyId = session.lobbyId ?? (await getOrCreateLobby(session.fixtureId));

  await prisma.matchupSession.create({
    data: {
      id: session.id,
      lobby_id: lobbyId,
      fixture_id: session.fixtureId,
      player1_id: session.player1Id,
      player2_id: session.player2Id,
      player1_side: session.player1Side,
      player2_side: session.player2Side,
      stake_per_player: session.stakePerPlayer,
      pot: session.pot,
      game_mode: session.gameMode,
      status: session.status,
      started_at: session.startedAt,
      ended_at: session.endedAt,
    },
  });
}

async function saveGameStateToRedis(sessionId: string, gameState: GameState): Promise<void> {
  await redis.setex(
    `matchup:${sessionId}:state`,
    GAME_STATE_TTL,
    JSON.stringify(gameState)
  );
}

export async function getGameState(sessionId: string): Promise<GameState | null> {
  const data = await redis.get(`matchup:${sessionId}:state`);
  if (!data) return null;
  return JSON.parse(data) as GameState;
}

export async function updateGameState(sessionId: string, gameState: GameState): Promise<void> {
  await redis.setex(
    `matchup:${sessionId}:state`,
    GAME_STATE_TTL,
    JSON.stringify(gameState)
  );
}

export async function getCommittedMove(sessionId: string, player: 'home' | 'away'): Promise<string | null> {
  return redis.get(`matchup:${sessionId}:${player}_move`);
}

export async function setCommittedMove(sessionId: string, player: 'home' | 'away', move: string): Promise<void> {
  await redis.setex(`matchup:${sessionId}:${player}_move`, 30, move);
}

export async function clearCommittedMoves(sessionId: string): Promise<void> {
  await redis.del(`matchup:${sessionId}:home_move`);
  await redis.del(`matchup:${sessionId}:away_move`);
}

export async function joinQueue(
  userId: string,
  fixtureId: string,
  side: PlayerSide,
  stake: number,
  gameMode: GameMode
): Promise<{ position: number; session?: MatchupSession }> {
  if (!queues.has(fixtureId)) {
    queues.set(fixtureId, { home: [], away: [] });
  }

  const queue = queues.get(fixtureId)!;

  const opponentQueue = side === 'home' ? queue.away : queue.home;
  const opponent = opponentQueue[0];
  if (opponent) {
    if (opponent.timeoutId) {
      clearTimeout(opponent.timeoutId);
    }
    opponentQueue.shift();
    const match = await createSession(userId, fixtureId, side, opponent, stake, gameMode);
    return { position: 1, session: match };
  }

  const entry: QueueEntry = {
    userId,
    fixtureId,
    side,
    stake,
    gameMode,
    joinedAt: new Date(),
  };

  entry.timeoutId = setTimeout(async () => {
    const currentQueue = queues.get(fixtureId);
    if (!currentQueue) return;

    const playerQueue = side === 'home' ? currentQueue.home : currentQueue.away;
    const index = playerQueue.findIndex((e) => e.userId === userId);
    if (index === -1) return;

    playerQueue.splice(index, 1);

    const botSession = await createBotSession(userId, fixtureId, side, stake, gameMode);
    console.log(`Bot session created for user ${userId}`);
  }, BOT_TIMEOUT_MS);

  queue[side].push(entry);

  const position = queue[side].length;

  return { position };
}

export async function leaveQueue(
  userId: string,
  fixtureId: string,
  side: PlayerSide
): Promise<void> {
  const queue = queues.get(fixtureId);
  if (!queue) return;

  const entry = queue[side].find((e) => e.userId === userId);
  if (entry?.timeoutId) {
    clearTimeout(entry.timeoutId);
  }

  queue[side] = queue[side].filter((entry) => entry.userId !== userId);
}

export async function createBotSession(
  userId: string,
  fixtureId: string,
  side: PlayerSide,
  stake: number,
  gameMode: GameMode
): Promise<MatchupSession> {
  const botUserId = await ensureBotUser();
  const sessionId = crypto.randomUUID();

  const player1Side: PlayerSide = side;
  const player2Side: PlayerSide = side === 'home' ? 'away' : 'home';

  const session: MatchupSession = {
    id: sessionId,
    lobbyId: null,
    fixtureId,
    player1Id: userId,
    player2Id: botUserId,
    player1Side,
    player2Side,
    stakePerPlayer: stake,
    pot: stake * 2,
    gameMode,
    status: 'pending',
    startedAt: null,
    endedAt: null,
    createdAt: new Date(),
  };

  const gameState = await initSession(
    session.player1Id,
    session.player2Id!,
    fixtureId,
    sessionId
  );

  await saveSessionToDB(session);
  await saveGameStateToRedis(sessionId, gameState);

  const startedSession = await startMatchup(session);

  return startedSession;
}

export async function createSession(
  joiningUserId: string,
  fixtureId: string,
  joiningSide: PlayerSide,
  opponent: QueueEntry,
  stake: number,
  gameMode: GameMode
): Promise<MatchupSession> {
  const sessionId = crypto.randomUUID();

  const player1Side: PlayerSide = joiningSide;
  const player2Side: PlayerSide = joiningSide === 'home' ? 'away' : 'home';

  const session: MatchupSession = {
    id: sessionId,
    lobbyId: null,
    fixtureId,
    player1Id: player1Side === 'home' ? joiningUserId : opponent.userId,
    player2Id: player1Side === 'away' ? joiningUserId : opponent.userId,
    player1Side,
    player2Side,
    stakePerPlayer: stake,
    pot: stake * 2,
    gameMode,
    status: 'pending',
    startedAt: null,
    endedAt: null,
    createdAt: new Date(),
  };

  const gameState = await initSession(
    session.player1Id,
    session.player2Id ?? 'bot',
    fixtureId,
    sessionId
  );

  await saveSessionToDB(session);
  await saveGameStateToRedis(sessionId, gameState);

  const startedSession = await startMatchup(session);

  return startedSession;
}

export async function startMatchup(session: MatchupSession): Promise<MatchupSession> {
  const updatedSession: MatchupSession = {
    ...session,
    status: 'active',
    startedAt: new Date(),
  };

  await prisma.matchupSession.update({
    where: { id: session.id },
    data: {
      status: 'active',
      started_at: new Date(),
    },
  });

  const gameState = await getGameState(session.id);
  if (gameState) {
    await updateGameState(session.id, {
      ...gameState,
      turnStatus: 'waiting_both',
    });
  }

  return updatedSession;
}

export async function getQueueStatus(fixtureId: string): Promise<{
  homeCount: number;
  awayCount: number;
}> {
  const queue = queues.get(fixtureId);
  if (!queue) {
    return { homeCount: 0, awayCount: 0 };
  }

  return {
    homeCount: queue.home.length,
    awayCount: queue.away.length,
  };
}