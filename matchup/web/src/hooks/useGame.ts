import { useState, useRef, useCallback } from 'react';
import {
  Engine,
  type GameState,
  type GridPosition,
  type Team,
  type MoveResult,
  type FormationName,
  type MoveOption,
  type MatchEvent,
  type GameMode,
  type GamePhase,
  getValidMoves,
  aggressiveStrategy,
  posToString,
} from '@/lib/engine';

const AI_MOVE_DELAY = 700;

export function useGame() {
  const engineRef = useRef<Engine | null>(null);
  const eventsRef = useRef<MatchEvent[]>([]);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<GamePhase>('setup');
  const [mode, setMode] = useState<GameMode>('local');
  const [state, setState] = useState<GameState | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<MoveOption[]>([]);
  const [selectedPlayerMoves, setSelectedPlayerMoves] = useState<Set<string>>(new Set());
  const [lastMoveResult, setLastMoveResult] = useState<MoveResult | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);

  const syncState = useCallback(() => {
    if (!engineRef.current) return;
    const s = engineRef.current.getState();
    setState(s);
    const moves = getValidMoves(s, s.possession);
    setValidMoves(moves);
    setSelectedPlayerId(null);
    setSelectedPlayerMoves(new Set());
    return s;
  }, []);

  const checkGameOver = useCallback((s: GameState) => {
    if (s.status === 'fullTime') {
      setPhase('fullTime');
      return true;
    }
    return false;
  }, []);

  const playAiTurn = useCallback(() => {
    setIsAiThinking(true);

    const step = () => {
      const engine = engineRef.current;
      if (!engine) return;

      const s = engine.getState();
      if (s.status !== 'playing' || s.possession !== 'away') {
        setIsAiThinking(false);
        const fresh = syncState();
        if (fresh) checkGameOver(fresh);
        return;
      }

      const moves = getValidMoves(s, 'away');
      if (moves.length === 0) {
        setIsAiThinking(false);
        syncState();
        return;
      }

      const chosen = aggressiveStrategy(s, 'away', moves, eventsRef.current);
      if (!chosen) {
        setIsAiThinking(false);
        syncState();
        return;
      }

      const result = engine.applyMove(chosen.playerId, chosen.to);
      if (result.valid) {
        const player = s.players.find(p => p.id === chosen.playerId);
        eventsRef.current.push({
          moveNumber: eventsRef.current.length + 1,
          time: s.timeRemaining,
          type: result.outcome === 'success' ? 'move'
            : result.outcome === 'intercepted' ? 'interception'
            : result.outcome === 'tackled' ? 'tackle'
            : result.outcome,
          team: 'away',
          description: `AI: ${player?.name ?? chosen.playerId} ${result.outcome}`,
        });
        setLastMoveResult(result);
        setState(engine.getState());

        const newState = engine.getState();
        if (checkGameOver(newState)) return;

        if (newState.possession === 'away' && newState.status === 'playing') {
          aiTimerRef.current = setTimeout(step, AI_MOVE_DELAY);
        } else {
          setIsAiThinking(false);
          syncState();
        }
      } else {
        setIsAiThinking(false);
        syncState();
      }
    };

    aiTimerRef.current = setTimeout(step, AI_MOVE_DELAY);
  }, [syncState, checkGameOver]);

  const startGame = useCallback((gameMode: GameMode, homeFormation: FormationName, awayFormation: FormationName) => {
    const engine = Engine.init(homeFormation, awayFormation);
    engineRef.current = engine;
    eventsRef.current = [];
    setMode(gameMode);
    setLastMoveResult(null);
    setIsAiThinking(false);
    syncState();
    setPhase('playing');
  }, [syncState]);

  const selectPlayer = useCallback((playerId: string) => {
    if (!state || isAiThinking) return;
    const player = state.players.find(p => p.id === playerId);
    if (!player || player.team !== state.possession) return;

    setSelectedPlayerId(playerId);
    const playerMoves = validMoves.filter(m => m.playerId === playerId);
    setSelectedPlayerMoves(new Set(playerMoves.map(m => posToString(m.to))));
  }, [state, validMoves, isAiThinking]);

  const executeMove = useCallback((playerId: string, to: GridPosition) => {
    if (!engineRef.current || !state || isAiThinking) return;

    const result = engineRef.current.applyMove(playerId, to);
    if (!result.valid) return;

    const player = state.players.find(p => p.id === playerId);
    eventsRef.current.push({
      moveNumber: eventsRef.current.length + 1,
      time: state.timeRemaining,
      type: result.outcome === 'success' ? 'move'
        : result.outcome === 'intercepted' ? 'interception'
        : result.outcome === 'tackled' ? 'tackle'
        : result.outcome,
      team: state.possession,
      description: `${player?.name ?? playerId} ${result.outcome}`,
    });

    setLastMoveResult(result);
    const newState = syncState();
    if (!newState) return;

    if (checkGameOver(newState)) return;

    if (mode === 'ai' && newState.possession === 'away' && newState.status === 'playing') {
      playAiTurn();
    }
  }, [state, isAiThinking, mode, syncState, checkGameOver, playAiTurn]);

  const deselectPlayer = useCallback(() => {
    setSelectedPlayerId(null);
    setSelectedPlayerMoves(new Set());
  }, []);

  const endTurn = useCallback(() => {
    if (!engineRef.current || !state || isAiThinking) return;
    if (state.possession !== 'home' && mode === 'ai') return;
    engineRef.current.endTurn();
    const newState = syncState();
    if (!newState) return;
    if (checkGameOver(newState)) return;
    if (mode === 'ai' && newState.possession === 'away' && newState.status === 'playing') {
      playAiTurn();
    }
  }, [state, isAiThinking, mode, syncState, checkGameOver, playAiTurn]);

  const resetGame = useCallback(() => {
    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
    engineRef.current = null;
    eventsRef.current = [];
    setState(null);
    setSelectedPlayerId(null);
    setValidMoves([]);
    setSelectedPlayerMoves(new Set());
    setLastMoveResult(null);
    setIsAiThinking(false);
    setPhase('setup');
    setMode('local');
  }, []);

  return {
    phase,
    mode,
    state,
    selectedPlayerId,
    validMoves,
    selectedPlayerMoves,
    lastMoveResult,
    isAiThinking,
    startGame,
    selectPlayer,
    executeMove,
    deselectPlayer,
    endTurn,
    resetGame,
  };
}
