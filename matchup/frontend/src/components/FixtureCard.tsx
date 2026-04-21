interface Fixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
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
  const timeStr = kickoffTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <article className="bg-surface-container-low border border-outline-variant/20 rounded overflow-hidden flex flex-col min-w-[280px]">
      {isLive && (
        <div className="absolute top-0 left-0 w-full h-1 bg-tertiary-fixed" />
      )}

      <div className="p-4 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-high">
        <span className="text-label text-primary font-bold">{fixture.league}</span>
        {isLive ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tertiary-fixed animate-pulse" />
            <span className="text-label text-tertiary-fixed font-bold">{fixture.minute}'</span>
          </div>
        ) : (
          <span className="text-label text-muted">{timeStr}</span>
        )}
      </div>

      <div className="p-6 flex items-center justify-between">
        <div className="flex flex-col items-center gap-3 w-1/3">
          <div className="w-12 h-12 rounded-full bg-surface-container-highest border border-outline-variant/30 flex items-center justify-center font-bold text-lg">
            {fixture.homeTeamAbbr || fixture.homeTeam.slice(0, 3).toUpperCase()}
          </div>
          <span className="text-title text-center">{fixture.homeTeam}</span>
        </div>

        <div className="flex flex-col items-center justify-center w-1/3">
          {isLive ? (
            <span className="text-display text-primary">
              {fixture.homeScore}-{fixture.awayScore}
            </span>
          ) : (
            <span className="text-display text-foreground">VS</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 w-1/3">
          <div className="w-12 h-12 rounded-full bg-surface-container-highest border border-outline-variant/30 flex items-center justify-center font-bold text-lg">
            {fixture.awayTeamAbbr || fixture.awayTeam.slice(0, 3).toUpperCase()}
          </div>
          <span className="text-title text-center">{fixture.awayTeam}</span>
        </div>
      </div>

      <div className="p-4 border-t border-outline-variant/20 flex justify-between items-center bg-surface-container">
        {fixture.venue && (
          <span className="text-label-xs text-muted">{fixture.venue}</span>
        )}
        {onJoin && fixture.status === 'scheduled' && (
          <button
            onClick={onJoin}
            className="text-label bg-primary-container text-on-primary px-3 py-1.5 hover:bg-primary-container/90 transition-colors"
          >
            JOIN
          </button>
        )}
        {isLive && (
          <span className="text-label text-tertiary-fixed font-bold">IN PROGRESS</span>
        )}
      </div>
    </article>
  );
}
