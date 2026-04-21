import type { Move, PlayerState } from '../types';
import { cn } from '@/lib/utils';

interface MoveSelectorProps {
  selectedMove: Move | null;
  onSelect: (move: Move) => void;
  onCommit: () => void;
  disabled?: boolean;
  playerState: PlayerState;
}

const ATTACK_MOVES: { move: Move; label: string }[] = [
  { move: 'pass', label: 'Pass' },
  { move: 'run', label: 'Run' },
  { move: 'long_ball', label: 'Long Ball' },
  { move: 'shoot', label: 'Shoot' },
  { move: 'sprint', label: 'Sprint' },
];

const DEFEND_MOVES: { move: Move; label: string }[] = [
  { move: 'press', label: 'Press' },
  { move: 'tackle', label: 'Tackle' },
  { move: 'hold_shape', label: 'Hold Shape' },
];

export default function MoveSelector({
  selectedMove,
  onSelect,
  onCommit,
  disabled,
  playerState,
}: MoveSelectorProps) {
  const movesRemaining = playerState.movesRemaining;

  return (
    <aside className="w-full md:w-[30%] h-full bg-surface-container flex flex-col">
      <header className="p-4 hairline-b bg-surface-container-low shrink-0">
        <h2 className="text-label text-outline">YOUR MOVE</h2>
        <p className="text-label-xs text-muted mt-1">Moves remaining: {movesRemaining}</p>
      </header>

      <div className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
        <div className="text-label-xs text-muted mb-2">ATTACK</div>
        {ATTACK_MOVES.map(({ move, label }) => {
          const isSelected = selectedMove === move;
          const isDisabled = disabled || movesRemaining <= 0;

          return (
            <button
              key={move}
              onClick={() => !isDisabled && onSelect(move)}
              disabled={isDisabled}
              className={cn(
                'w-full text-left p-4 border transition-colors flex justify-between items-center group',
                isSelected
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface text-foreground border-outline-variant hover:border-primary-container'
              )}
            >
              <span className="text-title">{label}</span>
              <span className="material-symbols-outlined text-lg">
                {isSelected ? 'check' : 'chevron_right'}
              </span>
            </button>
          );
        })}

        <div className="text-label-xs text-muted mt-4 mb-2">DEFEND</div>
        {DEFEND_MOVES.map(({ move, label }) => {
          const isSelected = selectedMove === move;
          const isDisabled = disabled || movesRemaining <= 0;

          return (
            <button
              key={move}
              onClick={() => !isDisabled && onSelect(move)}
              disabled={isDisabled}
              className={cn(
                'w-full text-left p-4 border transition-colors flex justify-between items-center group',
                isSelected
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface text-foreground border-outline-variant hover:border-primary-container'
              )}
            >
              <span className="text-title">{label}</span>
              <span className="material-symbols-outlined text-lg">
                {isSelected ? 'check' : 'chevron_right'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="p-4 bg-surface-container-low hairline-t shrink-0">
        <button
          onClick={onCommit}
          disabled={!selectedMove || disabled}
          className={cn(
            'w-full py-4 font-bold tracking-wide flex justify-center items-center gap-2 transition-colors',
            selectedMove && !disabled
              ? 'bg-primary-container text-on-primary'
              : 'bg-surface-container-high text-muted'
          )}
        >
          <span className="text-label">COMMIT</span>
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </aside>
  );
}
