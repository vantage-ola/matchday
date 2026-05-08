import { Engine } from '../engine/index.js';
import { visualizeGame } from '../engine/render.js';
import type { GameState, Team, GridPosition, MoveResult, FormationName, MatchEvent } from '../engine/types.js';
import { validateMove, previewPass } from '../engine/moves.js';
import { ROWS, MAX_PASS_DIST, gridDistance } from '../engine/types.js';
import { GAME_DURATION } from '../engine/formations.js';

// --- TYPES ---

export type { MatchEvent } from '../engine/types.js';

export interface MoveOption {
  playerId: string;
  to: GridPosition;
}

export interface SimulationResult {
  finalState: GameState;
  events: MatchEvent[];
  score: { home: number; away: number };
  status: 'fullTime' | 'abandoned';
}

// Strategy now receives match history so it can avoid repeating mistakes (like re-tackling)
export type Strategy = (
  state: GameState,
  team: Team,
  validMoves: MoveOption[],
  history: MatchEvent[]
) => MoveOption | null;

// --- HELPERS ---

export function getValidMoves(state: GameState, team: Team): MoveOption[] {
  const moves: MoveOption[] = [];
  const teamPlayers = state.players.filter((p) => p.team === team);

  for (const player of teamPlayers) {
    const minCol = Math.max(1, player.position.col - MAX_PASS_DIST);
    const maxCol = Math.min(22, player.position.col + MAX_PASS_DIST);
    const minRowIdx = Math.max(0, ROWS.indexOf(player.position.row as any) - MAX_PASS_DIST);
    const maxRowIdx = Math.min(ROWS.length - 1, ROWS.indexOf(player.position.row as any) + MAX_PASS_DIST);

    for (let c = minCol; c <= maxCol; c++) {
      for (let r = minRowIdx; r <= maxRowIdx; r++) {
        const to: GridPosition = { col: c, row: ROWS[r] };
        if (validateMove(state, player.id, to).valid) {
          moves.push({ playerId: player.id, to });
        }
      }
    }
  }

  return moves;
}

// --- BUILT-IN STRATEGIES ---

export function randomStrategy(
  _state: GameState,
  _team: Team,
  validMoves: MoveOption[],
  _history: MatchEvent[]
): MoveOption | null {
  if (validMoves.length === 0) return null;
  return validMoves[Math.floor(Math.random() * validMoves.length)];
}

export function aggressiveStrategy(
  state: GameState,
  team: Team,
  validMoves: MoveOption[],
  history: MatchEvent[]
): MoveOption | null {
  if (validMoves.length === 0) return null;

  const ballCarrier = state.players.find((p) => p.hasBall && p.team === team);
  const dir = team === 'home' ? 1 : -1;

  const pickBest = (moves: MoveOption[], scoreFn: (m: MoveOption) => number, maximize: boolean) => {
    if (moves.length === 0) return null;
    const scored = moves.map(m => ({ m, score: scoreFn(m) }));
    scored.sort((a, b) => maximize ? b.score - a.score : a.score - b.score);
    const bestScore = scored[0].score;
    const topMoves = scored.filter(s => s.score === bestScore).map(s => s.m);
    return topMoves[Math.floor(Math.random() * topMoves.length)];
  };

  // OFFENSE
  if (ballCarrier) {
    // 1. Shoot if in range
    const targetGoalCol = team === 'home' ? 22 : 1;
    const shootMove = validMoves.find(
      (m) => m.playerId === ballCarrier.id && m.to.col === targetGoalCol
    );
    if (shootMove) return shootMove;

    // 2. Dribble forward
    const forwardMoves = validMoves.filter(
      (m) => m.playerId === ballCarrier.id && dir * (m.to.col - ballCarrier.position.col) > 0
    );
    const dribble = pickBest(forwardMoves, m => dir * m.to.col, true);
    if (dribble) return dribble;

    // 3. Pass forward
    const forwardPassMoves = validMoves.filter((m) => {
      if (m.playerId === ballCarrier.id) return false;
      const target = state.players.find((p) => p.id === m.playerId);
      return target && target.team === team && dir * (m.to.col - ballCarrier.position.col) > 0;
    });
    const fwdPass = pickBest(forwardPassMoves, m => dir * m.to.col, true);
    if (fwdPass) return fwdPass;

    // 4. Pass backward/sideways to relieve pressure
    const anyPassMoves = validMoves.filter((m) => {
      if (m.playerId === ballCarrier.id) return false;
      const target = state.players.find((p) => p.id === m.playerId);
      return target && target.team === team;
    });
    if (anyPassMoves.length > 0) {
      return anyPassMoves[Math.floor(Math.random() * anyPassMoves.length)];
    }

    // 5. Sideways dribble
    const sidewaysMoves = validMoves.filter(
      (m) => m.playerId === ballCarrier.id && m.to.col === ballCarrier.position.col
    );
    if (sidewaysMoves.length > 0) return sidewaysMoves[Math.floor(Math.random() * sidewaysMoves.length)];
  }

  // DEFENSE
  else {
    // Prevent infinite tackle ping-pong
      
    const tackleMoves = validMoves.filter((m) => {
      const target = state.players.find((p) => p.position.col === m.to.col && p.position.row === m.to.row);
      return target && target.hasBall && target.team !== team;
    });
    
    if (tackleMoves.length > 0) {
      return tackleMoves[Math.floor(Math.random() * tackleMoves.length)];
    }

    // Move defenders toward the ball
    const ballPos = state.ball;
    const defMoves = validMoves.filter((m) => {
      const player = state.players.find((p) => p.id === m.playerId);
      return player && (player.role === 'def' || player.role === 'mid');
    });
    
    const defenseMove = pickBest(defMoves, m => {
      const dist = Math.abs(m.to.col - ballPos.col) + Math.abs(ROWS.indexOf(m.to.row as any) - ROWS.indexOf(ballPos.row as any));
      return dist;
    }, false);
    
    if (defenseMove) return defenseMove;
  }

  return randomStrategy(state, team, validMoves, history);
}

// ── cautiousStrategy (Easy) ─────────────────────────────────────────
// Plays safe: prefers passes over dribbles, only shoots when very close,
// never attempts tackles on defense — just closes space.

export function cautiousStrategy(
  state: GameState,
  team: Team,
  validMoves: MoveOption[],
  history: MatchEvent[]
): MoveOption | null {
  if (validMoves.length === 0) return null;

  const ballCarrier = state.players.find((p) => p.hasBall && p.team === team);
  const dir = team === 'home' ? 1 : -1;

  if (ballCarrier) {
    // 1. Only shoot if within 3 cells of goal
    const targetGoalCol = team === 'home' ? 22 : 1;
    if (Math.abs(ballCarrier.position.col - targetGoalCol) <= 3) {
      const shootMove = validMoves.find(
        (m) => m.playerId === ballCarrier.id && m.to.col === targetGoalCol
      );
      if (shootMove) return shootMove;
    }

    // 2. Prefer passing to teammates (2:1 weighting over dribble)
    const passMoves = validMoves.filter((m) => {
      if (m.playerId !== ballCarrier.id) return false;
      const target = state.players.find(
        (p) => p.position.col === m.to.col && p.position.row === m.to.row
      );
      return target && target.team === team && target.id !== ballCarrier.id;
    });
    if (passMoves.length > 0 && Math.random() < 0.67) {
      // Prefer forward passes
      const fwdPasses = passMoves.filter((m) => dir * (m.to.col - ballCarrier.position.col) > 0);
      const pool = fwdPasses.length > 0 ? fwdPasses : passMoves;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // 3. Sideways or backward dribble (safe)
    const safeMoves = validMoves.filter(
      (m) => m.playerId === ballCarrier.id && dir * (m.to.col - ballCarrier.position.col) <= 0
    );
    if (safeMoves.length > 0 && Math.random() < 0.4) {
      return safeMoves[Math.floor(Math.random() * safeMoves.length)];
    }

    // 4. Any carrier move
    const carrierMoves = validMoves.filter((m) => m.playerId === ballCarrier.id);
    if (carrierMoves.length > 0) {
      return carrierMoves[Math.floor(Math.random() * carrierMoves.length)];
    }
  } else {
    // DEFENSE — never tackle, just move defenders toward ball
    const ballPos = state.ball;
    const nonTackleMoves = validMoves.filter((m) => {
      const target = state.players.find(
        (p) => p.position.col === m.to.col && p.position.row === m.to.row
      );
      return !target; // only empty cells — no tackles
    });

    if (nonTackleMoves.length > 0) {
      // Pick the move that gets closest to the ball
      nonTackleMoves.sort((a, b) => {
        const da = Math.abs(a.to.col - ballPos.col) + Math.abs(ROWS.indexOf(a.to.row as any) - ROWS.indexOf(ballPos.row as any));
        const db = Math.abs(b.to.col - ballPos.col) + Math.abs(ROWS.indexOf(b.to.row as any) - ROWS.indexOf(ballPos.row as any));
        return da - db;
      });
      return nonTackleMoves[0];
    }
  }

  return randomStrategy(state, team, validMoves, history);
}

// ── tacticalStrategy (Hard) ─────────────────────────────────────────
// Smart play: uses previewPass to pick clear lanes, only shoots when
// no blockers nearby, shadow-marks the carrier on defense.



export function tacticalStrategy(
  state: GameState,
  team: Team,
  validMoves: MoveOption[],
  history: MatchEvent[]
): MoveOption | null {
  if (validMoves.length === 0) return null;

  const ballCarrier = state.players.find((p) => p.hasBall && p.team === team);
  const dir = team === 'home' ? 1 : -1;

  if (ballCarrier) {
    const targetGoalCol = team === 'home' ? 22 : 1;

    // 1. Shoot only if on-target and no defenders within 2 cells of goal
    const shootMoves = validMoves.filter(
      (m) => m.playerId === ballCarrier.id && m.to.col === targetGoalCol
        && m.to.row >= 'e' && m.to.row <= 'g'
    );
    if (shootMoves.length > 0) {
      const bestShot = shootMoves.find((m) => {
        const nearDefenders = state.players.filter(
          (p) => p.team !== team && p.role !== 'gk'
            && gridDistance(p.position, m.to) < 2
        );
        return nearDefenders.length === 0;
      });
      if (bestShot) return bestShot;
    }

    // 2. Pass — prefer clear lanes (no interception risk)
    const passMoves = validMoves.filter((m) => {
      if (m.playerId !== ballCarrier.id) return false;
      const target = state.players.find(
        (p) => p.position.col === m.to.col && p.position.row === m.to.row
      );
      return target && target.team === team && target.id !== ballCarrier.id;
    });

    if (passMoves.length > 0) {
      // Score each pass by line risk
      const scoredPasses = passMoves.map((m) => {
        const preview = previewPass(state, ballCarrier.position, m.to, team);
        const forwardness = dir * (m.to.col - ballCarrier.position.col);
        let score = forwardness * 2;
        if (preview.lineRisk === 'clear') score += 10;
        else if (preview.lineRisk === 'risk') score += 3;
        else score -= 20; // blocked — avoid
        return { m, score };
      });
      scoredPasses.sort((a, b) => b.score - a.score);

      // Only pass if best option is at least 'risk' quality
      if (scoredPasses[0].score > 0) {
        return scoredPasses[0].m;
      }
    }

    // 3. Dribble forward if no good pass
    const fwdDribble = validMoves.filter(
      (m) => m.playerId === ballCarrier.id
        && dir * (m.to.col - ballCarrier.position.col) > 0
        && !state.players.some((p) => p.position.col === m.to.col && p.position.row === m.to.row)
    );
    if (fwdDribble.length > 0) {
      return fwdDribble[Math.floor(Math.random() * fwdDribble.length)];
    }

    // 4. Sideways or back as last resort
    const anyCarrier = validMoves.filter((m) => m.playerId === ballCarrier.id);
    if (anyCarrier.length > 0) {
      return anyCarrier[Math.floor(Math.random() * anyCarrier.length)];
    }
  } else {
    // DEFENSE — prioritize tackles, then shadow-mark

    // 1. Tackle the ball carrier if adjacent
    const tackleMoves = validMoves.filter((m) => {
      const target = state.players.find(
        (p) => p.position.col === m.to.col && p.position.row === m.to.row
      );
      return target && target.hasBall && target.team !== team;
    });
    if (tackleMoves.length > 0) {
      return tackleMoves[Math.floor(Math.random() * tackleMoves.length)];
    }

    // 2. Move closest defender toward the ball (pressure)
    const ballPos = state.ball;
    const defMoves = validMoves.filter((m) => {
      const player = state.players.find((p) => p.id === m.playerId);
      return player && (player.role === 'def' || player.role === 'mid');
    });

    // Also move a second player to cut the forward passing lane
    const oppCarrier = state.players.find((p) => p.hasBall && p.team !== team);

    if (defMoves.length > 0) {
      // Sort: closest to ball first
      defMoves.sort((a, b) => {
        const da = Math.abs(a.to.col - ballPos.col) + Math.abs(ROWS.indexOf(a.to.row as any) - ROWS.indexOf(ballPos.row as any));
        const db = Math.abs(b.to.col - ballPos.col) + Math.abs(ROWS.indexOf(b.to.row as any) - ROWS.indexOf(ballPos.row as any));
        return da - db;
      });

      // First choice: move closest defender toward ball
      const closestMove = defMoves[0];
      const closestPlayer = closestMove.playerId;

      // Shadow marking: if there's a second defender, move them to cut forward lane
      if (oppCarrier) {
        const shadowMoves = defMoves.filter(
          (m) => m.playerId !== closestPlayer
            && dir * (m.to.col - oppCarrier.position.col) < 0 // between carrier and our goal
        );
        // If shadow move is better positioned, use it instead sometimes
        if (shadowMoves.length > 0 && Math.random() < 0.3) {
          return shadowMoves[0];
        }
      }

      return closestMove;
    }
  }

  return randomStrategy(state, team, validMoves, history);
}

// --- SIMULATOR ---

export interface SimulatorConfig {
  homeFormation: FormationName;
  awayFormation: FormationName;
  homeStrategy: Strategy;
  awayStrategy: Strategy;
  verbose: boolean;
  maxMoves?: number;
}

export class Simulator {
  private config: SimulatorConfig;

  constructor(config?: Partial<SimulatorConfig>) {
    this.config = {
      homeFormation: '4-3-3',
      awayFormation: '4-3-3',
      homeStrategy: aggressiveStrategy,
      awayStrategy: aggressiveStrategy,
      verbose: false,
      maxMoves: 1000,
      ...config,
    };
  }

  run(): SimulationResult {
    const engine = Engine.init(this.config.homeFormation, this.config.awayFormation);
    let moveCount = 0;

    if (this.config.verbose) {
      console.clear();
      console.log(visualizeGame(engine.getState()));
    }

    while (engine.getState().status === 'playing' || engine.getState().status === 'halfTime') {
      moveCount++;
      if (moveCount > (this.config.maxMoves || 1000)) break;

      // Auto-resume from half-time in simulation (no UI tap available).
      if (engine.getState().status === 'halfTime') {
        engine.resumeFromHalfTime();
        continue;
      }

      const state = engine.getState();
      const possession = state.possession;
      const strategy = possession === 'home' ? this.config.homeStrategy : this.config.awayStrategy;

      const validMoves = getValidMoves(state, possession);
      if (validMoves.length === 0) break;

      const chosenMove = strategy(state, possession, validMoves, state.events);
      if (!chosenMove) break;

      const result: MoveResult = engine.applyMove(chosenMove.playerId, chosenMove.to);

      if (result.valid && this.config.verbose) {
        const latest = result.newState.events[result.newState.events.length - 1];
        if (latest) {
          console.log(`\n[${result.newState.timeRemaining}s] ${latest.description}`);
          console.log(visualizeGame(result.newState));
        }
      }
    }

    const finalState = engine.getState();
    return {
      finalState,
      events: finalState.events,
      score: finalState.score,
      status: finalState.status === 'fullTime' ? 'fullTime' : 'abandoned',
    };
  }

  printReport(result: SimulationResult) {
    console.log('\n====================================================');
    console.log('                  MATCH REPORT                   ');
    console.log('====================================================');
    console.log(`   ${this.config.homeFormation}  ${result.score.home} - ${result.score.away}  ${this.config.awayFormation}`);
    console.log(`   Status: ${result.status.toUpperCase()}`);
    console.log('----------------------------------------------------');

    const goals = result.events.filter(e => e.type === 'goal');
    if (goals.length === 0) {
      console.log('   No goals.');
    } else {
      for (const g of goals) {
        const mins = Math.floor((GAME_DURATION - g.time) / 60);
        console.log(`   ${mins}'  ${g.team.toUpperCase()} - ${g.description}`);
      }
    }

    const tackles = result.events.filter(e => e.type === 'tackle').length;
    const interceptions = result.events.filter(e => e.type === 'interception').length;
    console.log('----------------------------------------------------');
    console.log(`   Total Moves: ${result.events.length}`);
    console.log(`   Tackles: ${tackles} | Interceptions: ${interceptions}`);
    console.log('====================================================\n');
  }
}