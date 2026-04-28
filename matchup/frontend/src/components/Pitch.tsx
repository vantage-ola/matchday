import { useState, useCallback, useRef, useMemo } from 'react';
import type { GameState, PlayerSide, GridPosition, PlayerCap, Formation, AttackerAction, DefenderAction, GameMove } from '../types';
import type { TeamColors } from '@/lib/team-colors';
import { resolveCapName, formatAction } from '@/lib/game-utils';
import { cn } from '@/lib/utils';

interface PitchProps {
  gameState: GameState;
  playerSide: PlayerSide;
  yourColors?: TeamColors;
  oppColors?: TeamColors;
  yourAbbr?: string;
  oppAbbr?: string;
  onMoveSelect?: (move: GameMove) => void;
  selectedMove?: GameMove | null;
  disabled?: boolean;
}

const PITCH_COLS = 15;
const PITCH_ROWS = 9;
const CELL_W = 1500 / (PITCH_COLS - 1);
const CELL_H = 900 / (PITCH_ROWS - 1);

function gridToPercent(col: number, row: number): { x: number; y: number } {
  return {
    x: (col / (PITCH_COLS - 1)) * 100,
    y: (row / (PITCH_ROWS - 1)) * 100,
  };
}

function percentToGrid(x: number, y: number): GridPosition {
  return {
    col: Math.round((x / 100) * (PITCH_COLS - 1)),
    row: Math.round((y / 100) * (PITCH_ROWS - 1)),
  };
}

function getCapName(name: string, number: number): string {
  if (name && name !== `GK ${number}` && name !== `DEF ${number}` && name !== `MID ${number}` && name !== `FWD ${number}`) {
    const parts = name.split(' ');
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
    return name.substring(0, 3).toUpperCase();
  }
  return String(number);
}

function determineAttackerAction(
  fromCap: PlayerCap,
  toPosition: GridPosition,
  allCaps: PlayerCap[],
  attackingSide: PlayerSide
): AttackerAction {
  const forward = attackingSide === 'home' ? 1 : -1;
  const targetCap = allCaps.find((c) => c.position.col === toPosition.col && c.position.row === toPosition.row && c.id !== fromCap.id);

  const distance = Math.sqrt(Math.pow(toPosition.col - fromCap.position.col, 2) + Math.pow(toPosition.row - fromCap.position.row, 2));
  const forwardDistance = (toPosition.col - fromCap.position.col) * forward;

  if (targetCap) {
    if (forwardDistance > 2) {
      return 'through_pass';
    }
    return 'pass';
  }

  if (distance > 8) {
    return 'long_ball';
  }

  if (attackingSide === 'home' ? toPosition.col >= 12 : toPosition.col <= 2) {
    return 'shoot';
  }

  return 'run';
}

function determineDefenderAction(
  fromCap: PlayerCap,
  toPosition: GridPosition,
  ballPosition: GridPosition,
  attackingSide: PlayerSide
): DefenderAction {
  const forward = attackingSide === 'home' ? 1 : -1;
  const distanceToBall = Math.sqrt(Math.pow(toPosition.col - ballPosition.col, 2) + Math.pow(toPosition.row - ballPosition.row, 2));

  if ((toPosition.col - fromCap.position.col) * forward < 0 && fromCap.role === 'def') {
    return 'track_back';
  }

  if (distanceToBall <= 2) {
    return 'press';
  }

  if ((toPosition.col - ballPosition.col) * forward > 0) {
    return 'intercept';
  }

  return 'hold_shape';
}

export default function Pitch({
  gameState,
  playerSide,
  yourColors,
  oppColors,
  yourAbbr = 'YOU',
  oppAbbr = 'OPP',
  onMoveSelect,
  selectedMove,
  disabled = false,
}: PitchProps) {
  const { ball, formations, attackingSide } = gameState;
  const [dragStart, setDragStart] = useState<{ capId: string; x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const isAttacker = attackingSide === playerSide;
  const yourFormation: Formation = playerSide === 'home' ? formations.home : formations.away;
  const oppFormation: Formation = playerSide === 'home' ? formations.away : formations.home;

  const yourCaps = yourFormation.caps;
  const oppCaps = oppFormation.caps;

  const ballCarrier = [...yourCaps, ...oppCaps].find((c) => c.id === ball.carrierCapId);
  const canInteract = !disabled;

  const yourPrimary = yourColors?.primary || '#2563eb';
  const yourText = yourColors?.text || '#ffffff';
  const oppPrimary = oppColors?.primary || '#dc2626';
  const oppText = oppColors?.text || '#ffffff';

  const snappedTarget = useMemo(() => {
    if (!dragEnd) return null;
    const grid = percentToGrid(dragEnd.x, dragEnd.y);
    const percent = gridToPercent(grid.col, grid.row);
    return { grid, percent };
  }, [dragEnd]);

  const moveBadgeText = useMemo(() => {
    if (!selectedMove) return null;
    const name = resolveCapName(selectedMove.fromCapId, gameState);
    const action = formatAction(selectedMove.action);
    return `${name}: ${action}`;
  }, [selectedMove, gameState]);

  const handlePointerDown = useCallback(
    (capId: string, e: React.PointerEvent) => {
      if (!canInteract || isDragging) return;

      const cap = [...yourCaps, ...oppCaps].find((c) => c.id === capId);
      if (!cap) return;

      if (isAttacker) {
        if (cap.id !== ball.carrierCapId) return;
      } else {
        if (cap.side !== playerSide) return;
      }

      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      setDragStart({ capId, x, y });
      setIsDragging(true);
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [canInteract, isDragging, yourCaps, oppCaps, ball.carrierCapId, isAttacker, playerSide]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !dragStart) return;

      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      setDragEnd({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
    },
    [isDragging, dragStart]
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent) => {
      if (!isDragging || !dragStart || !dragEnd || !onMoveSelect) {
        setDragStart(null);
        setDragEnd(null);
        setIsDragging(false);
        return;
      }

      const fromCap = [...yourCaps, ...oppCaps].find((c) => c.id === dragStart.capId);
      if (!fromCap) {
        setDragStart(null);
        setDragEnd(null);
        setIsDragging(false);
        return;
      }

      const toPosition = percentToGrid(dragEnd.x, dragEnd.y);

      if (isAttacker) {
        const action = determineAttackerAction(fromCap, toPosition, [...yourCaps, ...oppCaps], attackingSide);
        const move: GameMove = {
          side: 'attacker',
          fromCapId: fromCap.id,
          toPosition,
          action,
        };
        onMoveSelect(move);
      } else {
        const action = determineDefenderAction(fromCap, toPosition, ball.position, attackingSide);
        const move: GameMove = {
          side: 'defender',
          fromCapId: fromCap.id,
          toPosition,
          action,
        };
        onMoveSelect(move);
      }

      setDragStart(null);
      setDragEnd(null);
      setIsDragging(false);
    },
    [isDragging, dragStart, dragEnd, onMoveSelect, yourCaps, oppCaps, isAttacker, attackingSide, ball.position]
  );

  const ballPercent = ballCarrier ? gridToPercent(ballCarrier.position.col, ballCarrier.position.row) : gridToPercent(ball.position.col, ball.position.row);

  return (
    <div className="w-full h-full flex items-center justify-center select-none bg-[#14532d]">
      <div
        className="relative bg-[#1a6b37] pitch-stripes overflow-hidden w-full"
        style={{ aspectRatio: '15 / 9', maxHeight: '100%' }}
      >
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1500 900"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <marker
              id="dragArrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path
                d="M 0 0 L 8 4 L 0 8 z"
                fill={isAttacker ? 'rgba(255,215,0,0.9)' : 'rgba(255,100,100,0.9)'}
              />
            </marker>
          </defs>

          <rect x="25" y="25" width="1450" height="850" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
          <line x1="750" y1="25" x2="750" y2="875" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
          <circle cx="750" cy="450" r="90" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
          <circle cx="750" cy="450" r="5" fill="rgba(255,255,255,0.35)" />
          <rect x="25" y="200" width="180" height="500" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
          <rect x="25" y="300" width="80" height="300" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
          <circle cx="100" cy="450" r="5" fill="rgba(255,255,255,0.35)" />
          <rect x="1295" y="200" width="180" height="500" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
          <rect x="1395" y="300" width="80" height="300" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
          <circle cx="1400" cy="450" r="5" fill="rgba(255,255,255,0.35)" />

          {dragStart && dragEnd && snappedTarget && (
            <>
              {/* Highlighted destination cell */}
              <rect
                x={snappedTarget.percent.x / 100 * 1500 - CELL_W / 2}
                y={snappedTarget.percent.y / 100 * 900 - CELL_H / 2}
                width={CELL_W}
                height={CELL_H}
                fill={isAttacker ? 'rgba(255,215,0,0.15)' : 'rgba(255,100,100,0.15)'}
                stroke={isAttacker ? 'rgba(255,215,0,0.4)' : 'rgba(255,100,100,0.4)'}
                strokeWidth="2"
                rx="4"
              />
              {/* Direction arrow */}
              <line
                x1={(dragStart.x / 100) * 1500}
                y1={(dragStart.y / 100) * 900}
                x2={snappedTarget.percent.x / 100 * 1500}
                y2={snappedTarget.percent.y / 100 * 900}
                stroke={isAttacker ? 'rgba(255,215,0,0.8)' : 'rgba(255,100,100,0.8)'}
                strokeWidth="4"
                markerEnd="url(#dragArrow)"
              />
              {/* Ghost cap at destination */}
              <circle
                cx={snappedTarget.percent.x / 100 * 1500}
                cy={snappedTarget.percent.y / 100 * 900}
                r="22"
                fill="none"
                stroke={isAttacker ? 'rgba(255,215,0,0.6)' : 'rgba(255,100,100,0.6)'}
                strokeWidth="3"
                strokeDasharray="6,4"
              />
            </>
          )}
        </svg>

        {/* Selected move badge */}
        {moveBadgeText && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-black/70 px-3 py-1.5 rounded-full">
            <span className="text-[10px] md:text-[11px] font-bold text-white uppercase tracking-wider">
              {moveBadgeText}
            </span>
          </div>
        )}

        {/* Your team caps */}
        {yourCaps.map((cap) => {
          const pos = gridToPercent(cap.position.col, cap.position.row);
          const isBallCarrier = cap.id === ball.carrierCapId;
          const isSelected = selectedMove?.fromCapId === cap.id;
          const isDraggable = canInteract && (isAttacker ? isBallCarrier : true);

          return (
            <div
              key={cap.id}
              className={cn(
                'absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300',
                isDraggable && 'cursor-grab active:cursor-grabbing',
                !isDraggable && !isBallCarrier && 'opacity-60'
              )}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                zIndex: isBallCarrier ? 30 : 15,
              }}
              onPointerDown={(e) => isDraggable && handlePointerDown(cap.id, e)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <div
                className={cn(
                  'rounded-full flex flex-col items-center justify-center font-bold transition-all duration-300',
                  isSelected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-black',
                  isBallCarrier && 'ring-2 ring-yellow-400',
                  isDraggable && !isSelected && !isBallCarrier && 'ring-1 ring-white/30 animate-pulse'
                )}
                style={{
                  width: isBallCarrier ? '3rem' : '2.25rem',
                  height: isBallCarrier ? '3rem' : '2.25rem',
                  backgroundColor: cap.role === 'gk' ? (yourColors?.secondary || '#f59e0b') : yourPrimary,
                  color: yourText,
                  boxShadow: isBallCarrier ? `0 0 20px ${yourPrimary}cc` : 'none',
                }}
              >
                <span className="text-[10px] md:text-[11px]">{getCapName(cap.name, cap.shirtNumber)}</span>
                {cap.role !== 'gk' && (
                  <span className="text-[8px] md:text-[9px] opacity-70">{cap.shirtNumber}</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Opponent caps */}
        {oppCaps.map((cap) => {
          const pos = gridToPercent(cap.position.col, cap.position.row);
          const isBallCarrier = cap.id === ball.carrierCapId;

          return (
            <div
              key={cap.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 opacity-80"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                zIndex: isBallCarrier ? 30 : 15,
              }}
            >
              <div
                className={cn(
                  'rounded-full flex flex-col items-center justify-center font-bold transition-all duration-300',
                  isBallCarrier && 'ring-2 ring-yellow-400'
                )}
                style={{
                  width: isBallCarrier ? '3rem' : '2.25rem',
                  height: isBallCarrier ? '3rem' : '2.25rem',
                  backgroundColor: cap.role === 'gk' ? (oppColors?.secondary || '#f59e0b') : oppPrimary,
                  color: oppText,
                  boxShadow: isBallCarrier ? `0 0 20px ${oppPrimary}cc` : 'none',
                }}
              >
                <span className="text-[10px] md:text-[11px]">{getCapName(cap.name, cap.shirtNumber)}</span>
                {cap.role !== 'gk' && (
                  <span className="text-[8px] md:text-[9px] opacity-70">{cap.shirtNumber}</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Ball */}
        <div
          className="absolute w-3.5 h-3.5 md:w-4 md:h-4 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.8)] transform -translate-x-1/2 -translate-y-1/2 z-40"
          style={{
            left: `${ballPercent.x}%`,
            top: `${ballPercent.y}%`,
            transition: 'left 500ms cubic-bezier(.4,0,.2,1), top 500ms cubic-bezier(.4,0,.2,1)',
          }}
        />

        {/* Corner labels */}
        <div className="absolute left-2 top-2 md:top-3 z-10 flex flex-col items-start gap-0.5">
          <div
            className="px-2 py-1 rounded-sm text-[9px] md:text-[10px] font-black tracking-[0.15em]"
            style={{
              backgroundColor: playerSide === 'home' ? `${yourPrimary}CC` : `${oppPrimary}CC`,
              color: playerSide === 'home' ? yourText : oppText,
            }}
          >
            {playerSide === 'home' ? yourAbbr : oppAbbr}
          </div>
          <span className="text-[7px] md:text-[8px] font-bold text-white/60 tracking-wider pl-0.5">
            {playerSide === 'home'
              ? (isAttacker ? 'ATK' : 'DEF')
              : ''}
          </span>
        </div>
        <div className="absolute right-2 top-2 md:top-3 z-10 flex flex-col items-end gap-0.5">
          <div
            className="px-2 py-1 rounded-sm text-[9px] md:text-[10px] font-black tracking-[0.15em]"
            style={{
              backgroundColor: playerSide === 'away' ? `${yourPrimary}CC` : `${oppPrimary}CC`,
              color: playerSide === 'away' ? yourText : oppText,
            }}
          >
            {playerSide === 'away' ? yourAbbr : oppAbbr}
          </div>
          <span className="text-[7px] md:text-[8px] font-bold text-white/60 tracking-wider pr-0.5">
            {playerSide === 'away'
              ? (isAttacker ? 'ATK' : 'DEF')
              : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
