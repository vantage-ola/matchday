import { useMemo, useRef, useState, useCallback } from 'react';
import {
  type GameState,
  type GridPosition,
  type MoveResult,
  type Player,
  ROWS,
  posToString,
  rowToNum,
} from '@/lib/engine';
import { PlayerToken } from './PlayerToken';
import { PassingLanes } from './PassingLanes';
import { GhostTrail } from './GhostTrail';
import { InterceptionFlash } from './InterceptionFlash';
import { TackleZones } from './TackleZones';

interface PitchProps {
  state: GameState;
  selectedPlayerId: string | null;
  selectedPlayerMoves: Set<string>;
  isAiThinking: boolean;
  failedTacklerId?: string | null;
  showPassingLanes?: boolean;
  showTackleZones?: boolean;
  ballHistory?: GridPosition[];
  lastMoveResult?: MoveResult | null;
  onSelectPlayer: (playerId: string) => void;
  onExecuteMove: (playerId: string, to: { col: number; row: string }) => void;
  onDeselect: () => void;
}

const COLS_COUNT = 22;
const ROWS_COUNT = 11;
const DRAG_THRESHOLD_PX = 12;

function isGoalCell(col: number, row: string): 'home' | 'away' | null {
  if ((row === 'e' || row === 'f' || row === 'g') && col === 1) return 'home';
  if ((row === 'e' || row === 'f' || row === 'g') && col === 22) return 'away';
  return null;
}

function parseMoveKey(key: string): GridPosition {
  const [colStr, row] = key.split(':');
  return { col: Number(colStr), row };
}

export function Pitch({
  state,
  selectedPlayerId,
  selectedPlayerMoves,
  isAiThinking,
  failedTacklerId,
  showPassingLanes = true,
  showTackleZones = true,
  ballHistory = [],
  lastMoveResult = null,
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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    playerId: string;
    startX: number;
    startY: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);
  const [snapTarget, setSnapTarget] = useState<GridPosition | null>(null);
  const [dragOrigin, setDragOrigin] = useState<GridPosition | null>(null);
  const [cursorPos, setCursorPos] = useState<{ col: number; rowIdx: number } | null>(null);

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

  // ── Keyboard navigation ──────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isAiThinking) return;

      const rows = ROWS as readonly string[];

      // Initialise cursor at center if not set
      if (!cursorPos && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        setCursorPos({ col: 11, rowIdx: 5 });
        e.preventDefault();
        return;
      }

      if (cursorPos) {
        let { col, rowIdx } = cursorPos;

        switch (e.key) {
          case 'ArrowUp':
            rowIdx = Math.max(0, rowIdx - 1);
            e.preventDefault();
            break;
          case 'ArrowDown':
            rowIdx = Math.min(ROWS_COUNT - 1, rowIdx + 1);
            e.preventDefault();
            break;
          case 'ArrowLeft':
            col = Math.max(1, col - 1);
            e.preventDefault();
            break;
          case 'ArrowRight':
            col = Math.min(COLS_COUNT, col + 1);
            e.preventDefault();
            break;
          case ' ':
          case 'Enter':
            handleCellClick(col, rows[rowIdx]);
            e.preventDefault();
            return;
          case 'Escape':
            onDeselect();
            setCursorPos(null);
            e.preventDefault();
            return;
          default:
            return;
        }

        setCursorPos({ col, rowIdx });
      }

      // Tab to cycle through team's players
      if (e.key === 'Tab') {
        e.preventDefault();
        const teamPlayers = state.players
          .filter((p) => p.team === state.possession)
          .sort((a, b) => a.position.col - b.position.col || a.position.row.localeCompare(b.position.row));
        if (teamPlayers.length === 0) return;

        const currentIdx = selectedPlayerId
          ? teamPlayers.findIndex((p) => p.id === selectedPlayerId)
          : -1;
        const nextIdx = (currentIdx + (e.shiftKey ? -1 : 1) + teamPlayers.length) % teamPlayers.length;
        const next = teamPlayers[nextIdx];
        onSelectPlayer(next.id);
        const ri = rows.indexOf(next.position.row);
        setCursorPos({ col: next.position.col, rowIdx: ri >= 0 ? ri : 5 });
      }
    },
    [isAiThinking, cursorPos, state, selectedPlayerId, selectedPlayerMoves, onSelectPlayer, onDeselect, handleCellClick],
  );

  const findNearestTarget = (clientX: number, clientY: number): GridPosition | null => {
    const el = containerRef.current;
    if (!el || selectedPlayerMoves.size === 0) return null;
    const rect = el.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * COLS_COUNT + 0.5;
    const py = ((clientY - rect.top) / rect.height) * ROWS_COUNT + 0.5;

    let best: { pos: GridPosition; dist: number } | null = null;
    for (const key of selectedPlayerMoves) {
      const pos = parseMoveKey(key);
      const dx = pos.col - px;
      const dy = rowToNum(pos.row) - py;
      const d = dx * dx + dy * dy;
      if (!best || d < best.dist) best = { pos, dist: d };
    }
    return best?.pos ?? null;
  };

  const handlePlayerPointerDown = (player: Player, e: React.PointerEvent) => {
    if (isAiThinking) return;
    if (player.team !== state.possession) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // If this teammate is a valid destination (e.g. a pass) for the currently
    // selected player, leave selection alone and let the click handler commit
    // the move on pointer-up. Don't start a drag from the receiver.
    const posKey = posToString(player.position);
    if (selectedPlayerId && selectedPlayerId !== player.id && selectedPlayerMoves.has(posKey)) {
      return;
    }

    if (selectedPlayerId !== player.id) {
      onSelectPlayer(player.id);
    }

    dragRef.current = {
      playerId: player.id,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
    };
    setDragOrigin(player.position);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (!drag.moved) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
    }

    const target = findNearestTarget(e.clientX, e.clientY);
    setSnapTarget(target);
  };

  const endDrag = (e: React.PointerEvent, commit: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const moved = drag.moved;
    const playerId = drag.playerId;
    const target = snapTarget;
    dragRef.current = null;
    setSnapTarget(null);
    setDragOrigin(null);

    if (commit && moved && target) {
      onExecuteMove(playerId, target);
    }
  };

  const dragLine = (() => {
    if (!dragOrigin || !snapTarget) return null;
    const x1 = ((dragOrigin.col - 0.5) / COLS_COUNT) * 100;
    const y1 = ((rowToNum(dragOrigin.row) + 0.5) / ROWS_COUNT) * 100;
    const x2 = ((snapTarget.col - 0.5) / COLS_COUNT) * 100;
    const y2 = ((rowToNum(snapTarget.row) + 0.5) / ROWS_COUNT) * 100;
    return { x1, y1, x2, y2 };
  })();

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden border border-border outline-none"
      style={{
        aspectRatio: '22 / 11',
        backgroundColor: 'var(--pitch-bg)',
        touchAction: 'none',
      }}
      role="grid"
      aria-label="Football pitch — 22 columns by 11 rows"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => endDrag(e, true)}
      onPointerCancel={(e) => endDrag(e, false)}
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
            const isSnapped =
              snapTarget !== null &&
              snapTarget.col === col &&
              snapTarget.row === row;
            const goal = isGoalCell(col, row);
            const isCenterLine = col === 11 || col === 12;

            const isCursorHere =
              cursorPos !== null &&
              cursorPos.col === col &&
              ROWS[cursorPos.rowIdx] === row;

            // Build aria-label for screen readers
            const ariaLabel = player
              ? `Row ${row}, Column ${col}, ${player.team} ${player.role.toUpperCase()}${player.hasBall ? ' with ball' : ''}`
              : `Row ${row}, Column ${col}${isValid ? ', valid move' : ''}${goal ? `, ${goal} goal` : ''}`;

            return (
              <div
                key={posKey}
                role="gridcell"
                aria-label={ariaLabel}
                onClick={() => handleCellClick(col, row)}
                className="relative flex items-center justify-center"
                style={{
                  borderRight: isCenterLine && col === 11 ? '1px solid var(--pitch-line)' : undefined,
                  backgroundColor: isSnapped
                    ? 'var(--pitch-snap, rgba(250, 204, 21, 0.55))'
                    : isValid
                    ? 'var(--pitch-highlight)'
                    : goal
                    ? 'rgba(255,255,255,0.08)'
                    : undefined,
                  cursor: isValid || (player && player.team === state.possession && !isAiThinking) ? 'pointer' : 'default',
                  outline: isCursorHere ? '2px dashed var(--pitch-snap-border, rgba(250, 204, 21, 0.9))' : undefined,
                  outlineOffset: '-1px',
                  zIndex: isCursorHere ? 5 : undefined,
                }}
              >
                {player && (
                  <PlayerToken
                    player={player}
                    isSelected={player.id === selectedPlayerId}
                    isCurrent={player.team === state.possession}
                    compact={compact}
                    tackleFailed={player.id === failedTacklerId}
                    onPointerDown={(e) => handlePlayerPointerDown(player, e)}
                    onClick={() => {
                      // If this cell is a valid destination for the currently-selected
                      // player (e.g. a pass to this teammate), execute the move instead
                      // of re-selecting the token under the pointer.
                      if (selectedPlayerId && selectedPlayerId !== player.id && isValid) {
                        onExecuteMove(selectedPlayerId, { col, row });
                        return;
                      }
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

      <GhostTrail history={ballHistory} />
      {showPassingLanes && (
        <PassingLanes state={state} selectedPlayerId={selectedPlayerId} />
      )}
      {showTackleZones && <TackleZones state={state} />}
      <InterceptionFlash result={lastMoveResult} />

      {dragLine && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <line
            x1={dragLine.x1}
            y1={dragLine.y1}
            x2={dragLine.x2}
            y2={dragLine.y2}
            stroke="var(--pitch-snap-border, rgba(250, 204, 21, 0.95))"
            strokeWidth={0.9}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={dragLine.x2}
            cy={dragLine.y2}
            r={1.4}
            fill="var(--pitch-snap-border, rgba(250, 204, 21, 0.95))"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
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
