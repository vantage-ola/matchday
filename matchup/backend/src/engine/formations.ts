import type { PlayerCap, Formation, CapRole, CapSide, GridPosition } from '../types/index.js';
import { mapApiPositionToRole, getGridPositionForRole, marketValueToRating, type MatchLineupPlayer } from '../services/football-api.js';

function getGenericName(role: CapRole, index: number): string {
  const prefixes: Record<CapRole, string> = {
    gk: 'GK',
    def: 'DEF',
    mid: 'MID',
    fwd: 'FWD',
  };
  const prefix = prefixes[role] || 'UKN';
  return `${prefix} ${index + 1}`;
}

export function createFormationFromLineup(
  side: CapSide,
  lineup: MatchLineupPlayer[]
): Formation {
  const caps: PlayerCap[] = [];
  const attackDir = side === 'home' ? 1 : -1;

  if (!lineup || lineup.length === 0) {
    return createFallbackFormation(side);
  }

  const defIndices: number[] = [];
  const midIndices: number[] = [];
  const fwdIndices: number[] = [];

  for (let i = 0; i < lineup.length; i++) {
    const player = lineup[i];
    if (!player) continue;

    const role = mapApiPositionToRole(player.position);
    const roleIdx = role === 'def' ? defIndices.length : role === 'mid' ? midIndices.length : fwdIndices.length;
    if (role === 'def') defIndices.push(i);
    else if (role === 'mid') midIndices.push(i);
    else if (role === 'fwd') fwdIndices.push(i);

    let gridPos: { col: number; row: number };
    
    if (role === 'gk') {
      gridPos = { col: side === 'home' ? 1 : 13, row: 4 };
    } else {
      gridPos = getGridPositionForRole(role, side, player.position, roleIdx);
    }

    const name = player.name || getGenericName(role, i);
    
    caps.push({
      id: `${side}_${role}_${i + 1}`,
      name,
      shirtNumber: player.shirtNumber || (role === 'gk' ? 1 : 10 + i),
      role,
      side,
      position: { col: gridPos.col, row: gridPos.row },
      hasBall: role === 'fwd' && fwdIndices.length === 1,
      rating: player.marketValue ? marketValueToRating(player.marketValue) : 60,
      apiId: player.id,
    });
  }

  const fwdWithBall = caps.find(c => c.role === 'fwd' && c.hasBall);
  if (!fwdWithBall) {
    const firstFwd = caps.find(c => c.role === 'fwd');
    if (firstFwd) {
      const idx = caps.findIndex(c => c.id === firstFwd.id);
      if (idx !== -1 && caps[idx]) {
        caps[idx].hasBall = true;
      }
    }
  }

  const defCount = caps.filter(c => c.role === 'def').length;
  const midCount = caps.filter(c => c.role === 'mid').length;
  const fwdCount = caps.filter(c => c.role === 'fwd').length;
  const shape = defCount > 0 || midCount > 0 || fwdCount > 0
    ? `${defCount}-${midCount}-${fwdCount}`
    : '4-3-3';

  return {
    side,
    shape,
    caps,
  };
}

function createFallbackFormation(side: CapSide): Formation {
  const caps: PlayerCap[] = [];
  const attackDir = side === 'home' ? 1 : -1;
  const baseCol = side === 'home' ? 0 : 14;

  const defaultPositions: { role: CapRole; col: number; row: number }[] = [
    { role: 'gk', col: baseCol + attackDir * 1, row: 4 },
    { role: 'def', col: baseCol + attackDir * 3, row: 1 },
    { role: 'def', col: baseCol + attackDir * 3, row: 3 },
    { role: 'def', col: baseCol + attackDir * 3, row: 5 },
    { role: 'def', col: baseCol + attackDir * 3, row: 7 },
    { role: 'mid', col: baseCol + attackDir * 6, row: 2 },
    { role: 'mid', col: baseCol + attackDir * 6, row: 4 },
    { role: 'mid', col: baseCol + attackDir * 6, row: 6 },
    { role: 'fwd', col: baseCol + attackDir * 9, row: 3 },
    { role: 'fwd', col: baseCol + attackDir * 9, row: 4 },
    { role: 'fwd', col: baseCol + attackDir * 9, row: 5 },
  ];

  for (let i = 0; i < defaultPositions.length; i++) {
    const pos = defaultPositions[i];
    if (!pos) continue;
    caps.push({
      id: `${side}_${pos.role}_${i + 1}`,
      name: getGenericName(pos.role, i),
      shirtNumber: pos.role === 'gk' ? 1 : 10 + i,
      role: pos.role,
      side,
      position: { col: pos.col, row: pos.row },
      hasBall: pos.role === 'fwd' && i === 8,
      rating: 60,
    });
  }

  return {
    side,
    shape: '4-3-3',
    caps,
  };
}

export function getCapById(formation: Formation, capId: string): PlayerCap | undefined {
  return formation.caps.find(c => c.id === capId);
}

export function getBallCarrier(formation: Formation): PlayerCap | undefined {
  return formation.caps.find(c => c.hasBall);
}

export function getCapsWithBall(state: { formations: { home: Formation; away: Formation } }): PlayerCap | null {
  const home = getBallCarrier(state.formations.home);
  if (home) return home;
  const away = getBallCarrier(state.formations.away);
  return away ?? null;
}

export function moveCap(formation: Formation, capId: string, newPosition: GridPosition): Formation {
  const newCaps = formation.caps.map(cap => {
    if (cap.id === capId) {
      return { ...cap, position: newPosition };
    }
    return cap;
  });
  return { ...formation, caps: newCaps };
}

export function transferBall(formation: Formation, toCapId: string): Formation {
  const newCaps = formation.caps.map(cap => ({
    ...cap,
    hasBall: cap.id === toCapId,
  }));
  return { ...formation, caps: newCaps };
}

export function getFormationAtPosition(formation: Formation, col: number, row: number): PlayerCap | undefined {
  return formation.caps.find(cap => cap.position.col === col && cap.position.row === row);
}

export function getAverageRating(formation: Formation): number {
  if (formation.caps.length === 0) return 60;
  const total = formation.caps.reduce((sum, cap) => sum + cap.rating, 0);
  return Math.round(total / formation.caps.length);
}