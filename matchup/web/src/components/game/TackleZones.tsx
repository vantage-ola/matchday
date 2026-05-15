import { useMemo } from 'react';
import {
  type GameState,
  ROWS,
  rowToNum,
  gridDistance,
  previewTackle,
} from '@/lib/engine';

interface TackleZonesProps {
  state: GameState;
}

const COLS_COUNT = 22;
const ROWS_COUNT = ROWS.length;

// On a 22:11 pitch, (1/COLS_COUNT) of width == (1/ROWS_COUNT) of height in pixels,
// so these two percentages produce a visually square (circular) element.
const RING_W = `${100 / COLS_COUNT}%`;
const RING_H = `${100 / ROWS_COUNT}%`;

function threatStyle(pct: number): { bg: string; ring: string } {
  if (pct >= 60) return { bg: '#dc2626', ring: 'rgba(220,38,38,0.55)' };
  if (pct >= 35) return { bg: '#d97706', ring: 'rgba(217,119,6,0.55)' };
  return { bg: '#16a34a', ring: 'rgba(22,163,74,0.55)' };
}

export function TackleZones({ state }: TackleZonesProps) {
  const carrier = useMemo(
    () => state.players.find((p) => p.id === state.ballCarrierId) ?? null,
    [state.players, state.ballCarrierId],
  );

  const adjacentDefenders = useMemo(() => {
    if (!carrier) return [];
    return state.players.filter(
      (p) => p.team !== carrier.team && gridDistance(p.position, carrier.position) === 1,
    );
  }, [state.players, carrier]);

  if (!carrier || adjacentDefenders.length === 0) return null;

  return (
    <>
      {adjacentDefenders.map((d) => {
        const pct = Math.round(previewTackle(state, d.id).successProbability * 100);
        const rIdx = rowToNum(d.position.row);
        const left = `${((d.position.col - 0.5) / COLS_COUNT) * 100}%`;
        const top = `${((rIdx + 0.5) / ROWS_COUNT) * 100}%`;
        const { bg, ring } = threatStyle(pct);
        const flipBelow = rIdx < 2;

        return (
          <div key={d.id}>
            {/* True circle: width/height resolve to identical pixel sizes on 22:11 */}
            <div
              className="pointer-events-none absolute rounded-full"
              style={{
                left,
                top,
                width: RING_W,
                height: RING_H,
                transform: 'translate(-50%, -50%)',
                border: `1.5px solid ${ring}`,
                animation: 'tackle-zone-pulse 1.4s ease-in-out infinite',
              }}
            />

            {/* Badge — positioned above (or below for top-edge defenders) */}
            <div
              className="pointer-events-none absolute"
              style={{
                left,
                top,
                transform: flipBelow
                  ? 'translate(-50%, 18px)'
                  : 'translate(-50%, calc(-100% - 14px))',
              }}
            >
              <span
                className="block rounded-full px-1.5 py-px text-[9px] font-bold leading-none tracking-wide text-white tabular-nums"
                style={{ backgroundColor: bg }}
              >
                {pct}%
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}
