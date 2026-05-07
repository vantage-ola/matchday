import { useMemo } from 'react';
import {
  type GameState,
  type Player,
  ROWS,
  rowToNum,
  getPassTargets,
} from '@/lib/engine';

interface PassingLanesProps {
  state: GameState;
  selectedPlayerId: string | null;
}

const COLS_COUNT = 22;
const ROWS_COUNT = ROWS.length;

function cellCenter(col: number, row: string): { x: number; y: number } {
  const x = ((col - 0.5) / COLS_COUNT) * 100;
  const rIdx = rowToNum(row);
  const y = ((rIdx + 0.5) / ROWS_COUNT) * 100;
  return { x, y };
}

const STROKE_BY_RISK = {
  clear: 'rgba(34, 197, 94, 0.85)',
  risk: 'rgba(255, 179, 0, 0.85)',
  blocked: 'rgba(225, 29, 72, 0.85)',
} as const;

export function PassingLanes({ state, selectedPlayerId }: PassingLanesProps) {
  const carrier = useMemo<Player | null>(() => {
    if (!selectedPlayerId) return null;
    const p = state.players.find((pl) => pl.id === selectedPlayerId);
    if (!p || !p.hasBall || p.team !== state.possession) return null;
    return p;
  }, [state.players, state.possession, selectedPlayerId]);

  const targets = useMemo(() => {
    if (!carrier) return [];
    return getPassTargets(state, carrier.id);
  }, [state, carrier]);

  if (!carrier || targets.length === 0) return null;

  const from = cellCenter(carrier.position.col, carrier.position.row);

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {targets.map((t) => {
        let endCol = t.to.col;
        let endRow = t.to.row;
        if (t.lineRisk === 'blocked' && t.interceptorId) {
          const interceptor = state.players.find((p) => p.id === t.interceptorId);
          if (interceptor) {
            endCol = interceptor.position.col;
            endRow = interceptor.position.row;
          }
        }
        const to = cellCenter(endCol, endRow);
        const stroke = STROKE_BY_RISK[t.lineRisk];
        const dasharray = t.lineRisk === 'blocked' ? '1.2 0.8' : undefined;

        return (
          <g key={t.playerId}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={stroke}
              strokeWidth={0.6}
              strokeLinecap="round"
              strokeDasharray={dasharray}
              vectorEffect="non-scaling-stroke"
              opacity={0.85}
            />
            <circle
              cx={to.x}
              cy={to.y}
              r={0.9}
              fill={stroke}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}
