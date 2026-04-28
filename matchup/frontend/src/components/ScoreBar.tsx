import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { GameState, PlayerSide } from '../types';
import type { TeamColors } from '@/lib/team-colors';

interface ScoreBarProps {
  gameState: GameState;
  playerSide: PlayerSide;
  homeTeam: string;
  awayTeam: string;
  league?: string;
  yourColors?: TeamColors;
  oppColors?: TeamColors;
  yourAbbr?: string;
  oppAbbr?: string;
}

const PHASE_NAMES = [
  'KICKOFF',
  'BUILD UP',
  'HIGH PRESS',
  'COUNTER ATTACK',
  'DEEP BLOCK',
  'FINAL PUSH',
  'EXTRA TIME',
];

export default function ScoreBar({
  gameState,
  playerSide,
  homeTeam,
  awayTeam,
  league = 'MATCHUP',
  yourColors,
  oppColors,
  yourAbbr: yourAbbrProp,
  oppAbbr: oppAbbrProp,
}: ScoreBarProps) {
  const navigate = useNavigate();

  const homeScore = gameState.score.home;
  const awayScore = gameState.score.away;

  const isHome = playerSide === 'home';
  const homeIsYou = isHome;

  const homeAbbr = yourAbbrProp && oppAbbrProp
    ? (homeIsYou ? yourAbbrProp : oppAbbrProp)
    : homeTeam.slice(0, 3).toUpperCase();
  const awayAbbr = yourAbbrProp && oppAbbrProp
    ? (homeIsYou ? oppAbbrProp : yourAbbrProp)
    : awayTeam.slice(0, 3).toUpperCase();

  const homeColor = homeIsYou ? yourColors?.primary : oppColors?.primary;
  const awayColor = homeIsYou ? oppColors?.primary : yourColors?.primary;

  const phaseName = PHASE_NAMES[Math.min(gameState.phase - 1, PHASE_NAMES.length - 1)] || `PHASE ${gameState.phase}`;

  const baseMinute = Math.floor(((gameState.phase - 1) / gameState.totalPhases) * 90);
  const turnMinute = Math.floor(((gameState.turn - 1) / gameState.movesPerPhase) * (90 / gameState.totalPhases));
  const displayMinute = Math.min(90, baseMinute + turnMinute);

  return (
    <header className="flex items-center w-full px-3 md:px-5 h-12 md:h-14 bg-surface-container-lowest/80 backdrop-blur-sm shrink-0 hairline-b">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={() => navigate('/')}
          className="p-1 hover:bg-surface-container rounded transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-muted" />
        </button>
        <div className="min-w-0">
          <span className="text-[10px] font-semibold text-muted tracking-wider block truncate">
            {league}
          </span>
          <span className="text-xs md:text-sm font-bold tracking-tight block truncate">
            {phaseName}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4 px-4">
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[8px] md:text-[9px] font-black shrink-0"
            style={{
              backgroundColor: homeColor || '#1B5E35',
              color: (homeIsYou ? yourColors?.text : oppColors?.text) || '#FFF',
            }}
          >
            {homeAbbr.slice(0, 2)}
          </div>
          <span className="text-xs md:text-sm font-bold uppercase tracking-tight text-foreground">
            {homeAbbr}
          </span>
          {homeIsYou && (
            <span className="text-[8px] font-bold text-muted">YOU</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          <span className="text-2xl md:text-3xl font-black tracking-tighter text-foreground tabular-nums">
            {homeScore}
          </span>
          <span className="text-muted text-sm font-light">-</span>
          <span className="text-2xl md:text-3xl font-black tracking-tighter text-foreground tabular-nums">
            {awayScore}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {!homeIsYou && (
            <span className="text-[8px] font-bold text-muted">YOU</span>
          )}
          <span className="text-xs md:text-sm font-bold uppercase tracking-tight text-muted">
            {awayAbbr}
          </span>
          <div
            className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[8px] md:text-[9px] font-black shrink-0"
            style={{
              backgroundColor: awayColor || '#111',
              color: (homeIsYou ? oppColors?.text : yourColors?.text) || '#FFF',
            }}
          >
            {awayAbbr.slice(0, 2)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-1 justify-end">
        <div className="text-right">
          <span className="text-[10px] font-semibold text-muted tracking-wider block">MIN</span>
          <span className="text-sm md:text-base font-black tabular-nums block">
            {displayMinute}'
          </span>
        </div>
      </div>
    </header>
  );
}