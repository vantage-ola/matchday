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
import { gridDistance, AP_COST } from './types.js';

const MOVE_TIME = 10; // seconds per move

export { listFormations, getFormation, FORMATIONS };

export class Engine {
  private state: GameState;

  constructor(state?: GameState) {
    this.state = state ? JSON.parse(JSON.stringify(state)) : initGameState();
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

      // Check interception against pre-move state
      const intercept = checkInterception(
        this.state,
        player.position,
        to,
        player.team
      );

      if (intercept.intercepted && intercept.interceptorId) {
        outcome = 'intercepted';
        possessionChange = true;
        mover.hasBall = false;
        const intPlayer = newState.players.find(
          (p) => p.id === intercept.interceptorId
        );
        if (intPlayer) intPlayer.hasBall = true;
        // Passer stays in place, interceptor stays in place, ball transfers
      } else if (targetPlayer) {
        // Clean pass — passer stays, receiver gets ball
        mover.hasBall = false;
        targetPlayer.hasBall = true;
      }

    } else if (moveType === 'tackle') {
      moveTypeLabel = 'tackle';
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
    // Goal: ball already given to conceding team above; just give them a fresh phase.
    if (scored) {
      newState.actionPoints = 3;
      newState.moveNumber = 1;
      newState.movePhase = 'attack';
    }
    // Possession change (tackle / interception / miss / block): flip to whichever team now holds the ball.
    else if (possessionChange) {
      const newCarrier = newState.players.find((p) => p.hasBall);
      newState.possession = newCarrier ? newCarrier.team : (newState.possession === 'home' ? 'away' : 'home');
      newState.actionPoints = 3;
      newState.moveNumber = 1;
      newState.movePhase = 'attack';
    }
    // Normal successful play: deduct AP, end phase if budget hits 0.
    else if (moveType === 'dribble' || moveType === 'pass' || moveType === 'run' || moveType === 'shoot') {
      const cost = AP_COST[moveType];
      newState.actionPoints = Math.max(0, newState.actionPoints - cost);

      if (newState.actionPoints <= 0) {
        newState.possession = newState.possession === 'home' ? 'away' : 'home';
        newState.actionPoints = 3;
        newState.moveNumber = 1;
        newState.movePhase = 'attack';
      } else {
        newState.moveNumber++;
      }
    }

    // ---- UPDATE TIME ----
    newState.timeRemaining = Math.max(0, newState.timeRemaining - MOVE_TIME);

    // ---- GAME END ----
    if (newState.timeRemaining <= 0) {
      newState.status = 'fullTime';
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

  endTurn(): GameState {
    if (this.state.status !== 'playing') return this.getState();
    const newState = JSON.parse(JSON.stringify(this.state)) as GameState;
    newState.possession = newState.possession === 'home' ? 'away' : 'home';
    newState.actionPoints = 3;
    newState.moveNumber = 1;
    newState.movePhase = 'attack';
    this.state = newState;
    return this.getState();
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