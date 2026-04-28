import type { GameState, MoveResult, Outcome, MovePhase, Player, GridPosition, Team, GameStatus } from './types.js';
import {
  initGameState,
  getPlayer,
  getBallCarrier,
  getTeamPlayers,
  getPlayerAt,
  listFormations,
  getFormation,
  FORMATIONS,
  GAME_DURATION,
} from './formations.js';

const MOVE_TIME = 10; // seconds per move
import {
  validateMove,
  canMoveTo,
  getAttackDirection,
} from './moves.js';
import { isGoalPosition } from './types.js';

function rowToNum(row: string): number {
  return row.charCodeAt(0) - 'a'.charCodeAt(0);
}

export { listFormations, getFormation, FORMATIONS };

export class Engine {
  private state: GameState;

  constructor(state?: GameState) {
    this.state = state || initGameState();
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

    let outcome: Outcome = 'success';
    let scored = false;
    let possessionChange = false;
    let newState = JSON.parse(JSON.stringify(this.state)) as GameState;

    const mover = newState.players.find((p) => p.id === playerId);
    if (!mover) {
      return { valid: false, outcome: 'blocked', newState: this.state };
    }

    const attackDir = getAttackDirection(player.team);
    const targetGoal = player.team === 'home' ? 22 : 1;
    const isShooting = hasBall && to.col === targetGoal && to.row >= 'e' && to.row <= 'g';

    if (isShooting) {
      const defenders = getTeamPlayers(this.state, player.team === 'home' ? 'away' : 'home').filter((d) => d.role !== 'gk');
      const nearGoal = defenders.filter((d) => {
        const dist = Math.sqrt(
          Math.pow(d.position.col - to.col, 2) +
            Math.pow(rowToNum(d.position.row) - rowToNum(to.row), 2)
        );
        return dist < 2;
      });

      if (nearGoal.length > 0) {
        outcome = 'blocked';
        possessionChange = true;
        mover.hasBall = false;
        const defender = nearGoal[0];
        const defPlayer = newState.players.find((p) => p.id === defender.id);
        if (defPlayer) {
          defPlayer.hasBall = true;
        }
      } else {
        outcome = 'goal';
        scored = true;
        newState.score[player.team]++;

        // After goal: like football — ball goes to the team that was scored on
        // Reset both teams to starting positions, ball goes to scoring-on team at kickoff spot
        newState.players.forEach((p) => {
          p.hasBall = false;
          // Reset to default formation positions
          const team = p.team;
          if (team === 'home') {
            if (p.role === 'gk') p.position = { col: 1, row: 'f' };
            else if (p.role === 'def') p.position = { col: 3, row: p.position.row };
            else if (p.role === 'mid') p.position = { col: 6, row: p.position.row };
            else if (p.role === 'fwd') p.position = { col: 9, row: p.position.row };
          } else {
            if (p.role === 'gk') p.position = { col: 22, row: 'f' };
            else if (p.role === 'def') p.position = { col: 20, row: p.position.row };
            else if (p.role === 'mid') p.position = { col: 17, row: p.position.row };
            else if (p.role === 'fwd') p.position = { col: 14, row: p.position.row };
          }
        });

        // Conceding team gets the ball at their kickoff forward position
        const concedingTeam = player.team === 'home' ? 'away' : 'home';
        const kickoffFwd = newState.players.find(
          (p) => p.team === concedingTeam && p.role === 'fwd' && p.position.col === (concedingTeam === 'home' ? 9 : 14)
        );
        if (kickoffFwd) {
          kickoffFwd.hasBall = true;
        }

        // Check for half-time
        if (newState.timeRemaining <= GAME_DURATION / 2 && newState.timeRemaining > GAME_DURATION / 2 - 30) {
          newState.status = 'halfTime';
        }
      }
    } else if (hasBall) {
      const target = getPlayerAt(this.state, to);
      if (target && target.team === player.team && target.id !== player.id) {
        const intercept = this.checkInterception(player.position, to, player.team);
        if (intercept.intercepted) {
          outcome = 'intercepted';
          possessionChange = true;
          const intPlayer = newState.players.find(
            (p) => p.id === intercept.interceptorId
          );
          if (intPlayer) {
            intPlayer.hasBall = true;
          }
          // Clear ball from passer
          mover.hasBall = false;
        } else {
          mover.hasBall = false;
          const targetP = newState.players.find((p) => p.id === target.id);
          if (targetP) {
            targetP.hasBall = true;
          }
        }
      } else {
        mover.position = { ...to };
      }
    } else {
      mover.position = { ...to };
    }

    const newBallCarrier = newState.players.find((p) => p.hasBall);
    if (newBallCarrier) {
      newState.ball = { ...newBallCarrier.position };
      newState.ballCarrierId = newBallCarrier.id;
    } else {
      newState.ball = { col: 0, row: 'a' };
      newState.ballCarrierId = null;
    }

    if (possessionChange || scored) {
      newState.possession = newState.possession === 'home' ? 'away' : 'home';
      newState.moveNumber = 1;
      newState.movePhase = 'attack';
    } else if (hasBall) {
      if (newState.moveNumber >= 3) {
        newState.possession = newState.possession === 'home' ? 'away' : 'home';
        newState.moveNumber = 1;
        newState.movePhase = 'attack';
      } else {
        newState.moveNumber++;
      }
    } else {
      if (newState.moveNumber >= 3) {
        newState.moveNumber = 1;
        newState.movePhase = 'attack';
      } else {
        newState.moveNumber++;
      }
    }

    // Update time remaining
    newState.timeRemaining = Math.max(0, newState.timeRemaining - MOVE_TIME);

    // Check for game over
    if (newState.timeRemaining <= 0 && newState.status === 'playing') {
      newState.status = 'fullTime';
    }

    this.state = newState;

    return {
      valid: true,
      move: { playerId, from: player.position, to, type: 'move' },
      outcome,
      newState: this.getState(),
      scored,
      possessionChange,
    };
  }

  private checkInterception(
    from: GridPosition,
    to: GridPosition,
    passingTeam: Team
  ): { intercepted: boolean; interceptorId: string | null } {
    const defenders = getTeamPlayers(this.state, passingTeam === 'home' ? 'away' : 'home');

    const passLen = Math.sqrt(
      Math.pow(to.col - from.col, 2) +
        Math.pow(rowToNum(to.row) - rowToNum(from.row), 2
    ));

    if (passLen < 0.1) return { intercepted: false, interceptorId: null };

    for (const def of defenders) {
      const t = Math.max(
        0,
        Math.min(
          1,
          ((def.position.col - from.col) * (to.col - from.col) +
            (rowToNum(def.position.row) - rowToNum(from.row)) *
              (rowToNum(to.row) - rowToNum(from.row))) /
            (passLen * passLen)
        )
      );

      const projCol = from.col + t * (to.col - from.col);
      const projRow = rowToNum(from.row) + t * (rowToNum(to.row) - rowToNum(from.row));

      const dist = Math.sqrt(
        Math.pow(def.position.col - projCol, 2) +
          Math.pow(rowToNum(def.position.row) - projRow, 2)
      );

      if (dist < 1.2) {
        return { intercepted: true, interceptorId: def.id };
      }
    }

    return { intercepted: false, interceptorId: null };
  }

  static init(
    homeFormation?: keyof typeof FORMATIONS,
    awayFormation?: keyof typeof FORMATIONS
  ): Engine {
    return new Engine(initGameState(homeFormation, awayFormation));
  }

  static listFormations() {
    return listFormations();
  }
}

export { Engine as default };