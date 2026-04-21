import type { GameState, PlayerNumber } from '../types';
import { cn } from '@/lib/utils';

interface PitchProps {
  gameState: GameState;
  playerSide: PlayerNumber;
}

export default function Pitch({ gameState, playerSide }: PitchProps) {
  const { ball, players } = gameState;
  const isP1 = playerSide === 'p1';

  const p1Position = players.p1.position;
  const p2Position = players.p2.position;

  const gridToPercent = (col: number, row: number) => ({
    x: (col / 10) * 100,
    y: (row / 9) * 100,
  });

  const ballPos = gridToPercent(ball.position.col, ball.position.row);
  const p1Pos = gridToPercent(p1Position.col, p1Position.row);
  const p2Pos = gridToPercent(p2Position.col, p2Position.row);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 relative bg-primary-container pitch-pattern rounded overflow-hidden">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <line x1="50" y1="0" x2="50" y2="100" stroke="white" strokeOpacity="0.5" strokeWidth="0.3" />
          <circle cx="50" cy="50" r="10" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.3" />
          <circle cx="50" cy="50" r="0.5" fill="white" fillOpacity="0.5" />
          
          <rect x="0" y="25" width="12" height="50" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.3" />
          <rect x="0" y="35" width="5" height="30" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.3" />
          <circle cx="8" cy="50" r="0.5" fill="white" fillOpacity="0.5" />
          
          <rect x="88" y="25" width="12" height="50" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.3" />
          <rect x="95" y="35" width="5" height="30" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.3" />
          <circle cx="92" cy="50" r="0.5" fill="white" fillOpacity="0.5" />
          
          <path d="M 12 40 A 3 3 0 0 1 12 60" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.3" />
          <path d="M 88 40 A 3 3 0 0 0 88 60" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.3" />
        </svg>

        <div
          className={cn(
            "absolute w-3 h-3 rounded-full border-2 border-primary-container transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300",
            isP1 ? "bg-white" : "bg-tertiary-fixed"
          )}
          style={{ left: `${isP1 ? p1Pos.x : p2Pos.x}%`, top: `${isP1 ? p1Pos.y : p2Pos.y}%` }}
        >
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-primary-container">
            {isP1 ? 'Y' : 'O'}
          </span>
        </div>

        <div
          className={cn(
            "absolute w-3 h-3 rounded-full border-2 border-primary-container transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300",
            isP1 ? "bg-tertiary-fixed" : "bg-white"
          )}
          style={{ left: `${isP1 ? p2Pos.x : p1Pos.x}%`, top: `${isP1 ? p2Pos.y : p1Pos.y}%` }}
        >
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-primary-container">
            {isP1 ? 'O' : 'Y'}
          </span>
        </div>

        <div
          className="absolute w-2 h-2 bg-white transform -translate-x-1/2 -translate-y-1/2 rotate-45 transition-all duration-300"
          style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%` }}
        />
      </div>
    </div>
  );
}
