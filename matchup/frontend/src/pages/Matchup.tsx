import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { GameState, Resolution, Move } from '../types';
import { GameLayout } from '@/components/layouts';
import Pitch from '@/components/Pitch';
import MoveSelector from '@/components/MoveSelector';
import ScoreBar from '@/components/ScoreBar';
import ResolutionOverlay from '@/components/ResolutionOverlay';
import { api } from '@/lib/api';
import { socket } from '@/lib/socket';
import { useAuthStore, useGameStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { normalizeColors, type TeamColors } from '@/lib/team-colors';

const MOVE_TIMER_SECONDS = 10;

const ATTACK_MOVES: Move[] = ['pass', 'long_ball', 'run', 'sprint', 'shoot'];
const DEFEND_MOVES: Move[] = ['hold_shape', 'press', 'tackle'];

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
    setOpponentCommitted 
  } = useGameStore();
  
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [moveLockedIn, setMoveLockedIn] = useState(false);
  const [playerSide, setPlayerSide] = useState<'p1' | 'p2'>('p1');
  const [moveTimer, setMoveTimer] = useState(MOVE_TIMER_SECONDS);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const hasConnected = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Team identity
  const yourTeam = session
    ? playerSide === 'p1'
      ? session.player1Side === 'home' ? session.homeTeam : session.awayTeam
      : session.player2Side === 'home' ? session.homeTeam : session.awayTeam
    : 'YOUR TEAM';
  const oppTeam = session
    ? playerSide === 'p1'
      ? session.player1Side === 'home' ? session.awayTeam : session.homeTeam
      : session.player2Side === 'home' ? session.awayTeam : session.homeTeam
    : 'OPPONENT';

  const yourColors: TeamColors = session?.homeTeamColors && session?.awayTeamColors
    ? (playerSide === 'p1'
        ? (session.player1Side === 'home' ? session.homeTeamColors : session.awayTeamColors)
        : (session.player2Side === 'home' ? session.homeTeamColors : session.awayTeamColors))
    : { primary: '#14532d', secondary: '#ffffff', text: '#ffffff' };
  const oppColors: TeamColors = session?.homeTeamColors && session?.awayTeamColors
    ? (playerSide === 'p1'
        ? (session.player1Side === 'home' ? session.awayTeamColors : session.homeTeamColors)
        : (session.player2Side === 'home' ? session.awayTeamColors : session.homeTeamColors))
    : { primary: '#111111', secondary: '#cccccc', text: '#ffffff' };
  const yourAbbr = session?.homeTeamAbbr && session?.awayTeamAbbr
    ? (playerSide === 'p1'
        ? (session.player1Side === 'home' ? session.homeTeamAbbr : session.awayTeamAbbr)
        : (session.player2Side === 'home' ? session.homeTeamAbbr : session.awayTeamAbbr))
    : 'YOU';
  const oppAbbr = session?.homeTeamAbbr && session?.awayTeamAbbr
    ? (playerSide === 'p1'
        ? (session.player1Side === 'home' ? session.awayTeamAbbr : session.homeTeamAbbr)
        : (session.player2Side === 'home' ? session.awayTeamAbbr : session.homeTeamAbbr))
    : 'OPP';

  // ─── Move timer ─────────────────────────────────────────────────────
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

  // Auto-commit random move when timer expires
  useEffect(() => {
    if (moveTimer === 0 && !moveLockedIn && !isCommitting && gameState) {
      const isAttacking = gameState.attackingPlayer === playerSide;
      const validMoves = isAttacking ? ATTACK_MOVES : DEFEND_MOVES;
      // Filter out shoot if not in final third
      const available = validMoves.filter((m) => {
        if (m === 'shoot' && isAttacking && gameState.ball.position.col < 7) return false;
        return true;
      });
      const randomMove = available[Math.floor(Math.random() * available.length)];
      setSelectedMove(randomMove);

      // Give a tiny delay so the UI shows which move was auto-selected
      setTimeout(() => {
        setIsCommitting(true);
        socket.commitMove(randomMove);
      }, 300);
    }
  }, [moveTimer, moveLockedIn, isCommitting, gameState, playerSide, setSelectedMove]);

  // Start timer on new turn, stop when locked in
  useEffect(() => {
    if (gameState && !moveLockedIn && !isCommitting && gameState.turnStatus !== 'resolving') {
      startTimer();
    } else {
      stopTimer();
    }
  }, [gameState?.turn, gameState?.phase, moveLockedIn, isCommitting, startTimer, stopTimer]);

  // Cleanup
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
        setPlayerSide('p1');
      } else {
        setPlayerSide('p2');
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
  }, [sessionId, token, navigate, setGameState, user]);

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

    socket.on('MOVE_COMMITTED', () => {
      setMoveLockedIn(true);
      setIsCommitting(false);
      stopTimer();
    });

    socket.on('TURN_RESOLVED', (payload: { resolution: Resolution; gameState: GameState }) => {
      // Stop any running timer and clear the interval to prevent double-counting
      stopTimer();
      setMoveTimer(MOVE_TIMER_SECONDS);

      setResolution(payload.resolution);
      setGameState(payload.gameState);
      setIsCommitting(false);
      setMoveLockedIn(false);
      setSelectedMove(null);
      setOpponentCommitted(false);

      // Set event description
      const r = payload.resolution;
      const isYourAction = r.scorer === playerSide || (!r.possessionChange && !r.goalScored);
      if (r.goalScored) {
        setLastEvent(r.scorer === playerSide ? `GOAL — ${yourAbbr} scored` : `GOAL — ${oppAbbr} scored`);
      } else if (r.outcome === 'tackle') {
        setLastEvent(isYourAction ? `TACKLE — ${oppAbbr} won the ball` : `TACKLE — ${yourAbbr} won the ball`);
      } else if (r.outcome === 'intercept') {
        setLastEvent(r.possessionChange ? `INTERCEPTED — Possession lost` : `ADVANCE — Ball moved forward`);
      } else if (r.outcome === 'advance') {
        setLastEvent(`ADVANCE — Ball moved forward`);
      } else if (r.outcome === 'save') {
        setLastEvent(`SAVE — Shot stopped`);
      } else if (r.outcome === 'miss') {
        setLastEvent(`MISS — Shot went wide`);
      }
    });

    socket.on('PHASE_TRANSITION', (payload: { newPhase: number; attackingPlayer: string; state: GameState }) => {
      setGameState(payload.state);
      const youAttacking = payload.attackingPlayer === playerSide;
      setLastEvent(`PHASE ${payload.newPhase} — ${youAttacking ? 'You are attacking' : 'You are defending'}`);
    });

    socket.on('MATCHUP_COMPLETE', (payload: { finalState: GameState }) => {
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
      setLastEvent('Bot substituted for disconnected opponent');
    });

    socket.on('CONNECTION_STATUS', (status) => {
      useGameStore.getState().setConnectionStatus(status);
      if (status === 'disconnected') {
        setLastEvent('Disconnected — reconnecting...');
      }
    });
  }, [sessionId, token, navigate, setGameState, setOpponentCommitted, setSelectedMove, playerSide, yourAbbr, oppAbbr, stopTimer]);

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

  const handleResolutionComplete = () => {
    setResolution(null);
  };

  if (loading || !gameState) {
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

  const isAttacking = gameState.attackingPlayer === playerSide;

  return (
    <GameLayout>
      <main className="flex flex-col md:flex-row h-full w-full">
        {/* Pitch section */}
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
            />
          </div>

          {/* Status bar with event feed */}
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

        {/* Move selector */}
        <MoveSelector
          selectedMove={selectedMove}
          onSelect={setSelectedMove}
          onCommit={handleCommit}
          disabled={isCommitting || moveLockedIn || gameState.turnStatus === 'resolving'}
          moveLockedIn={moveLockedIn}
          playerState={gameState.players[playerSide]}
          isAttacking={isAttacking}
          gameState={gameState}
          playerSide={playerSide}
          moveTimer={moveTimer}
          maxTimer={MOVE_TIMER_SECONDS}
          yourColors={yourColors}
        />

        {/* Resolution overlay */}
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
