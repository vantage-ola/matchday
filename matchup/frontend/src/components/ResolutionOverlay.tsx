import { useEffect, useState } from 'react';
import type { Resolution, Move } from '../types';
import { cn } from '@/lib/utils';

interface ResolutionOverlayProps {
  resolution: Resolution;
  playerSide: 'p1' | 'p2';
  onComplete: () => void;
}

const OUTCOME_CONFIG: Record<string, { label: string; color: string }> = {
  advance: { label: 'ADVANCE', color: 'text-tertiary-fixed' },
  intercept: { label: 'INTERCEPTED', color: 'text-orange-400' },
  tackle: { label: 'TACKLED', color: 'text-red-400' },
  goal: { label: 'GOAL', color: 'text-tertiary-fixed' },
  save: { label: 'SAVED', color: 'text-muted' },
  miss: { label: 'MISSED', color: 'text-muted' },
};

export default function ResolutionOverlay({
  resolution,
  playerSide,
  onComplete,
}: ResolutionOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Entrance
    requestAnimationFrame(() => setVisible(true));

    // Auto dismiss after 2.5s
    const dismissTimer = setTimeout(() => {
      setExiting(true);
    }, 2500);

    // Clean up after exit animation
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      clearTimeout(dismissTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const yourMove = playerSide === 'p1' ? resolution.p1Move : resolution.p2Move;
  const oppMove = playerSide === 'p1' ? resolution.p2Move : resolution.p1Move;
  const config = OUTCOME_CONFIG[resolution.outcome] || { label: resolution.outcome.toUpperCase(), color: 'text-foreground' };
  const isYourGoal = resolution.goalScored && resolution.scorer === playerSide;
  const isOppGoal = resolution.goalScored && resolution.scorer !== playerSide;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[200] flex items-center justify-center transition-all duration-500',
        visible && !exiting ? 'bg-black/85 backdrop-blur-sm' : 'bg-black/0',
        exiting && 'opacity-0'
      )}
    >
      <div
        className={cn(
          'w-full max-w-md mx-4 bg-surface p-6 md:p-8 flex flex-col gap-5 transition-all duration-500',
          visible && !exiting
            ? 'translate-y-0 opacity-100 scale-100'
            : !visible
              ? 'translate-y-4 opacity-0 scale-95'
              : 'translate-y-2 opacity-0 scale-95'
        )}
      >
        {/* Outcome — center prominent */}
        <div className="text-center">
          <div className={cn(
            'text-3xl md:text-4xl font-black tracking-tight transition-all duration-700',
            config.color,
            visible ? 'scale-100' : 'scale-50',
            resolution.goalScored && 'animate-pulse'
          )}>
            {config.label}
          </div>
          {resolution.possessionChange && !resolution.goalScored && (
            <p className="text-label-xs text-muted mt-2">
              Possession {resolution.scorer === playerSide ? 'lost' : 'gained'}
            </p>
          )}
        </div>

        {/* Move comparison */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <span className="text-label-xs text-muted">YOU</span>
            <div className={cn(
              'px-4 py-2 font-bold text-sm uppercase tracking-wide',
              isYourGoal
                ? 'bg-primary-container text-on-primary'
                : 'bg-surface-container text-foreground'
            )}>
              {formatMove(yourMove)}
            </div>
          </div>

          <div className="text-muted text-xl font-light">vs</div>

          <div className="flex flex-col items-center gap-1.5 flex-1">
            <span className="text-label-xs text-muted">OPPONENT</span>
            <div className={cn(
              'px-4 py-2 font-bold text-sm uppercase tracking-wide',
              isOppGoal
                ? 'bg-destructive/20 text-destructive'
                : 'bg-surface-container text-foreground'
            )}>
              {formatMove(oppMove)}
            </div>
          </div>
        </div>

        {/* Goal celebration */}
        {isYourGoal && (
          <div className="text-center animate-bounce">
            <span className="text-headline text-tertiary-fixed">YOU SCORED!</span>
          </div>
        )}
        {isOppGoal && (
          <div className="text-center">
            <span className="text-sm font-semibold text-muted">Opponent scored</span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatMove(move: Move): string {
  return move.replace('_', ' ');
}
