import type { GameState } from '@/lib/engine';

interface ScoreBarProps {
  state: GameState;
  homeFormation: string;
  awayFormation: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ScoreBar({ state, homeFormation, awayFormation }: ScoreBarProps) {
  return (
    <div className="flex h-14 items-center justify-between rounded-lg bg-card px-4 text-card-foreground">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{homeFormation}</span>
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: state.possession === 'home' ? '#22c55e' : 'transparent' }}
        />
      </div>

      <div className="flex items-center gap-4">
        <span className="text-2xl font-bold tabular-nums">{state.score.home}</span>
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium tabular-nums">{formatTime(state.timeRemaining)}</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">{state.possession === 'home' ? 'HOME' : 'AWAY'}</span>
            <div className="flex items-center gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: i < state.actionPoints ? '#22c55e' : '#3f3f46' }}
                />
              ))}
            </div>
          </div>
        </div>
        <span className="text-2xl font-bold tabular-nums">{state.score.away}</span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: state.possession === 'away' ? '#22c55e' : 'transparent' }}
        />
        <span className="text-xs text-muted-foreground">{awayFormation}</span>
      </div>
    </div>
  );
}
