import { useEffect, useRef, useState } from 'react';
import type { GameState, SpatialResolution, PlayerSide } from '../types';
import { resolveCapName, formatAction } from '@/lib/game-utils';
import { cn } from '@/lib/utils';

interface ResolutionOverlayProps {
  resolution: SpatialResolution;
  playerSide: PlayerSide;
  gameState: GameState;
  onComplete: () => void;
}

const OUTCOME_CONFIG: Record<string, { label: string; color: string; explanation: string }> = {
  advance: { label: 'ADVANCE', color: 'text-tertiary-fixed', explanation: 'Attack progresses forward' },
  intercept: { label: 'INTERCEPTED', color: 'text-orange-400', explanation: 'Defender read the pass' },
  tackle: { label: 'TACKLED', color: 'text-red-400', explanation: 'Ball won in a challenge' },
  goal: { label: 'GOAL!', color: 'text-green-400', explanation: 'The ball hits the net!' },
  save: { label: 'SAVED', color: 'text-muted', explanation: 'Keeper stopped the shot' },
  miss: { label: 'MISSED', color: 'text-muted', explanation: 'Shot went off target' },
  through: { label: 'THROUGH BALL', color: 'text-blue-400', explanation: 'Pass split the defense' },
  press_won: { label: 'PRESS WON', color: 'text-yellow-400', explanation: 'High pressure forced a turnover' },
  blocked: { label: 'BLOCKED', color: 'text-muted', explanation: 'Shot blocked by defender' },
  wide: { label: 'WIDE', color: 'text-muted', explanation: 'Completely off target' },
};

export default function ResolutionOverlay({
  resolution,
  playerSide,
  gameState,
  onComplete,
}: ResolutionOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setVisible(false);
    setExiting(false);
    requestAnimationFrame(() => setVisible(true));

    const dismissTimer = setTimeout(() => {
      setExiting(true);
    }, 2000);

    const completeTimer = setTimeout(() => {
      onCompleteRef.current();
    }, 2300);

    return () => {
      clearTimeout(dismissTimer);
      clearTimeout(completeTimer);
    };
  }, [resolution]);

  const config = OUTCOME_CONFIG[resolution.outcome] || { label: resolution.outcome.toUpperCase(), color: 'text-foreground', explanation: '' };
  const isYourGoal = resolution.goalScored && resolution.scorerCapId?.includes(playerSide);
  const isOppGoal = resolution.goalScored && resolution.scorerCapId && !resolution.scorerCapId.includes(playerSide);

  const attackerName = resolveCapName(resolution.attackerMove.fromCapId, gameState);
  const defenderName = resolveCapName(resolution.defenderMove.fromCapId, gameState);

  return (
    <div
      className={cn(
        'fixed inset-0 z-[200] flex items-center justify-center transition-all duration-500 cursor-pointer',
        visible && !exiting ? 'bg-black/85 backdrop-blur-sm' : 'bg-black/0',
        exiting && 'opacity-0'
      )}
      onClick={() => onCompleteRef.current()}
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
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className={cn(
            'text-3xl md:text-4xl font-black tracking-tight transition-all duration-700',
            config.color,
            visible ? 'scale-100' : 'scale-50',
            resolution.goalScored && 'animate-pulse'
          )}>
            {config.label}
          </div>
          {config.explanation && (
            <p className="text-label-xs text-muted mt-2">
              {config.explanation}
            </p>
          )}
          {resolution.possessionChange && !resolution.goalScored && (
            <p className="text-label-xs text-muted mt-1">
              Possession changed
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <span className="text-label-xs text-muted">ATTACKER</span>
            <div className="px-3 py-2 font-bold text-xs uppercase tracking-wide bg-surface-container rounded-sm">
              {attackerName}: {formatAction(resolution.attackerMove.action)}
            </div>
          </div>

          <div className="text-muted text-xl font-light">vs</div>

          <div className="flex flex-col items-center gap-1.5 flex-1">
            <span className="text-label-xs text-muted">DEFENDER</span>
            <div className="px-3 py-2 font-bold text-xs uppercase tracking-wide bg-surface-container rounded-sm">
              {defenderName}: {formatAction(resolution.defenderMove.action)}
            </div>
          </div>
        </div>

        {isYourGoal && (
          <div className="text-center animate-bounce">
            <span className="text-headline text-tertiary-fixed">YOU SCORED!</span>
          </div>
        )}
        {isOppGoal && (
          <div className="text-center">
            <span className="text-title text-red-400 font-black">OPPONENT SCORED</span>
          </div>
        )}

        <div className="text-center">
          <span className="text-[10px] text-muted/50">tap to dismiss</span>
        </div>
      </div>
    </div>
  );
}
