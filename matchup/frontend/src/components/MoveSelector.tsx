import type { GameState, PlayerSide, GameMove, AttackerAction, DefenderAction } from '../types';
import type { TeamColors } from '@/lib/team-colors';
import { describeMoveHuman, describePosition } from '@/lib/game-utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MoveSelectorProps {
  selectedMove: GameMove | null;
  onSelect: (move: GameMove) => void;
  onCommit: () => void;
  disabled?: boolean;
  moveLockedIn?: boolean;
  gameState: GameState;
  playerSide: PlayerSide;
  moveTimer?: number;
  maxTimer?: number;
  yourColors?: TeamColors;
}

const ATTACKER_ACTIONS: { action: AttackerAction; label: string; icon: string; description: string }[] = [
  { action: 'pass', label: 'PASS', icon: 'PA', description: 'Safe ground pass — low risk' },
  { action: 'through_pass', label: 'THROUGH', icon: 'TH', description: 'Split the defense — high reward' },
  { action: 'cross', label: 'CROSS', icon: 'CR', description: 'Whip it in from the wing' },
  { action: 'long_ball', label: 'LONG BALL', icon: 'LB', description: 'Aerial ball to distant teammate' },
  { action: 'shoot', label: 'SHOOT', icon: 'SH', description: 'Take a shot on goal' },
  { action: 'run', label: 'RUN', icon: 'RN', description: 'Dribble forward with the ball' },
];

const DEFENDER_ACTIONS: { action: DefenderAction; label: string; icon: string; description: string }[] = [
  { action: 'press', label: 'PRESS', icon: 'PR', description: 'Rush toward the ball carrier' },
  { action: 'tackle', label: 'TACKLE', icon: 'TK', description: 'Commit to winning the ball' },
  { action: 'intercept', label: 'INTERCEPT', icon: 'IN', description: 'Read the pass, cut the lane' },
  { action: 'hold_shape', label: 'HOLD SHAPE', icon: 'HS', description: 'Stay in position, block lanes' },
  { action: 'track_back', label: 'TRACK BACK', icon: 'TB', description: 'Sprint back toward your goal' },
];

export default function MoveSelector({
  selectedMove,
  onSelect,
  onCommit,
  disabled = false,
  moveLockedIn = false,
  gameState,
  playerSide,
  moveTimer = 10,
  maxTimer = 10,
  yourColors,
}: MoveSelectorProps) {
  const isAttacking = gameState.attackingSide === playerSide;
  const actions = isAttacking ? ATTACKER_ACTIONS : DEFENDER_ACTIONS;
  const timerPct = (moveTimer / maxTimer) * 100;
  const timerUrgent = moveTimer <= 3;

  return (
    <aside className="w-full md:w-[30%] h-full flex flex-col bg-surface-container/50 backdrop-blur-sm">
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
              {isAttacking ? 'DRAW TO MOVE' : 'TACTICS'}
            </h2>
          </div>
          <div className="text-right">
            <span className="text-label-xs text-muted block">PHASE</span>
            <span className="text-xl font-black text-foreground">
              {gameState.phase}/{gameState.totalPhases}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 p-3 md:p-4 flex flex-col gap-2 overflow-y-auto relative">
        <div className="text-xs text-muted mb-2">
          {isAttacking
            ? 'Drag from ball carrier to make a move'
            : 'Drag a defender to counter the attack'}
        </div>

        {actions.map(({ action, label, icon, description }) => {
          const isSelected = selectedMove?.action === action;

          return (
            <Button
              key={action}
              onClick={() => {
                if (!selectedMove) return;
                const isAttackerAction = (a: string): a is AttackerAction =>
                  ['pass', 'through_pass', 'cross', 'long_ball', 'shoot', 'run'].includes(a);

                if (isAttackerAction(action)) {
                  onSelect({ ...selectedMove, action } as GameMove);
                } else {
                  onSelect({ ...selectedMove, action: action as DefenderAction } as GameMove);
                }
              }}
              disabled={disabled || !selectedMove}
              variant={isSelected ? "move-selected" : "move"}
              className={cn(
                'w-full justify-between h-auto py-2 px-3 rounded-sm relative overflow-hidden group',
                isSelected && 'bg-primary-container'
              )}
            >
              {isSelected && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: yourColors?.primary || '#94F6C4' }}
                />
              )}
              <div className="flex items-center gap-2 pl-1">
                <span className="text-[9px] font-black tracking-wider text-muted opacity-70">{icon}</span>
                <div className="flex flex-col items-start">
                  <span className="text-xs font-bold tracking-wide">{label}</span>
                  <span className="text-[9px] text-muted">{description}</span>
                </div>
              </div>
              <span className={cn(
                'text-sm',
                isSelected ? 'text-on-primary' : 'text-muted'
              )}>
                {isSelected ? '✓' : '›'}
              </span>
            </Button>
          );
        })}

        {/* Disabled overlay when no move selected */}
        {!selectedMove && !disabled && !moveLockedIn && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px] rounded pointer-events-none">
            <span className="text-label text-muted">Drag a player on the pitch first</span>
          </div>
        )}

        {/* Human-readable move preview */}
        {selectedMove && (
          <div className="mt-3 p-3 bg-surface-container-low rounded-sm">
            <div className="text-[10px] font-bold text-muted uppercase mb-1">Selected</div>
            <div className="text-sm font-semibold">
              {describeMoveHuman(selectedMove, gameState)}
            </div>
            <div className="text-xs text-muted mt-1">
              {describePosition(selectedMove.toPosition.col)}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 hairline-t">
        {!moveLockedIn && (
          <div className={cn(
            'px-3 md:px-4 pt-3 pb-1 transition-colors',
            timerUrgent && 'bg-red-500/10'
          )}>
            <div className="flex items-center justify-between mb-1">
              <span className={cn(
                'text-[10px] font-bold tabular-nums',
                timerUrgent ? 'text-red-500 animate-pulse' : 'text-muted'
              )}>
                {moveTimer}s
              </span>
              <span className={cn(
                'text-[10px]',
                timerUrgent ? 'text-red-500 font-bold' : 'text-muted'
              )}>
                {timerUrgent ? 'AUTO-COMMITTING SOON' : 'AUTO-COMMIT'}
              </span>
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
            <Button
              onClick={onCommit}
              disabled={!selectedMove || disabled}
              variant={selectedMove && !disabled ? "move-committed" : "ghost"}
              className={cn(
                'w-full py-3.5 md:py-4 h-auto rounded-sm flex justify-center items-center gap-2',
                !selectedMove || disabled ? 'bg-surface-container-high text-muted cursor-not-allowed border-0 hover:bg-surface-container-high' : '',
                timerUrgent && selectedMove && !disabled && 'animate-pulse ring-2 ring-red-500'
              )}
            >
              <span className="text-[11px] font-bold tracking-wider uppercase">
                {!selectedMove ? 'DRAG ON PITCH FIRST' : 'COMMIT MOVE'}
              </span>
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
