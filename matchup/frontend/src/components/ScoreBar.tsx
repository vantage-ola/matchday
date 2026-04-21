import type { GameState, PlayerNumber } from '../types';

interface ScoreBarProps {
  gameState: GameState;
  playerSide: PlayerNumber;
  homeTeam: string;
  awayTeam: string;
}

export default function ScoreBar({
  gameState,
  playerSide,
  homeTeam,
  awayTeam,
}: ScoreBarProps) {
  const isHome = playerSide === 'p1';

  const homeScore = isHome ? gameState.score.p1 : gameState.score.p2;
  const awayScore = isHome ? gameState.score.p2 : gameState.score.p1;

  const yourTeam = isHome ? homeTeam : awayTeam;
  const oppTeam = isHome ? awayTeam : homeTeam;

  return (
    <header className="flex justify-between items-center w-full px-4 h-16 hairline-b bg-surface-container-low shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-primary-container rounded" />
          <span className="text-sm font-bold uppercase tracking-tight">{yourTeam}</span>
        </div>
        <span className="text-display text-primary">{homeScore}</span>
      </div>

      <div className="flex flex-col items-center">
        <span className="text-label text-muted">Phase {gameState.phase} of {gameState.totalPhases}</span>
        <div className="px-3 py-1 bg-surface-container-highest text-foreground text-label font-bold mt-1">
          LIVE
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-display text-foreground">{awayScore}</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold uppercase tracking-tight">{oppTeam}</span>
          <div className="w-4 h-4 bg-tertiary-fixed rounded" />
        </div>
      </div>
    </header>
  );
}
