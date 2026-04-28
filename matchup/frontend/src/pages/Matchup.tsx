import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { GameState, PlayerSide, GameMove, SpatialResolution } from '../types';
import { GameLayout } from '@/components/layouts';
import Pitch from '@/components/Pitch';
import MoveSelector from '@/components/MoveSelector';
import ScoreBar from '@/components/ScoreBar';
import ResolutionOverlay from '@/components/ResolutionOverlay';
import { api } from '@/lib/api';
import { socket } from '@/lib/socket';
import { useAuthStore, useGameStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { type TeamColors } from '@/lib/team-colors';
import { resolveCapName, PHASE_NAMES } from '@/lib/game-utils';

const MOVE_TIMER_SECONDS = 10;

interface SessionData {
  id: string;
  fixtureId: string;
  player1Id: string;
  player2Id: string | null;
  player1Side: string;
  player2Side: string;
  stakePerPlayer: number;
  pot: number;
  gameMode: string;
  status: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeTeamColors?: TeamColors;
  awayTeamColors?: TeamColors;
  league?: string;
  homeTeamApiId?: number;
  awayTeamApiId?: number;
}

export default function Matchup() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const { 
    gameState, 
    setGameState, 
    selectedMove, 
    setSelectedMove, 
    opponentCommitted, 
    setOpponentCommitted,
    playerSide,
    setPlayerSide,
  } = useGameStore();
  
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [resolution, setResolution] = useState<SpatialResolution | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [moveLockedIn, setMoveLockedIn] = useState(false);
  const [moveTimer, setMoveTimer] = useState(MOVE_TIMER_SECONDS);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const hasConnected = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const yourColors: TeamColors = session?.homeTeamColors && session?.awayTeamColors
    ? (playerSide === 'home' ? session.homeTeamColors : session.awayTeamColors)
    : { primary: '#2563eb', secondary: '#ffffff', text: '#ffffff' };
  const oppColors: TeamColors = session?.homeTeamColors && session?.awayTeamColors
    ? (playerSide === 'home' ? session.awayTeamColors : session.homeTeamColors)
    : { primary: '#dc2626', secondary: '#ffffff', text: '#ffffff' };
  const yourAbbr = playerSide === 'home'
    ? (session?.homeTeamAbbr || 'YOU')
    : (session?.awayTeamAbbr || 'YOU');
  const oppAbbr = playerSide === 'home'
    ? (session?.awayTeamAbbr || 'OPP')
    : (session?.homeTeamAbbr || 'OPP');

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setMoveTimer(MOVE_TIMER_SECONDS);

    timerRef.current = setInterval(() => {
      setMoveTimer((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (moveTimer === 0 && !moveLockedIn && !isCommitting && gameState && playerSide) {
      const isAttacking = gameState.attackingSide === playerSide;

      if (isAttacking) {
        const ballCarrier = gameState.ball.carrierCapId;
        if (ballCarrier) {
          const forward = playerSide === 'home' ? 1 : -1;
          const fromPos = gameState.ball.position;
          const toPos = {
            col: Math.max(0, Math.min(14, fromPos.col + 2 * forward)),
            row: fromPos.row,
          };

          const move: GameMove = {
            side: 'attacker',
            fromCapId: ballCarrier,
            toPosition: toPos,
            action: 'run',
          };

          setSelectedMove(move);
          setTimeout(() => {
            setIsCommitting(true);
            socket.commitMove(move);
          }, 300);
        }
      } else {
        // Defender auto-submit: hold_shape with a defender
        const yourFormation = playerSide === 'home' ? gameState.formations.home : gameState.formations.away;
        const defender = yourFormation.caps.find(c => c.role === 'def') || yourFormation.caps[0];
        if (defender) {
          const move: GameMove = {
            side: 'defender',
            fromCapId: defender.id,
            toPosition: defender.position,
            action: 'hold_shape',
          };

          setSelectedMove(move);
          setTimeout(() => {
            setIsCommitting(true);
            socket.commitMove(move);
          }, 300);
        }
      }
    }
  }, [moveTimer, moveLockedIn, isCommitting, gameState, playerSide, setSelectedMove]);

  useEffect(() => {
    if (gameState && !moveLockedIn && !isCommitting && gameState.turnStatus !== 'resolving') {
      startTimer();
    } else {
      stopTimer();
    }
  }, [gameState?.turn, gameState?.phase, moveLockedIn, isCommitting, startTimer, stopTimer]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const fetchSession = useCallback(async () => {
    if (!sessionId || !token) return;
    
    try {
      const data = await api.getSession(sessionId, token);
      setSession(data.session as SessionData);
      
      const sessionData = data.session as SessionData;
      if (user && sessionData.player1Id === user.id) {
        setPlayerSide(sessionData.player1Side as PlayerSide);
      } else if (user && sessionData.player2Id === user.id) {
        setPlayerSide(sessionData.player2Side as PlayerSide);
      }
      
      if (data.gameState) {
        setGameState(data.gameState as GameState);
      }
    } catch {
      toast.error('Failed to load session');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [sessionId, token, navigate, setGameState, setPlayerSide, user]);

  const connectWebSocket = useCallback(() => {
    if (!sessionId || !token || hasConnected.current) return;
    hasConnected.current = true;

    socket.connect(sessionId, token);

    socket.on('GAME_STATE', (payload: GameState) => {
      setGameState(payload);
    });

    socket.on('OPPONENT_COMMITTED', () => {
      setOpponentCommitted(true);
    });

    socket.on('MOVE_COMMITTED', (_payload: { playerSide: PlayerSide; turnStatus: string }) => {
      setMoveLockedIn(true);
      setIsCommitting(false);
      stopTimer();
    });

    socket.on('TURN_RESOLVED', (payload: { resolution: SpatialResolution; gameState: GameState }) => {
      stopTimer();
      setMoveTimer(MOVE_TIMER_SECONDS);
      setResolution(payload.resolution);
      setGameState(payload.gameState);
      setIsCommitting(false);
      setMoveLockedIn(false);
      setSelectedMove(null);
      setOpponentCommitted(false);

      const r = payload.resolution;
      if (r.goalScored) {
        setLastEvent(`GOAL — ${r.scorerCapId} scored!`);
      } else if (r.outcome === 'tackle') {
        setLastEvent(`TACKLE — Ball won`);
      } else if (r.outcome === 'intercept') {
        setLastEvent(r.possessionChange ? `INTERCEPTED — Possession lost` : `ADVANCE`);
      } else if (r.outcome === 'through') {
        setLastEvent(`THROUGH PASS — Ball moved forward`);
      } else if (r.outcome === 'press_won') {
        setLastEvent(`PRESS — Won the ball`);
      } else if (r.outcome === 'goal') {
        setLastEvent(`GOAL!`);
      } else if (r.outcome === 'save') {
        setLastEvent(`SAVE — Shot stopped`);
      } else if (r.outcome === 'miss') {
        setLastEvent(`MISS — Shot wide`);
      } else if (r.outcome === 'blocked') {
        setLastEvent(`BLOCKED — Shot blocked`);
      } else if (r.outcome === 'wide') {
        setLastEvent(`WIDE — Missed`);
      } else {
        setLastEvent(`ADVANCE`);
      }
    });

    socket.on('PHASE_TRANSITION', (payload: { newPhase: number; attackingSide: PlayerSide; state: GameState }) => {
      setGameState(payload.state);
      const youAttacking = payload.attackingSide === playerSide;
      setLastEvent(`PHASE ${payload.newPhase} — ${youAttacking ? 'You attack' : 'You defend'}`);
    });

    socket.on('MATCHUP_COMPLETE', (payload: { finalState: GameState; result: { homeGoals: number; awayGoals: number } }) => {
      setGameState(payload.finalState);
      stopTimer();
      setTimeout(() => {
        navigate(`/settlement/${sessionId}`);
      }, 2000);
    });

    socket.on('MATCHUP_ABANDONED', () => {
      toast.error('Match abandoned');
      navigate('/');
    });

    socket.on('OPPONENT_DISCONNECTED', (payload: { reconnectWindowSeconds: number }) => {
      setLastEvent(`Opponent disconnected — waiting ${payload.reconnectWindowSeconds}s`);
    });

    socket.on('BOT_SUBSTITUTED', () => {
      setLastEvent('Bot substituted for opponent');
    });

    socket.on('CONNECTION_STATUS', (status) => {
      useGameStore.getState().setConnectionStatus(status);
      if (status === 'disconnected') {
        setLastEvent('Disconnected — reconnecting...');
      }
    });
  }, [sessionId, token, navigate, setGameState, setOpponentCommitted, setSelectedMove, playerSide, stopTimer, setLastEvent]);

  useEffect(() => {
    if (sessionId && token) {
      fetchSession();
    }
    return () => {
      socket.disconnect();
      hasConnected.current = false;
    };
  }, [sessionId, token, fetchSession]);

  useEffect(() => {
    if (session && token) {
      connectWebSocket();
    }
  }, [session, token, connectWebSocket]);

  const handleCommit = async () => {
    if (!selectedMove || isCommitting) return;

    setIsCommitting(true);
    stopTimer();

    try {
      socket.commitMove(selectedMove);
    } catch {
      toast.error('Failed to commit move');
      setIsCommitting(false);
    }
  };

  const handleResolutionComplete = useCallback(() => {
    setResolution(null);
  }, []);

  const handleMoveSelect = useCallback((move: GameMove) => {
    setSelectedMove(move);
  }, [setSelectedMove]);

  if (loading || !gameState || !playerSide) {
    return (
      <GameLayout>
        <main className="flex flex-col md:flex-row h-full w-full">
          <section className="w-full md:w-[70%] h-[60%] md:h-full flex flex-col border-b md:border-b-0 md:border-r border-outline-variant/20 bg-surface">
            <div className="h-14 bg-surface-container-low border-b border-outline-variant/20 flex items-center px-4">
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="flex-1 p-4 bg-surface flex items-center justify-center">
              <Skeleton className="h-64 w-full max-w-md" />
            </div>
          </section>
          <section className="w-full md:w-[30%] h-[40%] md:h-full flex flex-col p-4 bg-background">
            <Skeleton className="h-4 w-24 mb-4" />
            <div className="flex flex-col gap-2 flex-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
            <Skeleton className="h-12 w-full mt-4" />
          </section>
        </main>
      </GameLayout>
    );
  }

  return (
    <GameLayout>
      <main className="flex flex-col md:flex-row h-full w-full">
        <section className="w-full md:w-[70%] h-[55%] md:h-full flex flex-col bg-surface">
          <ScoreBar
            gameState={gameState}
            playerSide={playerSide}
            homeTeam={session?.homeTeam || "HOME"}
            awayTeam={session?.awayTeam || "AWAY"}
            league={session?.league}
            yourColors={yourColors}
            oppColors={oppColors}
            yourAbbr={yourAbbr}
            oppAbbr={oppAbbr}
          />

          <div className="flex-1 bg-surface">
            <Pitch
              gameState={gameState}
              playerSide={playerSide}
              yourColors={yourColors}
              oppColors={oppColors}
              yourAbbr={yourAbbr}
              oppAbbr={oppAbbr}
              selectedMove={selectedMove}
              onMoveSelect={handleMoveSelect}
              disabled={!!resolution || gameState.turnStatus === 'resolving'}
            />
          </div>

          <div className="h-10 md:h-11 bg-surface-container-lowest/80 backdrop-blur-sm hairline-t flex items-center justify-between px-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {lastEvent ? (
                <span className="text-[11px] font-semibold text-foreground truncate animate-in fade-in duration-300">
                  {lastEvent}
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${opponentCommitted ? 'bg-tertiary-fixed' : 'bg-muted/40'}`} />
                  <span className="text-[11px] font-semibold text-muted">
                    {opponentCommitted ? 'Opponent committed' : 'Waiting for moves...'}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <span className="text-[10px] font-semibold text-muted">
                T{gameState.turn}/{gameState.movesPerPhase}
              </span>
              <span className="text-[10px] text-muted">·</span>
              <span className="text-[10px] font-semibold text-muted">
                P{gameState.phase}/{gameState.totalPhases}
              </span>
            </div>
          </div>
        </section>

        <MoveSelector
          selectedMove={selectedMove}
          onSelect={handleMoveSelect}
          onCommit={handleCommit}
          disabled={isCommitting || moveLockedIn || gameState.turnStatus === 'resolving'}
          moveLockedIn={moveLockedIn}
          gameState={gameState}
          playerSide={playerSide}
          moveTimer={moveTimer}
          maxTimer={MOVE_TIMER_SECONDS}
          yourColors={yourColors}
        />

        {resolution && (
          <ResolutionOverlay
            resolution={resolution}
            playerSide={playerSide}
            onComplete={handleResolutionComplete}
          />
        )}
      </main>
    </GameLayout>
  );
}