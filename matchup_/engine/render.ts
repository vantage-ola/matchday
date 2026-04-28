import { GameState, Player, Role } from './types.js';
import { getBallCarrier } from './formations.js';

const ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];

const ROLE_LABEL: Record<Role, string> = { gk: 'GK', def: 'DEF', mid: 'MID', fwd: 'FWD' };

export function renderPitch(state: GameState): string {
  const players = state.players;
  const ball = state.ball;

  let lines: string[] = [];

  lines.push('');
  lines.push('        HOME attacks → → → → → → →          AWAY');
  lines.push('        ══════════════════════════════════');

  for (let rowIdx = 0; rowIdx < ROWS.length; rowIdx++) {
    const row = ROWS[rowIdx];
    let cells: string[] = [];

    for (let col = 1; col <= 22; col++) {
      const player = players.find(
        (p) => p.position.col === col && p.position.row === row
      );
      const isBallHere = col === ball.col && row === ball.row;
      const isHomeGoal = col === 1 && row >= 'e' && row <= 'g';
      const isAwayGoal = col === 22 && row >= 'e' && row <= 'g';
      const isMidline = col === 11;

      if (player) {
        const label = player.role === 'gk' ? 'GK' : player.role[0].toUpperCase();
        const team = player.team === 'home' ? 'H' : 'A';
        const ballMark = player.hasBall ? '*' : '';
        cells.push(team + label + ballMark);
      } else if (isBallHere) {
        cells.push('(*)');
      } else if (isHomeGoal || isAwayGoal) {
        cells.push('▓▓▓');
      } else if (isMidline) {
        cells.push(' │ ');
      } else {
        cells.push(' · ');
      }
    }

    const rowLabel = row.toUpperCase();
    const isGoalRow = row >= 'e' && row <= 'g';
    const leftEdge = isGoalRow ? '▓' : ' ';
    const rightEdge = isGoalRow ? '▓' : ' ';

    lines.push(' ' + rowLabel + ' ' + leftEdge + cells.join('') + rightEdge);
  }

  lines.push('        ══════════════════════════════════');
  lines.push('        (home goal: col 1)    (away goal: col 22)');
  lines.push('');
  lines.push('  Legend: H=home(A=away)  *=ball  ▓=goal  D/M/F=def/mid/fwd');

  return lines.join('\n');
}

export function renderStatus(state: GameState): string {
  const bc = getBallCarrier(state);
  const movePhase = state.movePhase === 'attack' ? 'ATTACK' : 'DEFEND';
  const possession = state.possession.toUpperCase();
  const minsLeft = Math.floor(state.timeRemaining / 60);
  const secsLeft = state.timeRemaining % 60;
  const timeStr = minsLeft + ':' + secsLeft.toString().padStart(2, '0');

  const scoreLine = (state.score.home + ' - ' + state.score.away).padEnd(24);
  const phaseLine = ('Phase ' + state.phase + ', ' + movePhase + ' (' + possession + ')').padEnd(24);
  const timeLine = (timeStr + (state.status !== 'playing' ? ' [' + state.status + ']' : '')).padEnd(24);
  const ballLine = bc ? bc.name + ' at ' + state.ball.row + state.ball.col : 'none';

  return `
┌─────────────────────────────────────────┐
│  SCORE   ${scoreLine} │
│  PHASE   ${phaseLine} │
│  TIME    ${timeLine} │
│  BALL    ${ballLine} │
└─────────────────────────────────────────┘`;
}

export function renderTurnSummary(
  state: GameState,
  prevState: GameState | null
): string {
  if (!prevState) return '';

  let summary = '';

  const scoredHome = state.score.home > prevState.score.home;
  const scoredAway = state.score.away > prevState.score.away;

  if (scoredHome) {
    summary += '→ GOAL! HOME scores!\n';
  } else if (scoredAway) {
    summary += '→ GOAL! AWAY scores!\n';
  } else if (state.possession !== prevState.possession) {
    summary += '→ Possession: ' + state.possession.toUpperCase() + '\n';
  }

  const movePhase = state.movePhase === 'attack' ? 'ATTACK' : 'DEFEND';
  summary += 'Score: ' + state.score.home + ' - ' + state.score.away + '  |  Phase ' + state.phase + ', ' + movePhase + ' (' + state.possession.toUpperCase() + ')';

  return summary;
}

export function visualizeGame(state: GameState): string {
  return renderPitch(state) + '\n' + renderStatus(state);
}