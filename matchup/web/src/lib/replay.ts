/**
 * Replay controller — replays a completed match by re-applying moves
 * from the event log onto a fresh engine instance.
 *
 * The engine is deterministic: same seed + same moves = exact reproduction.
 */

import { Engine, type GameState, type FormationName, type MatchEvent } from './engine';

export interface ReplayState {
  gameState: GameState;
  eventIndex: number;
  totalEvents: number;
}

export class ReplayController {
  private engine: Engine;
  private moves: { playerId: string; to: { col: number; row: string } }[];
  private homeFormation: FormationName;
  private awayFormation: FormationName;
  private seed: number;
  private _eventIndex: number = 0;

  constructor(
    homeFormation: FormationName,
    awayFormation: FormationName,
    seed: number,
    events: MatchEvent[],
  ) {
    this.homeFormation = homeFormation;
    this.awayFormation = awayFormation;
    this.seed = seed;

    // Extract moves from events (each event with playerId + to is a move)
    this.moves = events
      .filter((e) => e.playerId && e.to)
      .map((e) => ({ playerId: e.playerId!, to: e.to! }));

    // Seed-based RNG for determinism
    this.engine = this.freshEngine();
  }

  private freshEngine(): Engine {
    let s = this.seed;
    const rng = () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
    return Engine.init(this.homeFormation, this.awayFormation, rng);
  }

  get totalMoves(): number {
    return this.moves.length;
  }

  get eventIndex(): number {
    return this._eventIndex;
  }

  getState(): ReplayState {
    return {
      gameState: this.engine.getState(),
      eventIndex: this._eventIndex,
      totalEvents: this.moves.length,
    };
  }

  stepForward(): ReplayState | null {
    if (this._eventIndex >= this.moves.length) return null;
    const move = this.moves[this._eventIndex];

    const state = this.engine.getState();
    // Auto-resume from half time if needed
    if (state.status === 'halfTime') {
      this.engine.resumeFromHalfTime();
    }

    this.engine.applyMove(move.playerId, move.to );
    this._eventIndex++;
    return this.getState();
  }

  stepBackward(): ReplayState | null {
    if (this._eventIndex <= 0) return null;
    // Re-run from scratch to index - 1
    return this.seekTo(this._eventIndex - 1);
  }

  seekTo(index: number): ReplayState {
    const target = Math.max(0, Math.min(index, this.moves.length));
    this.engine = this.freshEngine();
    this._eventIndex = 0;

    for (let i = 0; i < target; i++) {
      const state = this.engine.getState();
      if (state.status === 'halfTime') {
        this.engine.resumeFromHalfTime();
      }
      if (state.status === 'fullTime') break;
      this.engine.applyMove(this.moves[i].playerId, this.moves[i].to);
      this._eventIndex++;
    }

    return this.getState();
  }

  reset(): ReplayState {
    return this.seekTo(0);
  }
}
