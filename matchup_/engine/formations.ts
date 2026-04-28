import type { Player, FormationName, GridPosition, Team, GameState, GameStatus } from './types.js';

export const GAME_DURATION = 600; // 10 minutes in seconds

export interface FormationPreset {
  name: FormationName;
  description: string;
  home: Omit<Player, 'hasBall'>[];
  away: Omit<Player, 'hasBall'>[];
}

export const FORMATIONS: Record<FormationName, FormationPreset> = {
  '4-3-3': {
    name: '4-3-3',
    description: 'Classic attacking formation with 4 defenders, 3 midfielders, 3 forwards',
    home: [
      { id: 'home_gk', name: 'GK', role: 'gk', team: 'home', position: { col: 1, row: 'f' } },
      { id: 'home_def1', name: 'CB1', role: 'def', team: 'home', position: { col: 3, row: 'b' } },
      { id: 'home_def2', name: 'CB2', role: 'def', team: 'home', position: { col: 3, row: 'd' } },
      { id: 'home_def3', name: 'CB3', role: 'def', team: 'home', position: { col: 3, row: 'h' } },
      { id: 'home_def4', name: 'CB4', role: 'def', team: 'home', position: { col: 3, row: 'j' } },
      { id: 'home_mid1', name: 'CM1', role: 'mid', team: 'home', position: { col: 6, row: 'c' } },
      { id: 'home_mid2', name: 'CM2', role: 'mid', team: 'home', position: { col: 6, row: 'e' } },
      { id: 'home_mid3', name: 'CM3', role: 'mid', team: 'home', position: { col: 6, row: 'i' } },
      { id: 'home_fwd1', name: 'LW', role: 'fwd', team: 'home', position: { col: 9, row: 'd' } },
      { id: 'home_fwd2', name: 'ST', role: 'fwd', team: 'home', position: { col: 9, row: 'f' } },
      { id: 'home_fwd3', name: 'RW', role: 'fwd', team: 'home', position: { col: 9, row: 'h' } },
    ],
    away: [
      { id: 'away_gk', name: 'GK', role: 'gk', team: 'away', position: { col: 22, row: 'f' } },
      { id: 'away_def1', name: 'CB1', role: 'def', team: 'away', position: { col: 20, row: 'b' } },
      { id: 'away_def2', name: 'CB2', role: 'def', team: 'away', position: { col: 20, row: 'd' } },
      { id: 'away_def3', name: 'CB3', role: 'def', team: 'away', position: { col: 20, row: 'h' } },
      { id: 'away_def4', name: 'CB4', role: 'def', team: 'away', position: { col: 20, row: 'j' } },
      { id: 'away_mid1', name: 'CM1', role: 'mid', team: 'away', position: { col: 17, row: 'c' } },
      { id: 'away_mid2', name: 'CM2', role: 'mid', team: 'away', position: { col: 17, row: 'e' } },
      { id: 'away_mid3', name: 'CM3', role: 'mid', team: 'away', position: { col: 17, row: 'i' } },
      { id: 'away_fwd1', name: 'LW', role: 'fwd', team: 'away', position: { col: 14, row: 'd' } },
      { id: 'away_fwd2', name: 'ST', role: 'fwd', team: 'away', position: { col: 14, row: 'f' } },
      { id: 'away_fwd3', name: 'RW', role: 'fwd', team: 'away', position: { col: 14, row: 'h' } },
    ],
  },

  '4-4-2': {
    name: '4-4-2',
    description: 'Balanced 4-4-2 with two strikers',
    home: [
      { id: 'home_gk', name: 'GK', role: 'gk', team: 'home', position: { col: 1, row: 'f' } },
      { id: 'home_def1', name: 'LB', role: 'def', team: 'home', position: { col: 3, row: 'a' } },
      { id: 'home_def2', name: 'CB1', role: 'def', team: 'home', position: { col: 3, row: 'c' } },
      { id: 'home_def3', name: 'CB2', role: 'def', team: 'home', position: { col: 3, row: 'i' } },
      { id: 'home_def4', name: 'RB', role: 'def', team: 'home', position: { col: 3, row: 'k' } },
      { id: 'home_mid1', name: 'LM', role: 'mid', team: 'home', position: { col: 6, row: 'b' } },
      { id: 'home_mid2', name: 'CM1', role: 'mid', team: 'home', position: { col: 6, row: 'd' } },
      { id: 'home_mid3', name: 'CM2', role: 'mid', team: 'home', position: { col: 6, row: 'h' } },
      { id: 'home_mid4', name: 'RM', role: 'mid', team: 'home', position: { col: 6, row: 'j' } },
      { id: 'home_fwd1', name: 'ST1', role: 'fwd', team: 'home', position: { col: 9, row: 'e' } },
      { id: 'home_fwd2', name: 'ST2', role: 'fwd', team: 'home', position: { col: 9, row: 'g' } },
    ],
    away: [
      { id: 'away_gk', name: 'GK', role: 'gk', team: 'away', position: { col: 22, row: 'f' } },
      { id: 'away_def1', name: 'LB', role: 'def', team: 'away', position: { col: 20, row: 'a' } },
      { id: 'away_def2', name: 'CB1', role: 'def', team: 'away', position: { col: 20, row: 'c' } },
      { id: 'away_def3', name: 'CB2', role: 'def', team: 'away', position: { col: 20, row: 'i' } },
      { id: 'away_def4', name: 'RB', role: 'def', team: 'away', position: { col: 20, row: 'k' } },
      { id: 'away_mid1', name: 'LM', role: 'mid', team: 'away', position: { col: 17, row: 'b' } },
      { id: 'away_mid2', name: 'CM1', role: 'mid', team: 'away', position: { col: 17, row: 'd' } },
      { id: 'away_mid3', name: 'CM2', role: 'mid', team: 'away', position: { col: 17, row: 'h' } },
      { id: 'away_mid4', name: 'RM', role: 'mid', team: 'away', position: { col: 17, row: 'j' } },
      { id: 'away_fwd1', name: 'ST1', role: 'fwd', team: 'away', position: { col: 14, row: 'e' } },
      { id: 'away_fwd2', name: 'ST2', role: 'fwd', team: 'away', position: { col: 14, row: 'g' } },
    ],
  },

  '3-5-2': {
    name: '3-5-2',
    description: 'Attack-minded 3-5-2 with wingbacks',
    home: [
      { id: 'home_gk', name: 'GK', role: 'gk', team: 'home', position: { col: 1, row: 'f' } },
      { id: 'home_def1', name: 'LCB', role: 'def', team: 'home', position: { col: 2, row: 'c' } },
      { id: 'home_def2', name: 'CCB', role: 'def', team: 'home', position: { col: 2, row: 'f' } },
      { id: 'home_def3', name: 'RCB', role: 'def', team: 'home', position: { col: 2, row: 'i' } },
      { id: 'home_mid1', name: 'LWB', role: 'mid', team: 'home', position: { col: 5, row: 'a' } },
      { id: 'home_mid2', name: 'CM1', role: 'mid', team: 'home', position: { col: 5, row: 'd' } },
      { id: 'home_mid3', name: 'CM2', role: 'mid', team: 'home', position: { col: 5, row: 'f' } },
      { id: 'home_mid4', name: 'CM3', role: 'mid', team: 'home', position: { col: 5, row: 'h' } },
      { id: 'home_mid5', name: 'RWB', role: 'mid', team: 'home', position: { col: 5, row: 'k' } },
      { id: 'home_fwd1', name: 'ST1', role: 'fwd', team: 'home', position: { col: 9, row: 'e' } },
      { id: 'home_fwd2', name: 'ST2', role: 'fwd', team: 'home', position: { col: 9, row: 'g' } },
    ],
    away: [
      { id: 'away_gk', name: 'GK', role: 'gk', team: 'away', position: { col: 22, row: 'f' } },
      { id: 'away_def1', name: 'LCB', role: 'def', team: 'away', position: { col: 21, row: 'c' } },
      { id: 'away_def2', name: 'CCB', role: 'def', team: 'away', position: { col: 21, row: 'f' } },
      { id: 'away_def3', name: 'RCB', role: 'def', team: 'away', position: { col: 21, row: 'i' } },
      { id: 'away_mid1', name: 'LWB', role: 'mid', team: 'away', position: { col: 18, row: 'a' } },
      { id: 'away_mid2', name: 'CM1', role: 'mid', team: 'away', position: { col: 18, row: 'd' } },
      { id: 'away_mid3', name: 'CM2', role: 'mid', team: 'away', position: { col: 18, row: 'f' } },
      { id: 'away_mid4', name: 'CM3', role: 'mid', team: 'away', position: { col: 18, row: 'h' } },
      { id: 'away_mid5', name: 'RWB', role: 'mid', team: 'away', position: { col: 18, row: 'k' } },
      { id: 'away_fwd1', name: 'ST1', role: 'fwd', team: 'away', position: { col: 14, row: 'e' } },
      { id: 'away_fwd2', name: 'ST2', role: 'fwd', team: 'away', position: { col: 14, row: 'g' } },
    ],
  },

  '5-3-2': {
    name: '5-3-2',
    description: 'Defensive 5-3-2 with three center backs',
    home: [
      { id: 'home_gk', name: 'GK', role: 'gk', team: 'home', position: { col: 1, row: 'f' } },
      { id: 'home_def1', name: 'LCB', role: 'def', team: 'home', position: { col: 2, row: 'a' } },
      { id: 'home_def2', name: 'LCB1', role: 'def', team: 'home', position: { col: 2, row: 'c' } },
      { id: 'home_def3', name: 'CCB', role: 'def', team: 'home', position: { col: 2, row: 'f' } },
      { id: 'home_def4', name: 'RCB1', role: 'def', team: 'home', position: { col: 2, row: 'i' } },
      { id: 'home_def5', name: 'RCB', role: 'def', team: 'home', position: { col: 2, row: 'k' } },
      { id: 'home_mid1', name: 'CM1', role: 'mid', team: 'home', position: { col: 5, row: 'c' } },
      { id: 'home_mid2', name: 'CM2', role: 'mid', team: 'home', position: { col: 5, row: 'f' } },
      { id: 'home_mid3', name: 'CM3', role: 'mid', team: 'home', position: { col: 5, row: 'i' } },
      { id: 'home_fwd1', name: 'ST1', role: 'fwd', team: 'home', position: { col: 8, row: 'e' } },
      { id: 'home_fwd2', name: 'ST2', role: 'fwd', team: 'home', position: { col: 8, row: 'g' } },
    ],
    away: [
      { id: 'away_gk', name: 'GK', role: 'gk', team: 'away', position: { col: 22, row: 'f' } },
      { id: 'away_def1', name: 'LCB', role: 'def', team: 'away', position: { col: 21, row: 'a' } },
      { id: 'away_def2', name: 'LCB1', role: 'def', team: 'away', position: { col: 21, row: 'c' } },
      { id: 'away_def3', name: 'CCB', role: 'def', team: 'away', position: { col: 21, row: 'f' } },
      { id: 'away_def4', name: 'RCB1', role: 'def', team: 'away', position: { col: 21, row: 'i' } },
      { id: 'away_def5', name: 'RCB', role: 'def', team: 'away', position: { col: 21, row: 'k' } },
      { id: 'away_mid1', name: 'CM1', role: 'mid', team: 'away', position: { col: 18, row: 'c' } },
      { id: 'away_mid2', name: 'CM2', role: 'mid', team: 'away', position: { col: 18, row: 'f' } },
      { id: 'away_mid3', name: 'CM3', role: 'mid', team: 'away', position: { col: 18, row: 'i' } },
      { id: 'away_fwd1', name: 'ST1', role: 'fwd', team: 'away', position: { col: 15, row: 'e' } },
      { id: 'away_fwd2', name: 'ST2', role: 'fwd', team: 'away', position: { col: 15, row: 'g' } },
    ],
  },

  '4-2-3-1': {
    name: '4-2-3-1',
    description: 'Modern 4-2-3-1 with double pivot',
    home: [
      { id: 'home_gk', name: 'GK', role: 'gk', team: 'home', position: { col: 1, row: 'f' } },
      { id: 'home_def1', name: 'LB', role: 'def', team: 'home', position: { col: 3, row: 'b' } },
      { id: 'home_def2', name: 'CB1', role: 'def', team: 'home', position: { col: 3, row: 'd' } },
      { id: 'home_def3', name: 'CB2', role: 'def', team: 'home', position: { col: 3, row: 'h' } },
      { id: 'home_def4', name: 'RB', role: 'def', team: 'home', position: { col: 3, row: 'j' } },
      { id: 'home_mid1', name: 'DM1', role: 'mid', team: 'home', position: { col: 5, row: 'e' } },
      { id: 'home_mid2', name: 'DM2', role: 'mid', team: 'home', position: { col: 5, row: 'g' } },
      { id: 'home_mid3', name: 'CAM1', role: 'mid', team: 'home', position: { col: 7, row: 'c' } },
      { id: 'home_mid4', name: 'CAM2', role: 'mid', team: 'home', position: { col: 7, row: 'f' } },
      { id: 'home_mid5', name: 'CAM3', role: 'mid', team: 'home', position: { col: 7, row: 'i' } },
      { id: 'home_fwd1', name: 'ST', role: 'fwd', team: 'home', position: { col: 9, row: 'f' } },
    ],
    away: [
      { id: 'away_gk', name: 'GK', role: 'gk', team: 'away', position: { col: 22, row: 'f' } },
      { id: 'away_def1', name: 'LB', role: 'def', team: 'away', position: { col: 20, row: 'b' } },
      { id: 'away_def2', name: 'CB1', role: 'def', team: 'away', position: { col: 20, row: 'd' } },
      { id: 'away_def3', name: 'CB2', role: 'def', team: 'away', position: { col: 20, row: 'h' } },
      { id: 'away_def4', name: 'RB', role: 'def', team: 'away', position: { col: 20, row: 'j' } },
      { id: 'away_mid1', name: 'DM1', role: 'mid', team: 'away', position: { col: 18, row: 'e' } },
      { id: 'away_mid2', name: 'DM2', role: 'mid', team: 'away', position: { col: 18, row: 'g' } },
      { id: 'away_mid3', name: 'CAM1', role: 'mid', team: 'away', position: { col: 16, row: 'c' } },
      { id: 'away_mid4', name: 'CAM2', role: 'mid', team: 'away', position: { col: 16, row: 'f' } },
      { id: 'away_mid5', name: 'CAM3', role: 'mid', team: 'away', position: { col: 16, row: 'i' } },
      { id: 'away_fwd1', name: 'ST', role: 'fwd', team: 'away', position: { col: 14, row: 'f' } },
    ],
  },

  '3-4-3': {
    name: '3-4-3',
    description: 'High-press 3-4-3 with false nine',
    home: [
      { id: 'home_gk', name: 'GK', role: 'gk', team: 'home', position: { col: 1, row: 'f' } },
      { id: 'home_def1', name: 'LCB', role: 'def', team: 'home', position: { col: 2, row: 'b' } },
      { id: 'home_def2', name: 'CCB', role: 'def', team: 'home', position: { col: 2, row: 'f' } },
      { id: 'home_def3', name: 'RCB', role: 'def', team: 'home', position: { col: 2, row: 'j' } },
      { id: 'home_mid1', name: 'LWB', role: 'mid', team: 'home', position: { col: 5, row: 'a' } },
      { id: 'home_mid2', name: 'CM1', role: 'mid', team: 'home', position: { col: 5, row: 'd' } },
      { id: 'home_mid3', name: 'CM2', role: 'mid', team: 'home', position: { col: 5, row: 'h' } },
      { id: 'home_mid4', name: 'RWB', role: 'mid', team: 'home', position: { col: 5, row: 'k' } },
      { id: 'home_fwd1', name: 'LW', role: 'fwd', team: 'home', position: { col: 8, row: 'b' } },
      { id: 'home_fwd2', name: 'F9', role: 'fwd', team: 'home', position: { col: 8, row: 'f' } },
      { id: 'home_fwd3', name: 'RW', role: 'fwd', team: 'home', position: { col: 8, row: 'j' } },
    ],
    away: [
      { id: 'away_gk', name: 'GK', role: 'gk', team: 'away', position: { col: 22, row: 'f' } },
      { id: 'away_def1', name: 'LCB', role: 'def', team: 'away', position: { col: 21, row: 'b' } },
      { id: 'away_def2', name: 'CCB', role: 'def', team: 'away', position: { col: 21, row: 'f' } },
      { id: 'away_def3', name: 'RCB', role: 'def', team: 'away', position: { col: 21, row: 'j' } },
      { id: 'away_mid1', name: 'LWB', role: 'mid', team: 'away', position: { col: 18, row: 'a' } },
      { id: 'away_mid2', name: 'CM1', role: 'mid', team: 'away', position: { col: 18, row: 'd' } },
      { id: 'away_mid3', name: 'CM2', role: 'mid', team: 'away', position: { col: 18, row: 'h' } },
      { id: 'away_mid4', name: 'RWB', role: 'mid', team: 'away', position: { col: 18, row: 'k' } },
      { id: 'away_fwd1', name: 'LW', role: 'fwd', team: 'away', position: { col: 15, row: 'b' } },
      { id: 'away_fwd2', name: 'F9', role: 'fwd', team: 'away', position: { col: 15, row: 'f' } },
      { id: 'away_fwd3', name: 'RW', role: 'fwd', team: 'away', position: { col: 15, row: 'j' } },
    ],
  },
};

export const FORMATION_NAMES = Object.keys(FORMATIONS) as (keyof typeof FORMATIONS)[];

export function getFormation(name: keyof typeof FORMATIONS): FormationPreset {
  return FORMATIONS[name];
}

export function listFormations(): { name: keyof typeof FORMATIONS; description: string }[] {
  return FORMATION_NAMES.map((name) => ({
    name,
    description: FORMATIONS[name].description,
  }));
}

/**
 * Reset all players to their formation base positions and clear ball.
 * Used after goals and at half-time.
 */
export function resetPositions(state: GameState): void {
  const homePreset = FORMATIONS[state.homeFormation].home;
  const awayPreset = FORMATIONS[state.awayFormation].away;

  for (const player of state.players) {
    player.hasBall = false;
    const preset = player.team === 'home' ? homePreset : awayPreset;
    const base = preset.find((p) => p.id === player.id);
    if (base) {
      player.position = { ...base.position };
    }
  }
}

export function initGameState(
  homeFormation?: keyof typeof FORMATIONS,
  awayFormation?: keyof typeof FORMATIONS
): GameState {
  const homeName = homeFormation || '4-3-3';
  const awayName = awayFormation || homeFormation || '4-3-3';

  const homePreset = FORMATIONS[homeName];
  const awayPreset = FORMATIONS[awayName];

  const allPlayers: Player[] = [
    ...homePreset.home.map((p) => ({ ...p, hasBall: false })),
    ...awayPreset.away.map((p) => ({ ...p, hasBall: false })),
  ];

  // Give ball to first forward on home team
  const fwd1 = allPlayers.find((p) => p.team === 'home' && p.role === 'fwd');
  if (fwd1) {
    fwd1.hasBall = true;
  }

  const ballCarrier = allPlayers.find((p) => p.hasBall);

  return {
    players: allPlayers,
    ball: ballCarrier ? { ...ballCarrier.position } : { col: 11, row: 'f' },
    ballCarrierId: ballCarrier?.id || null,
    possession: 'home',
    moveNumber: 1,
    movePhase: 'attack',
    phase: 1,
    score: { home: 0, away: 0 },
    timeRemaining: GAME_DURATION,
    status: 'playing',
    homeFormation: homeName,
    awayFormation: awayName,
  };
}

export function getPlayer(state: GameState, playerId: string): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

export function getTeamPlayers(state: GameState, team: Team): Player[] {
  return state.players.filter((p) => p.team === team);
}

export function getBallCarrier(state: GameState): Player | undefined {
  return state.players.find((p) => p.hasBall);
}

export function getPlayerAt(state: GameState, pos: GridPosition): Player | undefined {
  return state.players.find((p) => p.position.col === pos.col && p.position.row === pos.row);
}