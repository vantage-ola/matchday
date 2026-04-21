import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { GameState, Resolution, Move } from '../types';
import { GameLayout } from '@/components/layouts';
import Pitch from '@/components/Pitch';
import MoveSelector from '@/components/MoveSelector';
import ScoreBar from '@/components/ScoreBar';
import ResolutionOverlay from '@/components/ResolutionOverlay';

const createInitialState = (sessionId: string): GameState => ({
  sessionId,
  phase: 1,
  totalPhases: 6,
  turn: 1,
  movesPerPhase: 5,
  attackingPlayer: 'p1',
  ball: {
    position: { col: 5, row: 5 },
    carrier: 'p1',
  },
  players: {
    p1: {
      movesRemaining: 5,
      movesUsed: [],
      position: { col: 3, row: 5 },
      possession: true,
    },
    p2: {
      movesRemaining: 5,
      movesUsed: [],
      position: { col: 7, row: 5 },
      possession: false,
    },
  },
  turnStatus: 'waiting_both',
  score: {
    p1: 2,
    p2: 1,
  },
  stats: {
    p1: { possession: 54, tackles: 4, shots: 3, assists: 1 },
    p2: { possession: 46, tackles: 2, shots: 2, assists: 0 },
  },
  events: [],
  lastResolution: null,
});

export default function Matchup() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedMove, setSelectedMove] = useState<Move | null>(null);
  const [opponentCommitted, setOpponentCommitted] = useState(false);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    if (sessionId) {
      setGameState(createInitialState(sessionId));
    }

    // TODO: Connect WebSocket
    // TODO: Handle events: OPPONENT_COMMITTED, TURN_RESOLVED, PHASE_TRANSITION, MATCHUP_COMPLETE
  }, [sessionId]);

  const handleCommit = async () => {
    if (!selectedMove || isCommitting) return;

    setIsCommitting(true);

    // Simulate opponent response
    setTimeout(() => {
      setOpponentCommitted(true);

      // Simulate resolution
      setTimeout(() => {
        const mockResolution: Resolution = {
          p1Move: selectedMove,
          p2Move: 'tackle',
          outcome: selectedMove === 'shoot' ? 'goal' : 'advance',
          possessionChange: Math.random() > 0.5,
          goalScored: selectedMove === 'shoot',
          scorer: selectedMove === 'shoot' ? 'p1' : undefined,
        };

        setResolution(mockResolution);
        setIsCommitting(false);
        setSelectedMove(null);
        setOpponentCommitted(false);
      }, 1000);
    }, 500);
  };

  const handleResolutionComplete = () => {
    setResolution(null);

    // Check if game over
    if (gameState && gameState.phase >= gameState.totalPhases) {
      navigate(`/settlement/${sessionId}`);
    }
  };

  if (!gameState) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <span className="text-label text-muted">LOADING MATCHUP...</span>
        </div>
      </div>
    );
  }

  return (
    <GameLayout>
      <main className="flex flex-col md:flex-row h-full w-full">
        <section className="w-full md:w-[70%] h-1/2 md:h-full flex flex-col border-b md:border-b-0 md:border-r border-outline-variant/20 bg-surface">
          <ScoreBar
            gameState={gameState}
            playerSide="p1"
            homeTeam="ARS"
            awayTeam="CHE"
          />

          <div className="flex-1 p-4 bg-surface flex items-center justify-center">
            <Pitch gameState={gameState} playerSide="p1" />
          </div>

          <div className="h-12 bg-surface-container-low hairline-t flex items-center px-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full',
                opponentCommitted ? 'bg-tertiary-fixed' : 'bg-muted'
              )} />
              <span className="text-sm font-semibold">
                {opponentCommitted ? 'Opponent committed' : 'Waiting for opponent...'}
              </span>
            </div>
          </div>
        </section>

        <MoveSelector
          selectedMove={selectedMove}
          onSelect={setSelectedMove}
          onCommit={handleCommit}
          disabled={isCommitting}
          playerState={gameState.players.p1}
        />

        {resolution && (
          <ResolutionOverlay
            resolution={resolution}
            playerSide="p1"
            onComplete={handleResolutionComplete}
          />
        )}
      </main>
    </GameLayout>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
