import type { Move, Resolution, PlayerNumber, Outcome, GameState, GridPosition } from '../types/index.js';
import { endPhase } from './matchup.js';
import { updateGameState } from '../services/matchmaking.js';

export function randomiser(): number {
  return Math.floor(Math.random() * 31) - 15;
}

export const OUTCOME_MATRIX: Record<Move, Record<Move, number>> = {
  pass: {
    hold_shape: 65,
    press: 45,
    tackle: 40,
    run: 60,
    pass: 55,
    long_ball: 55,
    shoot: 55,
    sprint: 50,
  },
  long_ball: {
    hold_shape: 50,
    press: 60,
    tackle: 35,
    run: 55,
    pass: 50,
    long_ball: 50,
    shoot: 50,
    sprint: 55,
  },
  run: {
    hold_shape: 60,
    press: 50,
    tackle: 45,
    run: 55,
    pass: 60,
    long_ball: 55,
    shoot: 55,
    sprint: 50,
  },
  shoot: {
    hold_shape: 55,
    press: 70,
    tackle: 70,
    run: 60,
    pass: 65,
    long_ball: 60,
    shoot: 55,
    sprint: 60,
  },
  sprint: {
    hold_shape: 65,
    press: 50,
    tackle: 40,
    run: 60,
    pass: 60,
    long_ball: 55,
    shoot: 55,
    sprint: 55,
  },
  press: {
    hold_shape: 40,
    press: 50,
    tackle: 50,
    run: 45,
    pass: 45,
    long_ball: 40,
    shoot: 40,
    sprint: 45,
  },
  tackle: {
    hold_shape: 35,
    press: 45,
    tackle: 50,
    run: 40,
    pass: 40,
    long_ball: 35,
    shoot: 35,
    sprint: 40,
  },
  hold_shape: {
    hold_shape: 35,
    press: 40,
    tackle: 40,
    run: 35,
    pass: 35,
    long_ball: 35,
    shoot: 35,
    sprint: 35,
  },
};

/**
 * Update ball and player positions based on resolution outcome.
 * Ball moves forward (toward goal) on advance, backward on intercept/tackle.
 * Players shift with the ball.
 */
function updatePositions(state: GameState, outcome: Outcome, possessionChange: boolean): void {
  const attacker = state.attackingPlayer;
  const defender = attacker === 'p1' ? 'p2' : 'p1';

  // Determine direction: p1 attacks right (increasing col), p2 attacks left (decreasing col)
  const attackDir = attacker === 'p1' ? 1 : -1;

  const ball = state.ball.position;

  switch (outcome) {
    case 'advance': {
      // Ball advances forward
      const newCol = Math.max(1, Math.min(9, ball.col + attackDir * 1));
      // Slight lateral drift
      const rowDrift = Math.random() > 0.5 ? 1 : -1;
      const newRow = Math.max(1, Math.min(8, ball.row + (Math.random() > 0.6 ? rowDrift : 0)));
      state.ball.position = { col: newCol, row: newRow };
      // Attacker follows ball
      state.players[attacker].position = { col: newCol, row: newRow };
      break;
    }
    case 'goal': {
      // Ball goes to goal position then resets to center
      state.ball.position = { col: 5, row: 5 };
      state.players[attacker].position = { col: 5, row: 5 };
      state.players[defender].position = { col: 5, row: 4 };
      break;
    }
    case 'intercept':
    case 'tackle': {
      // Ball goes to defender
      const defCol = Math.max(1, Math.min(9, ball.col - attackDir * 1));
      const defRow = Math.max(1, Math.min(8, ball.row + (Math.random() > 0.5 ? 1 : -1)));
      state.ball.position = { col: defCol, row: defRow };
      state.players[defender].position = { col: defCol, row: defRow };
      break;
    }
    case 'save': {
      // Ball goes back to defender (keeper saves)
      state.ball.position = { col: attacker === 'p1' ? 8 : 2, row: 5 };
      break;
    }
    case 'miss': {
      // Ball stays roughly where it was
      break;
    }
  }

  // Update ball carrier
  if (possessionChange) {
    state.ball.carrier = defender;
  } else {
    state.ball.carrier = attacker;
  }
}

export async function resolveTurn(
  sessionId: string,
  attackerMove: Move,
  defenderMove: Move,
  state: GameState
): Promise<Resolution> {
  const attacker = state.attackingPlayer;
  const defender = attacker === 'p1' ? 'p2' : 'p1';

  const base = OUTCOME_MATRIX[attackerMove][defenderMove];
  const score = Math.max(0, Math.min(100, base + randomiser()));

  let outcome: Outcome;
  let goalScored = false;
  let possessionChange = false;

  if (attackerMove === 'shoot') {
    if (score > 60) {
      outcome = 'goal';
      goalScored = true;
    } else if (score > 40) {
      outcome = 'miss';
    } else {
      outcome = 'save';
      possessionChange = true;
    }
  } else {
    if (score > 50) {
      outcome = 'advance';
    } else {
      outcome = 'intercept';
      possessionChange = true;
    }
  }

  // Strong defensive win = tackle
  if (score < 25 && attackerMove !== 'shoot') {
    outcome = 'tackle';
    possessionChange = true;
    state.stats[defender].tackles++;
  }

  // Update score and events
  if (goalScored) {
    state.score[attacker]++;
    state.stats[attacker].shots++;
    state.events.push({
      type: 'goal',
      player: attacker,
      turn: state.turn,
      phase: state.phase,
    });
  }

  if (attackerMove === 'shoot' && !goalScored) {
    state.stats[attacker].shots++;
  }

  if (possessionChange) {
    state.attackingPlayer = defender;
    state.events.push({
      type: 'possession_change',
      player: defender,
      turn: state.turn,
      phase: state.phase,
    });
  }

  if (!possessionChange) {
    state.stats[attacker].possession++;
  }

  // Update ball and player positions
  updatePositions(state, outcome, possessionChange);

  const resolution: Resolution = {
    p1Move: attacker === 'p1' ? attackerMove : defenderMove,
    p2Move: attacker === 'p2' ? attackerMove : defenderMove,
    outcome,
    possessionChange,
    goalScored,
    scorer: goalScored ? attacker : undefined,
  };

  state.lastResolution = resolution;
  state.turn++;
  state.players[attacker].movesRemaining--;
  state.players[attacker].movesUsed.push(attackerMove);

  // Check if the phase should end
  // Phase ends when the attacking player has used all their moves for this phase
  // Since possession can change mid-phase, we track total turns in the phase
  await checkPhaseTransition(sessionId, state);

  return resolution;
}

/**
 * Phase transition logic:
 * Each phase has `movesPerPhase` turns total (not per player).
 * The turn counter tracks this. When turn exceeds movesPerPhase, the phase ends.
 */
async function checkPhaseTransition(sessionId: string, state: GameState): Promise<void> {
  // state.turn was already incremented, so it's 1-indexed after this turn
  // If we've completed movesPerPhase turns in this phase, end it
  if (state.turn > state.movesPerPhase) {
    await endPhase(sessionId, state);
  } else {
    state.turnStatus = 'waiting_both';
    await updateGameState(sessionId, state);
  }
}