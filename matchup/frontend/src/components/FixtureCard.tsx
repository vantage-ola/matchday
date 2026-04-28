import { getTeamColors, getTeamAbbr } from '@/lib/team-colors';
import { Button } from '@/components/ui/button';

interface Fixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  league: string;
  kickoffAt: string;
  status: 'scheduled' | 'live' | 'finished';
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  venue?: string;
}

interface FixtureCardProps {
  fixture: Fixture;
  onJoin?: () => void;
}

export function FixtureCard({ fixture, onJoin }: FixtureCardProps) {
  const isLive = fixture.status === 'live';
  const kickoffTime = new Date(fixture.kickoffAt);
  const timeStr = kickoffTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });

  const homeColors = getTeamColors(fixture.homeTeam);
  const awayColors = getTeamColors(fixture.awayTeam);
  const homeAbbr = getTeamAbbr(fixture.homeTeam);
  const awayAbbr = getTeamAbbr(fixture.awayTeam);

  return (
    <article className="bg-surface-container-low border border-outline-variant/20 rounded overflow-hidden flex flex-col min-w-[280px]">
      {isLive && (
        <div className="absolute top-0 left-0 w-full h-1 bg-tertiary-fixed" />
      )}

      <div className="p-4 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-high">
        <span className="text-[10px] uppercase tracking-wider font-bold text-primary">{fixture.league}</span>
        {isLive ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tertiary-fixed animate-pulse" />
            <span className="text-[10px] uppercase tracking-wider text-tertiary-fixed font-bold">{fixture.minute}'</span>
          </div>
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-muted">{timeStr}</span>
        )}
      </div>

      <div className="p-6 flex items-center justify-between">
        <div className="flex flex-col items-center gap-3 w-1/3">
          {fixture.homeTeamLogo ? (
            <img
              src={fixture.homeTeamLogo}
              alt={fixture.homeTeam}
              className="w-12 h-12 object-contain"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full bg-surface-container-highest border border-outline-variant/30 flex items-center justify-center font-bold text-lg"
              style={{ backgroundColor: homeColors.primary, color: homeColors.text }}
            >
              {homeAbbr}
            </div>
          )}
          <span className="font-bold text-sm text-center">{fixture.homeTeam}</span>
        </div>

        <div className="flex flex-col items-center justify-center w-1/3">
          {isLive ? (
            <span className="text-3xl font-black tracking-tight text-primary">
              {fixture.homeScore}-{fixture.awayScore}
            </span>
          ) : (
            <span className="text-3xl font-black tracking-tight text-foreground">VS</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 w-1/3">
          {fixture.awayTeamLogo ? (
            <img
              src={fixture.awayTeamLogo}
              alt={fixture.awayTeam}
              className="w-12 h-12 object-contain"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full bg-surface-container-highest border border-outline-variant/30 flex items-center justify-center font-bold text-lg"
              style={{ backgroundColor: awayColors.primary, color: awayColors.text }}
            >
              {awayAbbr}
            </div>
          )}
          <span className="font-bold text-sm text-center">{fixture.awayTeam}</span>
        </div>
      </div>

      <div className="p-4 border-t border-outline-variant/20 flex justify-between items-center bg-surface-container">
        {fixture.venue ? (
          <span className="text-[10px] uppercase tracking-wider text-muted">{fixture.venue}</span>
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-muted">TBA</span>
        )}
        {onJoin && fixture.status === 'scheduled' && (
          <Button
            onClick={onJoin}
            variant="primary"
            size="sm"
            className="text-[10px] uppercase tracking-wider rounded-sm h-8"
          >
            JOIN
          </Button>
        )}
        {isLive && (
          <span className="text-[10px] uppercase tracking-wider text-tertiary-fixed font-bold">IN PROGRESS</span>
        )}
      </div>
    </article>
  );
}
