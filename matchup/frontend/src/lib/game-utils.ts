import type { GameState, GameMove, PlayerCap } from '../types';

function getCapName(name: string, number: number): string {
  if (name && name !== `GK ${number}` && name !== `DEF ${number}` && name !== `MID ${number}` && name !== `FWD ${number}`) {
    const parts = name.split(' ');
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
    return name.substring(0, 3).toUpperCase();
  }
  return String(number);
}

export function resolveCapName(capId: string, gameState: GameState): string {
  const allCaps = [...gameState.formations.home.caps, ...gameState.formations.away.caps];
  const cap = allCaps.find((c) => c.id === capId);
  if (!cap) return capId;
  return getCapName(cap.name, cap.shirtNumber);
}

export function resolveCap(capId: string, gameState: GameState): PlayerCap | undefined {
  const allCaps = [...gameState.formations.home.caps, ...gameState.formations.away.caps];
  return allCaps.find((c) => c.id === capId);
}

export function formatAction(action: string): string {
  return action
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const ACTION_VERBS: Record<string, string> = {
  pass: 'passes',
  through_pass: 'plays a through ball',
  cross: 'whips in a cross',
  long_ball: 'sends a long ball',
  shoot: 'shoots',
  run: 'runs forward',
  press: 'presses',
  tackle: 'tackles',
  intercept: 'intercepts',
  hold_shape: 'holds position',
  track_back: 'tracks back',
};

export function describeMoveHuman(move: GameMove, gameState: GameState): string {
  const playerName = resolveCapName(move.fromCapId, gameState);
  const verb = ACTION_VERBS[move.action] || move.action;

  if ('toCapId' in move && move.toCapId) {
    const targetName = resolveCapName(move.toCapId, gameState);
    return `${playerName} ${verb} to ${targetName}`;
  }

  return `${playerName} ${verb}`;
}

export function describePosition(col: number): string {
  if (col <= 3) return 'defensive third';
  if (col <= 10) return 'midfield';
  return 'attacking third';
}

export const PHASE_NAMES = [
  'KICKOFF',
  'BUILD UP',
  'HIGH PRESS',
  'COUNTER ATTACK',
  'DEEP BLOCK',
  'FINAL PUSH',
  'EXTRA TIME',
];
