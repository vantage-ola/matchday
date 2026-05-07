import { useMemo } from 'react';
import { type GameState, type Player, ROWS, posToString } from '@/lib/engine';
import { PlayerToken } from './PlayerToken';
import { PassingLanes } from './PassingLanes';

interface PitchProps {
  state: GameState;
  selectedPlayerId: string | null;
  selectedPlayerMoves: Set<string>;
  isAiThinking: boolean;
  failedTacklerId?: string | null;
  showPassingLanes?: boolean;
  onSelectPlayer: (playerId: string) => void;
  onExecuteMove: (playerId: string, to: { col: number; row: string }) => void;
  onDeselect: () => void;
}

const COLS_COUNT = 22;
const ROWS_COUNT = 11;

function isGoalCell(col: number, row: string): 'home' | 'away' | null {
  if ((row === 'e' || row === 'f' || row === 'g') && col === 1) return 'home';
  if ((row === 'e' || row === 'f' || row === 'g') && col === 22) return 'away';
  return null;
}

export function Pitch({
  state,
  selectedPlayerId,
  selectedPlayerMoves,
  isAiThinking,
  failedTacklerId,
  showPassingLanes = true,
  onSelectPlayer,
  onExecuteMove,
  onDeselect,
}: PitchProps) {
  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of state.players) {
      map.set(posToString(p.position), p);
    }
    return map;
  }, [state.players]);

  const compact = typeof window !== 'undefined' && window.innerWidth < 500;

  const handleCellClick = (col: number, row: string) => {
    const posKey = posToString({ col, row });
    const player = playerMap.get(posKey);

    if (selectedPlayerId && selectedPlayerMoves.has(posKey)) {
      onExecuteMove(selectedPlayerId, { col, row });
      return;
    }

    if (player && player.team === state.possession && !isAiThinking) {
      onSelectPlayer(player.id);
      return;
    }

    onDeselect();
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg"
      style={{
        aspectRatio: '22 / 11',
        backgroundColor: 'var(--pitch-bg)',
      }}
    >
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${COLS_COUNT}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS_COUNT}, 1fr)`,
        }}
      >
        {ROWS.map((row) =>
          Array.from({ length: COLS_COUNT }, (_, i) => {
            const col = i + 1;
            const posKey = posToString({ col, row });
            const player = playerMap.get(posKey);
            const isValid = selectedPlayerMoves.has(posKey);
            const goal = isGoalCell(col, row);
            const isCenterLine = col === 11 || col === 12;

            return (
              <div
                key={posKey}
                onClick={() => handleCellClick(col, row)}
                className="relative flex items-center justify-center"
                style={{
                  borderRight: isCenterLine && col === 11 ? '1px solid var(--pitch-line)' : undefined,
                  backgroundColor: isValid
                    ? 'var(--pitch-highlight)'
                    : goal
                    ? 'rgba(255,255,255,0.08)'
                    : undefined,
                  cursor: isValid || (player && player.team === state.possession && !isAiThinking) ? 'pointer' : 'default',
                }}
              >
                {player && (
                  <PlayerToken
                    player={player}
                    isSelected={player.id === selectedPlayerId}
                    isCurrent={player.team === state.possession}
                    compact={compact}
                    tackleFailed={player.id === failedTacklerId}
                    onClick={() => {
                      if (player.team === state.possession && !isAiThinking) {
                        onSelectPlayer(player.id);
                      }
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {showPassingLanes && (
        <PassingLanes state={state} selectedPlayerId={selectedPlayerId} />
      )}

      {/* Field markings */}
      <div className="pointer-events-none absolute inset-0">
        {/* Center circle */}
        <div
          className="absolute rounded-full border"
          style={{
            width: '12%',
            height: '24%',
            left: '44%',
            top: '38%',
            borderColor: 'var(--pitch-line)',
          }}
        />
        {/* Center dot */}
        <div
          className="absolute rounded-full"
          style={{
            width: 6,
            height: 6,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'var(--pitch-line)',
          }}
        />
      </div>
    </div>
  );
}
