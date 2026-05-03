import type { GameState, MoveResult, Outcome, MovePhase, Player, GridPosition, Team, MoveType } from './types.js';
import {
  initGameState,
  getPlayer,
  getBallCarrier,
  getTeamPlayers,
  listFormations,
  getFormation,
  FORMATIONS,
  resetPositions,
} from './formations.js';

import {
  validateMove,
  classifyMove,
  checkInterception,
} from './moves.js';
import { gridDistance, AP_COST, HALF_TIME_THRESHOLD, passApCost, rowToNum } from './types.js';

const MOVE_TIME = 10; // seconds per move

export { listFormations, getFormation, FORMATIONS };

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

  getCurrentPhase(): { team: Team; moveNumber: number; phase: MovePhase } {
    return {
      team: this.state.possession,
      moveNumber: this.state.moveNumber,
      phase: this.state.movePhase,
    };
  }

  applyMove(playerId: string, to: GridPosition): MoveResult {
    if (this.state.status !== 'playing') {
      return { valid: false, outcome: 'blocked', newState: this.getState() };
    }

    // Exhaustion auto-flip: if the possessing team has no AP, hand the ball to the opponent.
    if (this.state.actionPoints[this.state.possession] <= 0) {
      const flipped = JSON.parse(JSON.stringify(this.state)) as GameState;
      flipped.possession = flipped.possession === 'home' ? 'away' : 'home';
      flipped.moveNumber = 1;
      flipped.movePhase = 'attack';
      this.state = flipped;
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
    const hasBall = ballCarrier?.id === player.id;
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
        // Shot off target — possession lost
        outcome = 'miss';
        possessionChange = true;
        mover.hasBall = false;
        // Nearest opponent gets the ball (goalkeeper if nearby, otherwise closest)
        const opponents = newState.players.filter(
          (p) => p.team !== player.team
        );
        const gk = opponents.find((p) => p.role === 'gk');
        // Give to GK for simplicity on a miss
        if (gk) gk.hasBall = true;
      } else {
        // On target — check if defenders block
        const defenders = newState.players.filter(
          (d) => d.team !== player.team && d.role !== 'gk'
        );
        const nearGoal = defenders.filter((d) => {
          return gridDistance(d.position, to) < 2;
        });

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

          // Reset all players to formation positions
          resetPositions(newState);

          // Conceding team gets kickoff
          const concedingTeam = player.team === 'home' ? 'away' : 'home';
          newState.possession = concedingTeam;
          const kickoffFwd = newState.players.find(
            (p) => p.team === concedingTeam && p.role === 'fwd'
          );
          if (kickoffFwd) {
            kickoffFwd.hasBall = true;
          } else {
            // Fallback: any player on conceding team
            const fallback = newState.players.find(
              (p) => p.team === concedingTeam
            );
            if (fallback) fallback.hasBall = true;
          }

          newState.moveNumber = 1;
          newState.movePhase = 'attack';
        }
      }

    } else if (moveType === 'pass') {
      moveTypeLabel = 'pass';
      const targetPlayer = newState.players.find(
        (p) => p.position.col === to.col && p.position.row === to.row
      );

      // Distance-tiered risk: <=2 cells = 0%, 3 cells = 10%, >=4 cells = 25%.
      const passDist = gridDistance(player.position, to);
      const risk = passDist <= 2 ? 0 : passDist === 3 ? 0.10 : 0.25;
      const forcedInterception = risk > 0 && this.rng() < risk;

      // Geometric interception (defender on the pass line).
      const geometric = checkInterception(
        this.state,
        player.position,
        to,
        player.team
      );

      let interceptorId: string | null = geometric.intercepted ? geometric.interceptorId : null;

      if (forcedInterception && !interceptorId) {
        // Pick the opponent closest to the pass line within 3 cells; fall back to GK.
        const opponents = this.state.players.filter((p) => p.team !== player.team);
        let bestId: string | null = null;
        let bestDist = Infinity;
        const fromCol = player.position.col;
        const fromRow = rowToNum(player.position.row);
        const toCol = to.col;
        const toRow = rowToNum(to.row);
        const lenSq = (toCol - fromCol) ** 2 + (toRow - fromRow) ** 2;
        for (const opp of opponents) {
          if (opp.hasBall) continue;
          let d: number;
          if (lenSq < 0.01) {
            d = Math.hypot(opp.position.col - fromCol, rowToNum(opp.position.row) - fromRow);
          } else {
            const t = Math.max(0, Math.min(1,
              ((opp.position.col - fromCol) * (toCol - fromCol) +
                (rowToNum(opp.position.row) - fromRow) * (toRow - fromRow)) / lenSq
            ));
            const projCol = fromCol + t * (toCol - fromCol);
            const projRow = fromRow + t * (toRow - fromRow);
            d = Math.hypot(opp.position.col - projCol, rowToNum(opp.position.row) - projRow);
          }
          if (d < bestDist && d <= 3) {
            bestDist = d;
            bestId = opp.id;
          }
        }
        if (!bestId) {
          const gk = opponents.find((p) => p.role === 'gk');
          if (gk) bestId = gk.id;
        }
        interceptorId = bestId;
      }

      if (interceptorId) {
        outcome = 'intercepted';
        possessionChange = true;
        mover.hasBall = false;
        const intPlayer = newState.players.find((p) => p.id === interceptorId);
        if (intPlayer) intPlayer.hasBall = true;
      } else if (targetPlayer) {
        mover.hasBall = false;
        targetPlayer.hasBall = true;
      }

    } else if (moveType === 'tackle') {
      moveTypeLabel = 'tackle';

      // Distance-tiered success: 1 cell = 80%, 2 cells = 40%.
      const tackleDist = gridDistance(player.position, ballCarrier!.position);
      const successChance = tackleDist === 1 ? 0.80 : 0.40;
      const tackleSucceeds = this.rng() < successChance;

      if (tackleSucceeds) {
        outcome = 'tackled';
        possessionChange = true;

        // Swap positions: tackler goes to carrier's spot, carrier displaced to tackler's origin
        const tacklerOrigPos = { ...mover.position };
        mover.position = { ...to };

        const formerCarrier = newState.players.find(
          (p) => p.id === ballCarrier!.id
        );
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
      // Should not happen in normal flow, but guard against it
      newState.ball = { col: 0, row: 'a' };
      newState.ballCarrierId = null;
    }

    // ---- UPDATE AP, POSSESSION & MOVE COUNT ----
    const movingTeam = player.team;

    // Always debit AP for the actor's intended move (shoot/pass/dribble/run/tackle).
    if (moveType === 'dribble' || moveType === 'pass' || moveType === 'run' || moveType === 'shoot' || moveType === 'tackle') {
      const cost = moveType === 'pass'
        ? passApCost(gridDistance(player.position, to))
        : AP_COST[moveType];
      newState.actionPoints[movingTeam] = Math.max(0, newState.actionPoints[movingTeam] - cost);
    }

    // Goal: ball already given to conceding team above. AP is NOT refilled (per-half stamina model).
    if (scored) {
      newState.moveNumber = 1;
      newState.movePhase = 'attack';
    }
    // Possession change (tackle / interception / miss / block): flip to whichever team now holds the ball.
    // AP is NOT refilled — both teams keep what's left in their per-half pool.
    else if (possessionChange) {
      const newCarrier = newState.players.find((p) => p.hasBall);
      newState.possession = newCarrier ? newCarrier.team : (newState.possession === 'home' ? 'away' : 'home');
      newState.moveNumber = 1;
      newState.movePhase = 'attack';
    }
    // Normal successful play: just bump the move counter (AP already debited above).
    else {
      newState.moveNumber++;
    }

    // ---- UPDATE TIME ----
    newState.timeRemaining = Math.max(0, newState.timeRemaining - MOVE_TIME);

    // ---- GAME END ----
    if (newState.timeRemaining <= 0) {
      newState.status = 'fullTime';
    } else if (
      !newState.halfTimeTriggered &&
      newState.timeRemaining <= HALF_TIME_THRESHOLD
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

  skipPhase(): GameState {
    if (this.state.status !== 'playing') return this.getState();
    const newState = JSON.parse(JSON.stringify(this.state)) as GameState;
    newState.possession = newState.possession === 'home' ? 'away' : 'home';
    newState.moveNumber = 1;
    newState.movePhase = 'attack';
    this.state = newState;
    return this.getState();
  }

  resumeFromHalfTime(): GameState {
    if (this.state.status !== 'halfTime') return this.getState();
    const newState = JSON.parse(JSON.stringify(this.state)) as GameState;
    newState.actionPoints.home = newState.maxActionPoints;
    newState.actionPoints.away = newState.maxActionPoints;
    newState.status = 'playing';
    this.state = newState;
    return this.getState();
  }

  static init(
    homeFormation?: keyof typeof FORMATIONS,
    awayFormation?: keyof typeof FORMATIONS,
    rng?: () => number
  ): Engine {
    return new Engine(initGameState(homeFormation, awayFormation), rng);
  }

  static listFormations() {
    return listFormations();
  }
}

export { Engine as default };