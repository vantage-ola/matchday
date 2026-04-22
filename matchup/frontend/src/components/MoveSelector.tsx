import type { Move, PlayerState, GameState, PlayerNumber } from '../types';
import type { TeamColors } from '@/lib/team-colors';
import { cn } from '@/lib/utils';

interface MoveSelectorProps {
  selectedMove: Move | null;
  onSelect: (move: Move) => void;
  onCommit: () => void;
  disabled?: boolean;
  moveLockedIn?: boolean;
  playerState: PlayerState;
  isAttacking: boolean;
  gameState: GameState;
  playerSide: PlayerNumber;
  moveTimer?: number;
  maxTimer?: number;
  yourColors?: TeamColors;
}

interface MoveOption {
  move: Move;
  label: string;
  icon: string;
  description: string;
}

const ATTACK_MOVES: MoveOption[] = [
  { move: 'pass', label: 'PASS', icon: 'PA', description: 'Short pass to a teammate' },
  { move: 'long_ball', label: 'LONG BALL', icon: 'LB', description: 'Long pass forward' },
  { move: 'run', label: 'RUN', icon: 'RN', description: 'Carry the ball forward' },
  { move: 'sprint', label: 'SPRINT', icon: 'SP', description: 'Burst of speed past defenders' },
  { move: 'shoot', label: 'SHOOT', icon: 'SH', description: 'Take a shot on goal' },
];

const DEFEND_MOVES: MoveOption[] = [
  { move: 'hold_shape', label: 'HOLD SHAPE', icon: 'HS', description: 'Maintain defensive formation' },
  { move: 'press', label: 'PRESS', icon: 'PR', description: 'Push forward to win ball' },
  { move: 'tackle', label: 'TACKLE', icon: 'TK', description: 'Attempt to take the ball' },
];

export default function MoveSelector({
  selectedMove,
  onSelect,
  onCommit,
  disabled = false,
  moveLockedIn = false,
  playerState,
  isAttacking,
  gameState,
  playerSide,
  moveTimer = 10,
  maxTimer = 10,
  yourColors,
}: MoveSelectorProps) {
  const movesRemaining = playerState.movesRemaining;
  const canShoot = isAttacking && gameState.ball.position.col >= 7;
  const moves = isAttacking ? ATTACK_MOVES : DEFEND_MOVES;
  const timerPct = (moveTimer / maxTimer) * 100;
  const timerUrgent = moveTimer <= 3;

  return (
    <aside className="w-full md:w-[30%] h-full flex flex-col bg-surface-container/50 backdrop-blur-sm">
      {/* Header */}
      <header className="p-4 md:p-5 hairline-b shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: isAttacking ? (yourColors?.primary || '#94F6C4') : '#888' }}
              />
              <span className="text-label text-muted">
                {isAttacking ? 'ATTACKING' : 'DEFENDING'}
              </span>
            </div>
            <h2 className="text-lg font-bold tracking-tight mt-1">
              {isAttacking ? 'SELECT ACTION' : 'TACTICS'}
            </h2>
          </div>
          <div className="text-right">
            <span className="text-label-xs text-muted block">MOVES LEFT</span>
            <span className="text-xl font-black text-foreground">{movesRemaining}</span>
          </div>
        </div>
      </header>

      {/* Move cards */}
      <div className="flex-1 p-3 md:p-4 flex flex-col gap-2 overflow-y-auto">
        {moves.map(({ move, label, icon, description }) => {
          const isSelected = selectedMove === move;
          const isDisabled = disabled || movesRemaining <= 0 || (move === 'shoot' && !canShoot);

          return (
            <button
              key={move}
              onClick={() => !isDisabled && onSelect(move)}
              disabled={isDisabled}
              className={cn(
                'w-full text-left px-4 py-3 border transition-all duration-200 flex items-center justify-between group relative overflow-hidden',
                isSelected
                  ? 'bg-primary-container text-on-primary border-primary-container shadow-sm'
                  : isDisabled
                    ? 'bg-surface-container-high/50 text-muted border-outline-variant/10 cursor-not-allowed opacity-50'
                    : 'bg-surface text-foreground border-outline-variant/30 hover:border-primary-container/50 hover:bg-surface-container-low'
              )}
            >
              {/* Accent bar on selected */}
              {isSelected && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: yourColors?.primary || '#94F6C4' }}
                />
              )}
              
              <div className="flex items-center gap-3 pl-1">
              <span className="text-[10px] font-black tracking-wider text-muted">{icon}</span>
                <div>
                  <span className="text-sm font-bold tracking-wide">{label}</span>
                  {move === 'shoot' && !canShoot && (
                    <span className="ml-2 text-[10px] font-bold text-destructive uppercase">BLOCKED</span>
                  )}
                </div>
              </div>
              <span className={cn(
                'text-sm transition-transform duration-200',
                isSelected ? 'text-on-primary' : 'text-muted group-hover:translate-x-0.5'
              )}>
                {isSelected ? '✓' : '›'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Timer bar + Commit button */}
      <div className="shrink-0 hairline-t">
        {/* Timer */}
        {!moveLockedIn && (
          <div className="px-3 md:px-4 pt-3 pb-1">
            <div className="flex items-center justify-between mb-1">
              <span className={cn(
                'text-[10px] font-bold tabular-nums',
                timerUrgent ? 'text-red-500' : 'text-muted'
              )}>
                {moveTimer}s
              </span>
              <span className="text-[10px] text-muted">AUTO-COMMIT</span>
            </div>
            <div className="w-full h-1 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-1000 ease-linear',
                  timerUrgent ? 'bg-red-500' : timerPct > 50 ? 'bg-primary-container' : 'bg-amber-500'
                )}
                style={{ width: `${timerPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Commit / Locked state */}
        <div className="p-3 md:p-4">
          {moveLockedIn ? (
            <div className="w-full py-3.5 md:py-4 flex flex-col items-center gap-2 bg-surface-container-high/70">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-tertiary-fixed animate-pulse" />
                <span className="text-label text-muted">MOVE LOCKED IN</span>
              </div>
              <span className="text-label-xs text-muted">Waiting for opponent...</span>
            </div>
          ) : (
            <button
              onClick={onCommit}
              disabled={!selectedMove || disabled}
              className={cn(
                'w-full py-3.5 md:py-4 font-bold tracking-wide flex justify-center items-center gap-2 transition-all duration-200 text-sm',
                selectedMove && !disabled
                  ? 'bg-primary-container text-on-primary hover:brightness-110 active:scale-[0.98]'
                  : 'bg-surface-container-high text-muted cursor-not-allowed'
              )}
            >
              <span className="text-label">COMMIT ACTION</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
