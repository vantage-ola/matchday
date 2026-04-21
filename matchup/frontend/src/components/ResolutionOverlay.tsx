import type { Resolution, Move } from '../types';
import { cn } from '@/lib/utils';

interface ResolutionOverlayProps {
  resolution: Resolution;
  playerSide: 'p1' | 'p2';
  onComplete: () => void;
}

const OUTCOME_LABELS: Record<string, string> = {
  advance: 'ADVANCE',
  intercept: 'INTERCEPTED',
  tackle: 'TACKLED',
  goal: 'GOAL',
  save: 'SAVED',
  miss: 'MISSED',
};

const OUTCOME_COLORS: Record<string, string> = {
  advance: 'text-tertiary-fixed',
  intercept: 'text-tertiary-fixed-dim',
  tackle: 'text-tertiary-fixed-dim',
  goal: 'text-tertiary-fixed',
  save: 'text-muted',
  miss: 'text-muted',
};

export default function ResolutionOverlay({
  resolution,
  playerSide,
  onComplete,
}: ResolutionOverlayProps) {
  const yourMove = playerSide === 'p1' ? resolution.p1Move : resolution.p2Move;
  const oppMove = playerSide === 'p1' ? resolution.p2Move : resolution.p1Move;
  const outcome = OUTCOME_LABELS[resolution.outcome] || resolution.outcome.toUpperCase();
  const outcomeColor = OUTCOME_COLORS[resolution.outcome] || 'text-foreground';

  const isYourGoal = resolution.goalScored && resolution.scorer === playerSide;

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-inverse-surface/90 animate-in fade-in duration-200"
      onAnimationEnd={onComplete}
    >
      <div className="w-full max-w-lg bg-surface p-6 flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div className="flex flex-col items-center gap-2 flex-1">
            <span className="text-label text-muted">YOU</span>
            <span className="text-title text-primary uppercase">{formatMove(yourMove)}</span>
          </div>

          <div className="flex flex-col items-center gap-2 px-4">
            <span className={cn('text-2xl font-black tracking-tight', outcomeColor)}>
              {outcome}
            </span>
            {resolution.possessionChange && (
              <span className="text-label-xs text-muted">
                Possession {resolution.scorer === playerSide ? 'lost' : 'gained'}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center gap-2 flex-1">
            <span className="text-label text-muted">OPPONENT</span>
            <span className="text-title text-foreground uppercase">{formatMove(oppMove)}</span>
          </div>
        </div>

        {isYourGoal && (
          <div className="text-center">
            <span className="text-headline text-tertiary-fixed">GOAL!</span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatMove(move: Move): string {
  return move.replace('_', ' ').toUpperCase();
}
