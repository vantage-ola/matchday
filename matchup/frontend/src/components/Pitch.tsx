import { useEffect, useState, useMemo } from 'react';
import type { GameState, PlayerNumber, GridPosition } from '../types';
import type { TeamColors } from '@/lib/team-colors';

interface PitchProps {
  gameState: GameState;
  playerSide: PlayerNumber;
  yourColors?: TeamColors;
  oppColors?: TeamColors;
  yourAbbr?: string;
  oppAbbr?: string;
}

// ─── 4-3-3 Formation Template ───────────────────────────────────────────────
interface FormationSlot {
  number: number;
  role: string;
  baseX: number;
  baseY: number;
}

const FORMATION_433: FormationSlot[] = [
  { number: 1,  role: 'GK',  baseX: 5,   baseY: 50 },
  { number: 2,  role: 'RB',  baseX: 22,  baseY: 15 },
  { number: 4,  role: 'CB',  baseX: 18,  baseY: 37 },
  { number: 5,  role: 'CB',  baseX: 18,  baseY: 63 },
  { number: 3,  role: 'LB',  baseX: 22,  baseY: 85 },
  { number: 6,  role: 'CDM', baseX: 38,  baseY: 50 },
  { number: 8,  role: 'CM',  baseX: 45,  baseY: 28 },
  { number: 10, role: 'CM',  baseX: 45,  baseY: 72 },
  { number: 7,  role: 'RW',  baseX: 68,  baseY: 15 },
  { number: 9,  role: 'ST',  baseX: 72,  baseY: 50 },
  { number: 11, role: 'LW',  baseX: 68,  baseY: 85 },
];

interface RenderedPlayer {
  number: number;
  role: string;
  x: number;
  y: number;
  isControlled: boolean;
  hasBall: boolean;
}

function computeFormation(
  template: FormationSlot[],
  ballPos: GridPosition,
  isAttacking: boolean,
  controlledPos: GridPosition,
  isAway: boolean,
  tick: number,
): RenderedPlayer[] {
  const ballShiftX = ((ballPos.col - 5) / 5) * 12;
  const ballShiftY = ((ballPos.row - 5) / 5) * 6;
  const phaseShift = isAttacking ? 8 : -6;

  return template.map((slot, i) => {
    const isControlled = slot.number === 9;
    const hasBall = isControlled && isAttacking;

    let x: number;
    let y: number;

    if (isControlled) {
      x = (controlledPos.col / 10) * 100;
      y = (controlledPos.row / 9) * 100;
    } else {
      x = slot.baseX + ballShiftX + phaseShift;
      y = slot.baseY + ballShiftY;

      if (slot.role === 'GK') {
        x = slot.baseX + ballShiftX * 0.15;
        y = slot.baseY + ballShiftY * 0.2;
      }

      if (['CB', 'LB', 'RB'].includes(slot.role)) {
        x = slot.baseX + ballShiftX * 0.35 + phaseShift * 0.4;
        y = slot.baseY + ballShiftY * 0.4;
      }

      if (slot.role === 'CDM') {
        x = slot.baseX + ballShiftX * 0.55 + phaseShift * 0.6;
        y = slot.baseY + ballShiftY * 0.5;
      }
    }

    const driftX = Math.sin(tick / 40 + i * 2.3) * 0.8;
    const driftY = Math.cos(tick / 35 + i * 1.7) * 0.6;
    x += driftX;
    y += driftY;

    x = Math.max(2, Math.min(98, x));
    y = Math.max(4, Math.min(96, y));

    if (isAway) {
      x = 100 - x;
    }

    return { number: slot.number, role: slot.role, x, y, isControlled, hasBall };
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function Pitch({
  gameState, playerSide, yourColors, oppColors, yourAbbr, oppAbbr,
}: PitchProps) {
  const { ball, players, attackingPlayer } = gameState;
  const [tick, setTick] = useState(0);

  const yourPrimary = yourColors?.primary || '#FFFFFF';
  const yourText = yourColors?.text || '#1a6b37';
  const oppPrimary = oppColors?.primary || '#111111';
  const oppText = oppColors?.text || '#FFFFFF';

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 66);
    return () => clearInterval(interval);
  }, []);

  const isP1 = playerSide === 'p1';
  const oppSide: PlayerNumber = isP1 ? 'p2' : 'p1';

  const yourFormation = useMemo(() => {
    const isAttacking = attackingPlayer === playerSide;
    return computeFormation(
      FORMATION_433, ball.position, isAttacking,
      players[playerSide].position, !isP1, tick,
    );
  }, [ball.position, players, attackingPlayer, playerSide, isP1, tick]);

  const oppFormation = useMemo(() => {
    const isAttacking = attackingPlayer === oppSide;
    return computeFormation(
      FORMATION_433, ball.position, isAttacking,
      players[oppSide].position, isP1, tick,
    );
  }, [ball.position, players, attackingPlayer, oppSide, isP1, tick]);

  const carrierFormation = ball.carrier === playerSide ? yourFormation : oppFormation;
  const carrierPlayer = carrierFormation.find((p) => p.isControlled);
  const ballPercent = carrierPlayer
    ? { x: carrierPlayer.x, y: carrierPlayer.y }
    : { x: (ball.position.col / 10) * 100, y: (ball.position.row / 9) * 100 };

  return (
    <div className="w-full h-full flex items-center justify-center select-none bg-[#14532d]">
      <div
        className="relative bg-[#1a6b37] pitch-stripes overflow-hidden w-full"
        style={{ aspectRatio: '16 / 10', maxHeight: '100%' }}
      >
        {/* Pitch Markings */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1000 625"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect x="30" y="20" width="940" height="585" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <line x1="500" y1="20" x2="500" y2="605" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <circle cx="500" cy="312" r="70" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <circle cx="500" cy="312" r="3" fill="rgba(255,255,255,0.35)" />
          <rect x="30" y="152" width="130" height="320" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <rect x="30" y="222" width="50" height="180" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <circle cx="120" cy="312" r="3" fill="rgba(255,255,255,0.35)" />
          <path d="M 160 252 A 60 60 0 0 1 160 372" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <rect x="840" y="152" width="130" height="320" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <rect x="920" y="222" width="50" height="180" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <circle cx="880" cy="312" r="3" fill="rgba(255,255,255,0.35)" />
          <path d="M 840 252 A 60 60 0 0 0 840 372" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <path d="M 30 30 A 10 10 0 0 0 40 20" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <path d="M 960 20 A 10 10 0 0 0 970 30" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <path d="M 30 595 A 10 10 0 0 1 40 605" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <path d="M 960 605 A 10 10 0 0 1 970 595" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
        </svg>

        {/* Team labels at each end */}
        <div className="absolute left-[3%] top-1/2 -translate-y-1/2 z-[5]">
          <div
            className="px-2 py-1 rounded-sm text-[9px] md:text-[10px] font-black tracking-[0.15em]"
            style={{
              backgroundColor: isP1 ? `${oppPrimary}CC` : `${yourPrimary}CC`,
              color: isP1 ? oppText : yourText,
            }}
          >
            {isP1 ? oppAbbr || 'OPP' : yourAbbr || 'YOU'}
          </div>
        </div>
        <div className="absolute right-[3%] top-1/2 -translate-y-1/2 z-[5]">
          <div
            className="px-2 py-1 rounded-sm text-[9px] md:text-[10px] font-black tracking-[0.15em]"
            style={{
              backgroundColor: isP1 ? `${yourPrimary}CC` : `${oppPrimary}CC`,
              color: isP1 ? yourText : oppText,
            }}
          >
            {isP1 ? yourAbbr || 'YOU' : oppAbbr || 'OPP'}
          </div>
        </div>

        {/* Your Team */}
        {yourFormation.map((player) => (
          <div
            key={`your-${player.number}`}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${player.x}%`,
              top: `${player.y}%`,
              transition: 'left 600ms cubic-bezier(.4,0,.2,1), top 600ms cubic-bezier(.4,0,.2,1)',
              willChange: 'left, top',
              zIndex: player.isControlled ? 20 : 10,
            }}
          >
            <div
              className="rounded-full flex items-center justify-center font-bold transition-all duration-300 text-[10px] md:text-xs"
              style={{
                width: player.isControlled ? '2.75rem' : '1.75rem',
                height: player.isControlled ? '2.75rem' : '1.75rem',
                backgroundColor: player.role === 'GK' ? '#f59e0b' : yourPrimary,
                color: player.role === 'GK' ? '#000' : yourText,
                boxShadow: player.isControlled ? `0 0 14px ${yourPrimary}88` : 'none',
                border: player.isControlled ? '2px solid rgba(255,255,255,0.5)' : 'none',
              }}
            >
              {player.number}
            </div>
            {player.hasBall && (
              <div className="absolute left-1/2 -translate-x-1/2 -top-5 whitespace-nowrap">
                <span className="text-[8px] md:text-[9px] font-black text-white/80 tracking-[0.15em] bg-white/10 px-1.5 py-0.5 rounded-sm">
                  BALL
                </span>
              </div>
            )}
          </div>
        ))}

        {/* Opponent Team */}
        {oppFormation.map((player) => (
          <div
            key={`opp-${player.number}`}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${player.x}%`,
              top: `${player.y}%`,
              transition: 'left 600ms cubic-bezier(.4,0,.2,1), top 600ms cubic-bezier(.4,0,.2,1)',
              willChange: 'left, top',
              zIndex: player.isControlled ? 20 : 10,
            }}
          >
            <div
              className="rounded-full flex items-center justify-center font-bold transition-all duration-300 text-[10px] md:text-xs"
              style={{
                width: player.isControlled ? '2.75rem' : '1.75rem',
                height: player.isControlled ? '2.75rem' : '1.75rem',
                backgroundColor: player.role === 'GK' ? '#ea580c' : oppPrimary,
                color: player.role === 'GK' ? '#fff' : oppText,
                border: player.isControlled ? '2px solid rgba(255,255,255,0.2)' : 'none',
              }}
            >
              {player.number}
            </div>
          </div>
        ))}

        {/* Ball */}
        <div
          className="absolute w-3 h-3 md:w-3.5 md:h-3.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.7)] transform -translate-x-1/2 -translate-y-1/2 z-30"
          style={{
            left: `${ballPercent.x}%`,
            top: `${ballPercent.y}%`,
            transition: 'left 500ms cubic-bezier(.4,0,.2,1), top 500ms cubic-bezier(.4,0,.2,1)',
            willChange: 'left, top',
          }}
        />
      </div>
    </div>
  );
}
