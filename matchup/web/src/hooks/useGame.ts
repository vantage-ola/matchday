import { useState, useRef, useCallback } from 'react';
import {
  Engine,
  type GameState,
  type GridPosition,
  type MoveResult,
  type FormationName,
  type MoveOption,
  type GameMode,
  type GamePhase,
  getValidMoves,
  aggressiveStrategy,
  cautiousStrategy,
  tacticalStrategy,
  posToString,
} from '@/lib/engine';
import { play } from '@/lib/sfx';
import { loadSettings } from '@/lib/settings';
import { saveMatch, clearSave, loadSavedMatch, addMatchToHistory, updateProfile, type MatchSave } from '@/lib/storage';

const AI_MOVE_DELAY = 700;
const BALL_HISTORY_LIMIT = 3;

export function useGame() {
  const engineRef = useRef<Engine | null>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<GamePhase>('menu');
  const [mode, setMode] = useState<GameMode>('local');
  const [state, setState] = useState<GameState | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<MoveOption[]>([]);
  const [selectedPlayerMoves, setSelectedPlayerMoves] = useState<Set<string>>(new Set());
  const [lastMoveResult, setLastMoveResult] = useState<MoveResult | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [ballHistory, setBallHistory] = useState<GridPosition[]>([]);
  const formationsRef = useRef<{ home: FormationName; away: FormationName }>({ home: '4-3-3', away: '4-3-3' });

  const playOutcomeSfx = useCallback((result: MoveResult) => {
    if (!result.valid) return;
    switch (result.outcome) {
      case 'goal':         play('goal'); break;
      case 'miss':         play('kick'); break;
      case 'intercepted':  play('blip'); break;
      case 'blocked':      play('blip'); break;
      case 'tackled':      play('tackle'); break;
      case 'tackleFailed': play('tackleFail'); break;
      case 'success':
        if (result.move?.type === 'pass') play('pass');
        else if (result.move?.type === 'shoot') play('kick');
        break;
    }
  }, []);

  const recordBallHistory = useCallback((result: MoveResult, prevBall: GridPosition | null) => {
    if (!result.valid) return;
    if (result.outcome === 'goal') {
      setBallHistory([]);
      return;
    }
    if (!prevBall) return;
    setBallHistory((prev) => {
      const next = [...prev, prevBall];
      if (next.length > BALL_HISTORY_LIMIT) next.shift();
      return next;
    });
  }, []);

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

  const doSave = useCallback(() => {
    if (!engineRef.current) return;
    const s = engineRef.current.getState();
    const save: MatchSave = {
      matchId: s.matchId,
      state: s,
      mode,
      homeFormation: formationsRef.current.home,
      awayFormation: formationsRef.current.away,
      difficulty: loadSettings().difficulty,
      savedAt: Date.now(),
    };
    saveMatch(save);
  }, [mode]);

  const checkGameOver = useCallback((s: GameState) => {
    if (s.status === 'fullTime') {
      play('whistle');
      clearSave();
      // Record to history + profile async
      const result = s.score.home > s.score.away ? 'win' as const
        : s.score.away > s.score.home ? 'loss' as const
        : 'draw' as const;
      void addMatchToHistory({
        matchId: s.matchId,
        homeFormation: formationsRef.current.home,
        awayFormation: formationsRef.current.away,
        mode,
        score: { ...s.score },
        result,
        events: s.events,
        seed: s.seed,
        playedAt: Date.now(),
      });
      void updateProfile({
        matchId: s.matchId,
        homeFormation: formationsRef.current.home,
        awayFormation: formationsRef.current.away,
        mode,
        score: { ...s.score },
        result,
        events: s.events,
        seed: s.seed,
        playedAt: Date.now(),
      });
      setPhase('fullTime');
      return true;
    }
    if (s.status === 'halfTime') {
      play('whistle');
    }
    return false;
  }, [mode]);

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

      const settings = loadSettings();
      const strategy =
        settings.difficulty === 'easy' ? cautiousStrategy
        : settings.difficulty === 'hard' ? tacticalStrategy
        : aggressiveStrategy;

      const chosen = strategy(s, 'away', moves, s.events);
      if (!chosen) {
        setIsAiThinking(false);
        syncState();
        return;
      }

      const prevBall = s.ball;
      const result = engine.applyMove(chosen.playerId, chosen.to);
      if (result.valid) {
        playOutcomeSfx(result);
        recordBallHistory(result, prevBall);
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
  }, [syncState, checkGameOver, recordBallHistory, playOutcomeSfx]);

  const startGame = useCallback((gameMode: GameMode, homeFormation: FormationName, awayFormation: FormationName) => {
    clearSave();
    const { matchLength } = loadSettings();
    const engine = Engine.init(homeFormation, awayFormation, undefined, { matchLength });
    engineRef.current = engine;
    formationsRef.current = { home: homeFormation, away: awayFormation };
    setMode(gameMode);
    setLastMoveResult(null);
    setIsAiThinking(false);
    setBallHistory([]);
    syncState();
    setPhase('playing');
  }, [syncState]);

  const continueMatch = useCallback(() => {
    const save = loadSavedMatch();
    if (!save) return;
    const restoredState = { ...save.state, matchLength: save.state.matchLength ?? 5400 };
    const engine = new Engine(restoredState);
    engineRef.current = engine;
    formationsRef.current = { home: save.homeFormation, away: save.awayFormation };
    setMode(save.mode);
    setLastMoveResult(null);
    setIsAiThinking(false);
    setBallHistory([]);
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

    const prevBall = state.ball;
    const result = engineRef.current.applyMove(playerId, to);
    if (!result.valid) return;

    playOutcomeSfx(result);
    recordBallHistory(result, prevBall);
    setLastMoveResult(result);
    const newState = syncState();
    if (!newState) return;

    if (checkGameOver(newState)) return;

    doSave();

    if (mode === 'ai' && newState.possession === 'away' && newState.status === 'playing') {
      playAiTurn();
    }
  }, [state, isAiThinking, mode, syncState, checkGameOver, playAiTurn, recordBallHistory]);

  const deselectPlayer = useCallback(() => {
    setSelectedPlayerId(null);
    setSelectedPlayerMoves(new Set());
  }, []);

  const resumeFromHalfTime = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.resumeFromHalfTime();
    setBallHistory([]);
    const newState = syncState();
    if (!newState) return;
    if (mode === 'ai' && newState.possession === 'away' && newState.status === 'playing') {
      playAiTurn();
    }
  }, [mode, syncState, playAiTurn]);

  const resetGame = useCallback(() => {
    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
    engineRef.current = null;
    setState(null);
    setSelectedPlayerId(null);
    setValidMoves([]);
    setSelectedPlayerMoves(new Set());
    setLastMoveResult(null);
    setIsAiThinking(false);
    setBallHistory([]);
    setPhase('menu');
    setMode('local');
  }, []);

  const goToSetup = useCallback(() => setPhase('setup'), []);
  const goToMenu = useCallback(() => {
    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
    setPhase('menu');
  }, []);
  const goToTutorial = useCallback(() => setPhase('tutorial'), []);

  return {
    phase,
    mode,
    state,
    selectedPlayerId,
    validMoves,
    selectedPlayerMoves,
    lastMoveResult,
    isAiThinking,
    ballHistory,
    startGame,
    selectPlayer,
    executeMove,
    deselectPlayer,
    resumeFromHalfTime,
    resetGame,
    goToSetup,
    goToMenu,
    goToTutorial,
    continueMatch,
  };
}
