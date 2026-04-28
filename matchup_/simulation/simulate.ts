import { Engine } from '../engine/index.js';
import { visualizeGame } from '../engine/render.js';
import type { GameState, Team, GridPosition, MoveResult, FormationName } from '../engine/types.js';
import { validateMove } from '../engine/moves.js';
import { ROWS, MAX_RUN_DIST } from '../engine/types.js';

// --- TYPES ---

export interface MoveOption {
  playerId: string;
  to: GridPosition;
}

export interface MatchEvent {
  moveNumber: number;
  time: number; // seconds remaining
  type: 'move' | 'pass' | 'tackle' | 'interception' | 'goal' | 'miss' | 'blocked';
  team: Team;
  description: string;
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
    const minCol = Math.max(1, player.position.col - MAX_RUN_DIST);
    const maxCol = Math.min(22, player.position.col + MAX_RUN_DIST);
    const minRowIdx = Math.max(0, ROWS.indexOf(player.position.row as any) - MAX_RUN_DIST);
    const maxRowIdx = Math.min(ROWS.length - 1, ROWS.indexOf(player.position.row as any) + MAX_RUN_DIST);

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
  state: GameState,
  team: Team,
  validMoves: MoveOption[],
  history: MatchEvent[]
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
    const lastEvent = history.length > 0 ? history[history.length - 1] : null;
    const weJustGotTackled = lastEvent?.type === 'tackle' && lastEvent.team !== team;
    
    const tackleMoves = validMoves.filter((m) => {
      if (weJustGotTackled) return false; // Don't immediately tackle back
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
    const events: MatchEvent[] = [];
    let moveCount = 0;

    if (this.config.verbose) {
      console.clear();
      console.log(visualizeGame(engine.getState()));
    }

    while (engine.getState().status === 'playing') {
      moveCount++;
      if (moveCount > (this.config.maxMoves || 1000)) break;

      const state = engine.getState();
      const possession = state.possession;
      const strategy = possession === 'home' ? this.config.homeStrategy : this.config.awayStrategy;
      
      const validMoves = getValidMoves(state, possession);
      if (validMoves.length === 0) break;

      const chosenMove = strategy(state, possession, validMoves, events);
      if (!chosenMove) break;

      const result: MoveResult = engine.applyMove(chosenMove.playerId, chosenMove.to);

      if (result.valid) {
        const player = state.players.find(p => p.id === chosenMove.playerId);
        let desc = '';
        
        switch (result.outcome) {
          case 'goal': desc = `⚽ GOAL! ${player?.name} scores!`; break;
          case 'tackled': desc = `🛡️ Tackle on ${player?.name}`; break;
          case 'intercepted': desc = `🤚 Pass by ${player?.name} intercepted`; break;
          case 'blocked': desc = `🚫 Shot by ${player?.name} blocked`; break;
          case 'miss': desc = `💨 Shot by ${player?.name} misses`; break;
          default: desc = `${player?.name} moves`;
        }

        events.push({
          moveNumber: moveCount,
          time: state.timeRemaining,
          type: result.outcome === 'success' ? 'move' 
             : result.outcome === 'intercepted' ? 'interception'
             : result.outcome === 'tackled' ? 'tackle'
             : result.outcome,
          team: possession,
          description: desc,
        });

        if (this.config.verbose) {
          console.log(`\n[${state.timeRemaining}s] ${desc}`);
          console.log(visualizeGame(result.newState));
        }
      }
    }

    const finalState = engine.getState();
    return {
      finalState,
      events,
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
        const mins = Math.floor((600 - g.time) / 60);
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