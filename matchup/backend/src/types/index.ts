export type Move =
  | 'pass'
  | 'long_ball'
  | 'run'
  | 'press'
  | 'tackle'
  | 'hold_shape'
  | 'shoot'
  | 'sprint';

export type PlayerSide = 'home' | 'away';
export type PlayerNumber = 'p1' | 'p2';

export type GameMode = 'matchup_only' | 'real_match';
export type SessionStatus = 'pending' | 'active' | 'completed' | 'settled' | 'abandoned';
export type LobbyStatus = 'open' | 'closed';
export type FixtureStatus = 'scheduled' | 'live' | 'finished';
export type SettlementStatus = 'pending' | 'complete';
export type TurnStatus = 'waiting_both' | 'waiting_p1' | 'waiting_p2' | 'resolving';
export type Outcome =
  | 'advance'
  | 'intercept'
  | 'tackle'
  | 'goal'
  | 'save'
  | 'miss';

export interface GridPosition {
  col: number;
  row: number;
}

export interface PlayerState {
  movesRemaining: number;
  movesUsed: Move[];
  position: GridPosition;
  possession: boolean;
}

export interface MatchupStats {
  possession: number;
  tackles: number;
  shots: number;
  assists: number;
}

export interface MatchEvent {
  type: 'goal' | 'tackle' | 'assist' | 'possession_change';
  player: PlayerNumber;
  turn: number;
  phase: number;
}

export interface Resolution {
  p1Move: Move;
  p2Move: Move;
  outcome: Outcome;
  possessionChange: boolean;
  goalScored: boolean;
  scorer?: PlayerNumber;
}

export interface GameState {
  sessionId: string;
  phase: number;
  totalPhases: number;
  turn: number;
  movesPerPhase: number;
  attackingPlayer: PlayerNumber;
  ball: {
    position: GridPosition;
    carrier: PlayerNumber | null;
  };
  players: {
    p1: PlayerState;
    p2: PlayerState;
  };
  turnStatus: TurnStatus;
  score: {
    p1: number;
    p2: number;
  };
  stats: {
    p1: MatchupStats;
    p2: MatchupStats;
  };
  events: MatchEvent[];
  lastResolution: Resolution | null;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  walletBalance: number;
  createdAt: Date;
}

export interface TeamColors {
  primary: string;
  secondary: string;
  text: string;
}

export interface Fixture {
  id: string;
  externalId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  league: string;
  kickoffAt: Date;
  status: FixtureStatus;
  realHomeGoals: number | null;
  realAwayGoals: number | null;
  rawResult: Record<string, unknown> | null;
  createdAt: Date;
  homeTeamColors?: TeamColors;
  awayTeamColors?: TeamColors;
}

export interface Lobby {
  id: string;
  fixtureId: string;
  opensAt: Date;
  closesAt: Date;
  status: LobbyStatus;
  createdAt: Date;
}

export interface MatchupSession {
  id: string;
  lobbyId: string | null;
  fixtureId: string;
  player1Id: string;
  player2Id: string | null;
  player1Side: PlayerSide;
  player2Side: PlayerSide;
  stakePerPlayer: number;
  pot: number;
  gameMode: GameMode;
  status: SessionStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}

export interface MatchupResult {
  id: string;
  sessionId: string;
  player1Goals: number;
  player2Goals: number;
  player1Possession: number;
  player2Possession: number;
  player1Tackles: number;
  player2Tackles: number;
  player1Shots: number;
  player2Shots: number;
  player1Assists: number;
  player2Assists: number;
  playerEvents: MatchEvent[];
  createdAt: Date;
}

export interface Settlement {
  id: string;
  sessionId: string;
  player1MatchupScore: number | null;
  player2MatchupScore: number | null;
  player1AccuracyScore: number | null;
  player2AccuracyScore: number | null;
  player1CombinedScore: number | null;
  player2CombinedScore: number | null;
  player1Payout: number | null;
  player2Payout: number | null;
  status: SettlementStatus;
  settledAt: Date | null;
  createdAt: Date;
}

export interface GameStateMessage {
  type: 'TURN_RESOLVED' | 'PHASE_TRANSITION' | 'MATCHUP_COMPLETE';
  payload: unknown;
}

export interface WSEvent {
  type: string;
  payload: unknown;
}