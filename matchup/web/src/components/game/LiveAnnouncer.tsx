import { useEffect, useRef } from 'react';
import type { MoveResult } from '@/lib/engine';

interface LiveAnnouncerProps {
  lastMoveResult: MoveResult | null;
}

function outcomeToText(result: MoveResult): string | null {
  if (!result.valid) return null;
  switch (result.outcome) {
    case 'goal':
      return `Goal scored! ${result.newState.score.home} to ${result.newState.score.away}`;
    case 'intercepted':
      return 'Pass intercepted!';
    case 'blocked':
      return 'Shot blocked!';
    case 'tackled':
      return 'Tackle won! Ball recovered.';
    case 'tackleFailed':
      return 'Tackle failed! Attacker keeps the ball.';
    case 'miss':
      return 'Shot missed!';
    case 'success':
      if (result.move?.type === 'pass') return 'Pass completed.';
      if (result.move?.type === 'shoot') return 'Shot on target!';
      return null; // dribble/run — too frequent to announce
    default:
      return null;
  }
}

/**
 * ARIA live region that announces key match events for screen readers.
 * Visually hidden — only read by assistive technology.
 */
export function LiveAnnouncer({ lastMoveResult }: LiveAnnouncerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prevResult = useRef<MoveResult | null>(null);

  useEffect(() => {
    if (!lastMoveResult || lastMoveResult === prevResult.current) return;
    prevResult.current = lastMoveResult;

    const text = outcomeToText(lastMoveResult);
    if (text && ref.current) {
      ref.current.textContent = text;
    }
  }, [lastMoveResult]);

  return (
    <div
      ref={ref}
      role="status"
      aria-live="assertive"
      aria-atomic="true"
      className="sr-only"
    />
  );
}
