import type { GameState, MatchEvent, MatchEventType, MoveResult, Outcome, Player, GridPosition, Team, MoveType } from './types.js';
import {
  initGameState,
  getPlayer,
  getBallCarrier,
  getTeamPlayers,
  listFormations,
  getFormation,
  FORMATIONS,
  resetPositions,
  type InitOptions,
} from './formations.js';

import {
  validateMove,
  classifyMove,
  checkInterception,
} from './moves.js';
import { gridDistance, MOVE_TIME, halfTimeThresholdFor, rowToNum } from './types.js';

function describeOutcome(player: Player, outcome: Outcome, moveLabel: MoveType): string {
  switch (outcome) {
    case 'goal':
      return `GOAL — ${player.name} scores`;
    case 'miss':
      return `${player.name} shoots wide`;
    case 'blocked':
      return `${player.name}'s shot is blocked`;
    case 'tackled':
      return `${player.name} wins the tackle`;
    case 'tackleFailed':
      return `${player.name}'s tackle missed`;
    case 'intercepted':
      return `${player.name}'s pass intercepted`;
    default:
      return `${player.name} ${moveLabel === 'pass' ? 'passes' : 'moves'}`;
  }
}

function outcomeToEventType(outcome: Outcome, moveLabel: MoveType): MatchEventType {
  switch (outcome) {
    case 'goal':
      return 'goal';
    case 'miss':
      return 'miss';
    case 'blocked':
      return 'blocked';
    case 'tackled':
      return 'tackle';
    case 'tackleFailed':
      return 'tackleFailed';
    case 'intercepted':
      return 'interception';
    default:
      return moveLabel === 'pass' ? 'pass' : 'move';
  }
}

export { listFormations, getFormation, FORMATIONS };
export { MOVE_TIME, DEFAULT_MATCH_LENGTH, halfTimeThresholdFor } from './types.js';
export {
  previewPass,
  previewTackle,
  getPassTargets,
  classifyMove,
  validateMove,
  checkInterception,
} from './moves.js';
export type {
  PassPreview,
  TacklePreview,
  PassTarget,
  LineRisk,
} from './moves.js';
export type {
  MatchEvent,
  MatchEventType,
  PlayerStats,
} from './types.js';
export { emptyPlayerStats } from './types.js';

export class Engine {
  private state: GameState;
  private rng: () => number;

  constructor(state?: GameState, rng: () => number = Math.random) {
    this.state = state ? JSON.parse(JSON.stringify(state)) : initGameState();
    this.rng = rng;
  }

  getState(): GameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  getPlayer(playerId: string): Player | undefined {
    return getPlayer(this.state, playerId);
  }

  getBallCarrier(): Player | undefined {
    return getBallCarrier(this.state);
  }

  getTeam(team: Team): Player[] {
    return getTeamPlayers(this.state, team);
  }

  applyMove(playerId: string, to: GridPosition): MoveResult {
    if (this.state.status !== 'playing') {
      return { valid: false, outcome: 'blocked', newState: this.getState() };
    }

    const player = getPlayer(this.state, playerId);
    if (!player) {
      return { valid: false, outcome: 'blocked', newState: this.getState() };
    }

    const validation = validateMove(this.state, playerId, to);
    if (!validation.valid) {
      return { valid: false, outcome: 'blocked', newState: this.getState() };
    }

    const ballCarrier = getBallCarrier(this.state);
    const moveType = classifyMove(this.state, player, to);

    let outcome: Outcome = 'success';
    let scored = false;
    let possessionChange = false;
    let moveTypeLabel: MoveType = 'move';

    // Deep clone for mutation
    const newState = JSON.parse(JSON.stringify(this.state)) as GameState;
    const mover = newState.players.find((p) => p.id === playerId);
    if (!mover) {
      return { valid: false, outcome: 'blocked', newState: this.getState() };
    }

    // ---- HANDLE EACH MOVE TYPE ----

    if (moveType === 'shoot') {
      moveTypeLabel = 'shoot';
      const targetGoal = player.team === 'home' ? 22 : 1;
      const isOnTarget = to.col === targetGoal && to.row >= 'e' && to.row <= 'g';

      if (!isOnTarget) {
        // Shot off target — possession lost to opposing GK
        outcome = 'miss';
        possessionChange = true;
        mover.hasBall = false;
        const opponents = newState.players.filter((p) => p.team !== player.team);
        const gk = opponents.find((p) => p.role === 'gk');
        if (gk) gk.hasBall = true;
      } else {
        // On target — check if defenders block
        const defenders = newState.players.filter(
          (d) => d.team !== player.team && d.role !== 'gk'
        );
        const nearGoal = defenders.filter((d) => gridDistance(d.position, to) < 2);

        if (nearGoal.length > 0) {
          outcome = 'blocked';
          possessionChange = true;
          mover.hasBall = false;
          const blocker = newState.players.find((p) => p.id === nearGoal[0].id);
          if (blocker) blocker.hasBall = true;
        } else {
          // GOAL
          outcome = 'goal';
          scored = true;
          newState.score[player.team]++;

          resetPositions(newState);

          const concedingTeam = player.team === 'home' ? 'away' : 'home';
          newState.possession = concedingTeam;
          const kickoffFwd = newState.players.find(
            (p) => p.team === concedingTeam && p.role === 'fwd'
          );
          if (kickoffFwd) {
            kickoffFwd.hasBall = true;
          } else {
            const fallback = newState.players.find((p) => p.team === concedingTeam);
            if (fallback) fallback.hasBall = true;
          }
        }
      }

    } else if (moveType === 'pass') {
      moveTypeLabel = 'pass';
      const targetPlayer = newState.players.find(
        (p) => p.position.col === to.col && p.position.row === to.row
      );

      // Geometric interception only — no distance-tiered RNG.
      const geometric = checkInterception(
        this.state,
        player.position,
        to,
        player.team
      );

      if (geometric.intercepted && geometric.interceptorId) {
        outcome = 'intercepted';
        possessionChange = true;
        mover.hasBall = false;
        const intPlayer = newState.players.find((p) => p.id === geometric.interceptorId);
        if (intPlayer) intPlayer.hasBall = true;
      } else if (targetPlayer) {
        mover.hasBall = false;
        targetPlayer.hasBall = true;
      }

    } else if (moveType === 'tackle') {
      moveTypeLabel = 'tackle';

      // Fixed 80% success at 1 cell (the only legal tackle distance now).
      const tackleSucceeds = this.rng() < 0.80;

      if (tackleSucceeds) {
        outcome = 'tackled';
        possessionChange = true;

        // Swap positions: tackler goes to carrier's spot, carrier displaced to tackler's origin
        const tacklerOrigPos = { ...mover.position };
        mover.position = { ...to };

        const formerCarrier = newState.players.find((p) => p.id === ballCarrier!.id);
        if (formerCarrier) {
          formerCarrier.position = tacklerOrigPos;
          formerCarrier.hasBall = false;
        }
        mover.hasBall = true;
      } else {
        // Failed tackle: carrier keeps ball, tackler bounces back, no possession flip.
        outcome = 'tackleFailed';
        const dCol = mover.position.col - ballCarrier!.position.col;
        const dRow = rowToNum(mover.position.row) - rowToNum(ballCarrier!.position.row);
        const stepCol = Math.sign(dCol);
        const stepRow = Math.sign(dRow);
        const pushedCol = mover.position.col + stepCol;
        const pushedRowNum = rowToNum(mover.position.row) + stepRow;
        const inBounds =
          pushedCol >= 1 && pushedCol <= 22 && pushedRowNum >= 0 && pushedRowNum <= 10;
        if (inBounds) {
          const pushedRow = String.fromCharCode('a'.charCodeAt(0) + pushedRowNum);
          const occupied = newState.players.some(
            (p) => p.id !== mover.id && p.position.col === pushedCol && p.position.row === pushedRow
          );
          if (!occupied && (stepCol !== 0 || stepRow !== 0)) {
            mover.position = { col: pushedCol, row: pushedRow };
          }
        }
      }

    } else {
      // dribble or off-ball run
      moveTypeLabel = 'move';
      mover.position = { ...to };
    }

    // ---- UPDATE BALL POSITION ----
    const newBallCarrier = newState.players.find((p) => p.hasBall);
    if (newBallCarrier) {
      newState.ball = { ...newBallCarrier.position };
      newState.ballCarrierId = newBallCarrier.id;
    } else {
      newState.ball = { col: 0, row: 'a' };
      newState.ballCarrierId = null;
    }

    // ---- POSSESSION (chess-style: every successful action flips the turn) ----
    const movingTeam = player.team;

    if (scored) {
      // Conceding team already given the ball above; possession set there.
    } else if (possessionChange) {
      // Tackle / interception / miss / block: possession follows whoever now holds the ball.
      const nowCarrier = newState.players.find((p) => p.hasBall);
      newState.possession = nowCarrier
        ? nowCarrier.team
        : (newState.possession === 'home' ? 'away' : 'home');
    } else {
      // Normal dribble / pass / run: turn ends, opponent moves next.
      newState.possession = movingTeam === 'home' ? 'away' : 'home';
    }

    // ---- UPDATE TIME ----
    newState.timeRemaining = Math.max(0, newState.timeRemaining - MOVE_TIME);

    // ---- PER-PLAYER STATS ----
    const moverAfter = newState.players.find((p) => p.id === playerId)!;
    if (moveTypeLabel === 'pass') {
      moverAfter.stats.passes++;
      if (outcome !== 'intercepted') moverAfter.stats.passesCompleted++;
      if (outcome === 'intercepted' && newBallCarrier) {
        const interceptor = newState.players.find((p) => p.id === newBallCarrier.id);
        if (interceptor) interceptor.stats.interceptions++;
      }
    } else if (moveTypeLabel === 'shoot') {
      moverAfter.stats.shots++;
      const targetGoal = player.team === 'home' ? 22 : 1;
      if (to.col === targetGoal && to.row >= 'e' && to.row <= 'g') {
        moverAfter.stats.shotsOnTarget++;
      }
      if (outcome === 'goal') moverAfter.stats.goals++;
    } else if (moveTypeLabel === 'tackle') {
      moverAfter.stats.tackles++;
      if (outcome === 'tackled') moverAfter.stats.tacklesWon++;
    }

    // ---- EVENT LOG ----
    const eventType = outcomeToEventType(outcome, moveTypeLabel);
    const description = describeOutcome(player, outcome, moveTypeLabel);
    const event: MatchEvent = {
      moveNumber: newState.events.length + 1,
      time: newState.timeRemaining,
      type: eventType,
      team: player.team,
      description,
      playerId,
      from: { ...player.position },
      to: { ...to },
    };
    newState.events.push(event);

    // ---- GAME END ----
    if (newState.timeRemaining <= 0) {
      newState.status = 'fullTime';
    } else if (
      !newState.halfTimeTriggered &&
      newState.timeRemaining <= halfTimeThresholdFor(newState.matchLength)
    ) {
      newState.halfTimeTriggered = true;
      newState.status = 'halfTime';
    }

    // Commit
    this.state = newState;

    return {
      valid: true,
      move: { playerId, from: player.position, to, type: moveTypeLabel },
      outcome,
      newState: this.getState(),
      scored,
      possessionChange,
    };
  }

  resumeFromHalfTime(): GameState {
    if (this.state.status !== 'halfTime') return this.getState();
    const newState = JSON.parse(JSON.stringify(this.state)) as GameState;
    newState.status = 'playing';
    this.state = newState;
    return this.getState();
  }

  static init(
    homeFormation?: keyof typeof FORMATIONS,
    awayFormation?: keyof typeof FORMATIONS,
    rng?: () => number,
    options?: InitOptions
  ): Engine {
    return new Engine(initGameState(homeFormation, awayFormation, options), rng);
  }

  static listFormations() {
    return listFormations();
  }
}

export { Engine as default };
