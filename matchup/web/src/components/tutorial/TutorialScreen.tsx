import { useState, useCallback, useMemo } from 'react';
import { Engine, type GameState, type GridPosition, getValidMoves, posToString } from '@/lib/engine';
import { Pitch } from '@/components/game/Pitch';
import { ScoreBar } from '@/components/game/ScoreBar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check } from 'lucide-react';
import { updateSettings, loadSettings } from '@/lib/settings';

interface TutorialScreenProps {
  onComplete: () => void;
  onQuit: () => void;
}

interface TutorialStep {
  instruction: string;
  hint: string;
  // Which player the user must select (null = any valid)
  targetPlayerId?: string;
  // Which cell the user must move to (null = any valid move for the target player)
  targetCell?: GridPosition;
}

const STEPS: TutorialStep[] = [
  {
    instruction: 'Select your forward',
    hint: 'Tap the ST token (white) near the center of the pitch.',
    targetPlayerId: 'home_fwd1',
  },
  {
    instruction: 'Dribble forward',
    hint: 'Tap a green highlighted cell to the right to dribble.',
    targetPlayerId: 'home_fwd1',
  },
  {
    instruction: 'Now pass to a midfielder',
    hint: 'Select your forward, then tap a teammate to pass the ball.',
    targetPlayerId: 'home_fwd1',
  },
  {
    instruction: 'Move the midfielder forward',
    hint: 'Select the midfielder who received the ball and dribble forward.',
  },
  {
    instruction: 'Take a shot!',
    hint: 'Move toward the goal or shoot if in range. ⚽',
  },
];

export function TutorialScreen({ onComplete, onQuit }: TutorialScreenProps) {
  const engine = useMemo(() => Engine.init('4-3-3', '4-3-3', () => 0.5), []);
  const [state, setState] = useState<GameState>(() => engine.getState());
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPlayerMoves, setSelectedPlayerMoves] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState(false);

  const validMoves = getValidMoves(state, state.possession);

  const selectPlayer = useCallback(
    (playerId: string) => {
      const player = state.players.find((p) => p.id === playerId);
      if (!player || player.team !== state.possession) return;
      setSelectedPlayerId(playerId);
      const moves = validMoves.filter((m) => m.playerId === playerId);
      setSelectedPlayerMoves(new Set(moves.map((m) => posToString(m.to))));
    },
    [state, validMoves],
  );

  const executeMove = useCallback(
    (playerId: string, to: GridPosition) => {
      const result = engine.applyMove(playerId, to);
      if (!result.valid) return;

      // After user's move, auto-play the away response (instant, no delay)
      const afterUserState = engine.getState();
      if (afterUserState.possession === 'away' && afterUserState.status === 'playing') {
        // Simple auto-move: move a random away player
        const awayMoves = getValidMoves(afterUserState, 'away');
        if (awayMoves.length > 0) {
          const pick = awayMoves[Math.floor(Math.random() * awayMoves.length)];
          engine.applyMove(pick.playerId, pick.to);
        }
      }

      const newState = engine.getState();
      setState(newState);
      setSelectedPlayerId(null);
      setSelectedPlayerMoves(new Set());

      // Advance step
      const next = stepIndex + 1;
      if (next >= STEPS.length || result.scored) {
        setCompleted(true);
        const settings = loadSettings();
        updateSettings({ ...settings, tutorialCompleted: true });
      } else {
        setStepIndex(next);
      }
    },
    [engine, stepIndex],
  );

  const deselectPlayer = useCallback(() => {
    setSelectedPlayerId(null);
    setSelectedPlayerMoves(new Set());
  }, []);

  if (!state) return null;

  const step = STEPS[stepIndex];

  if (completed) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
          <Check size={32} className="text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">You're ready!</h2>
          <p className="text-sm text-muted-foreground">
            You've learned the basics. Now go play a real match.
          </p>
        </div>
        <Button className="h-12 w-48 text-sm font-bold uppercase tracking-wide" onClick={onComplete}>
          Back to Menu
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col gap-2 p-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-9 w-9 px-0" onClick={onQuit}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1">
          <ScoreBar state={state} homeFormation="4-3-3" awayFormation="4-3-3" />
        </div>
      </div>

      {/* Coach mark */}
      <div className="rounded-lg bg-primary/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {stepIndex + 1}
          </span>
          <div>
            <p className="text-sm font-bold">{step.instruction}</p>
            <p className="text-xs text-muted-foreground">{step.hint}</p>
          </div>
        </div>
      </div>

      {/* Pitch */}
      <div className="relative flex-1 min-h-0 flex items-center">
        <div className="w-full">
          <Pitch
            state={state}
            selectedPlayerId={selectedPlayerId}
            selectedPlayerMoves={selectedPlayerMoves}
            isAiThinking={false}
            showPassingLanes={true}
            showTackleZones={true}
            ballHistory={[]}
            onSelectPlayer={selectPlayer}
            onExecuteMove={executeMove}
            onDeselect={deselectPlayer}
          />
        </div>
      </div>

      {/* Step progress */}
      <div className="flex items-center justify-center gap-1.5 pb-1">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-colors ${
              i < stepIndex ? 'w-4 bg-primary' : i === stepIndex ? 'w-6 bg-primary' : 'w-4 bg-muted/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
