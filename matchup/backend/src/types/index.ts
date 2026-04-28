export const PITCH_COLS = 15;
export const PITCH_ROWS = 9;

export type CapRole = 'gk' | 'def' | 'mid' | 'fwd';
export type CapSide = 'home' | 'away';

export type AttackerAction = 'pass' | 'through_pass' | 'cross' | 'long_ball' | 'shoot' | 'run';
export type DefenderAction = 'press' | 'tackle' | 'intercept' | 'hold_shape' | 'track_back';

export interface GridPosition {
  col: number;
  row: number;
}

export interface PlayerCap {
  id: string;
  name: string;
  shirtNumber: number;
  role: CapRole;
  side: CapSide;
  position: GridPosition;
  hasBall: boolean;
  rating: number;
  apiId?: number;
}

export interface Formation {
  side: CapSide;
  shape: string;
  caps: PlayerCap[];
}

export interface AttackerMove {
  side: 'attacker';
  fromCapId: string;
  toCapId?: string;
  toPosition: GridPosition;
  action: AttackerAction;
}

export interface DefenderMove {
  side: 'defender';
  fromCapId: string;
  toPosition: GridPosition;
  action: DefenderAction;
  targetCapId?: string;
}

export type GameMove = AttackerMove | DefenderMove;

export type PlayerSide = 'home' | 'away';
export type PlayerNumber = 'p1' | 'p2';

export type GameMode = 'matchup_only' | 'real_match';
export type SessionStatus = 'pending' | 'active' | 'completed' | 'settled' | 'abandoned';
export type LobbyStatus = 'open' | 'closed';
export type FixtureStatus = 'scheduled' | 'live' | 'finished';
export type SettlementStatus = 'pending' | 'complete';
export type TurnStatus = 'waiting_both' | 'waiting_home' | 'waiting_away' | 'resolving';

export type Outcome =
  | 'advance'
  | 'intercept'
  | 'tackle'
  | 'goal'
  | 'save'
  | 'miss'
  | 'through'
  | 'press_won'
  | 'blocked'
  | 'wide';

export interface CapMovement {
  capId: string;
  fromPosition: GridPosition;
  toPosition: GridPosition;
}

export interface MatchupStats {
  possession: number;
  tackles: number;
  shots: number;
  assists: number;
}

export interface MatchEvent {
  type: 'goal' | 'tackle' | 'assist' | 'possession_change' | 'save' | 'shot' | 'interception';
  side: CapSide;
  capId?: string;
  turn: number;
  phase: number;
}

export interface SpatialResolution {
  attackerMove: AttackerMove;
  defenderMove: DefenderMove;
  outcome: Outcome;
  ballFinalPosition: GridPosition;
  interceptionPoint: GridPosition | null;
  movedCaps: CapMovement[];
  possessionChange: boolean;
  goalScored: boolean;
  scorerCapId: string | null;
  ratingBonus: number;
}

export interface GameState {
  sessionId: string;
  phase: number;
  totalPhases: number;
  turn: number;
  movesPerPhase: number;
  attackingSide: CapSide;

  ball: {
    position: GridPosition;
    carrierCapId: string | null;
  };

  formations: {
    home: Formation;
    away: Formation;
  };

  turnStatus: TurnStatus;
  score: { home: number; away: number };
  stats: {
    home: MatchupStats;
    away: MatchupStats;
  };
  events: MatchEvent[];
  lastResolution: SpatialResolution | null;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  avatarUrl: string | null;
  walletBalance: number;
  isBot: boolean;
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
  homeTeamApiId?: number;
  awayTeamApiId?: number;
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

export const VALID_ATTACKER_ACTIONS: AttackerAction[] = ['pass', 'through_pass', 'cross', 'long_ball', 'shoot', 'run'];
export const VALID_DEFENDER_ACTIONS: DefenderAction[] = ['press', 'tackle', 'intercept', 'hold_shape', 'track_back'];