import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layouts';
import { cn } from '@/lib/utils';

interface FixtureData {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  league: string;
  kickoffAt: string;
  status: string;
  venue?: string;
}

interface LobbyStatus {
  status: string;
  homeCount: number;
  awayCount: number;
}

const MOCK_FIXTURE: FixtureData = {
  id: '1',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  homeTeamAbbr: 'ARS',
  awayTeamAbbr: 'CHE',
  league: 'PREMIER LEAGUE',
  kickoffAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  status: 'scheduled',
  venue: 'Emirates Stadium',
};

const MOCK_LOBBY: LobbyStatus = {
  status: 'open',
  homeCount: 4,
  awayCount: 2,
};

export default function Fixture() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [fixture] = useState<FixtureData | null>(MOCK_FIXTURE);
  const [lobby] = useState<LobbyStatus | null>(MOCK_LOBBY);
  const [selectedSide, setSelectedSide] = useState<'home' | 'away'>('home');
  const [stake, setStake] = useState(100);
  const [gameMode, setGameMode] = useState<'matchup_only' | 'real_match'>('matchup_only');
  const [balance] = useState(4250);

  useEffect(() => {
    // TODO: Fetch fixture and lobby status
  }, [id]);

  const handleJoin = async () => {
    // TODO: Call POST /api/fixtures/:id/join
    // For now, just navigate to a mock matchup
    navigate('/matchup/mock-session');
  };

  if (!fixture) {
    return (
      <PageLayout balance={balance}>
        <div className="flex items-center justify-center h-64">
          <span className="text-label text-muted">LOADING...</span>
        </div>
      </PageLayout>
    );
  }

  const kickoffTime = new Date(fixture.kickoffAt);
  const timeStr = kickoffTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dateStr = kickoffTime.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <PageLayout balance={balance}>
      <div className="flex flex-col lg:flex-row h-full gap-6">
        <section className="lg:w-[40%] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-label text-muted">{fixture.league}</span>
              <div className="text-headline text-primary mt-1">
                {fixture.homeTeam} vs {fixture.awayTeam}
              </div>
              <span className="text-label text-muted mt-2 block">
                {dateStr} · {timeStr}
              </span>
            </div>
          </div>

          {fixture.venue && (
            <p className="text-label text-muted mb-6">{fixture.venue}</p>
          )}

          <div className="hairline-b mb-6" />

          <h3 className="text-label text-muted mb-4">SELECT YOUR SIDE</h3>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setSelectedSide('home')}
              className={cn(
                'flex items-center justify-between p-4 border transition-colors',
                selectedSide === 'home'
                  ? 'bg-surface-container-high border-primary-container'
                  : 'bg-surface border-outline-variant/20 hover:border-outline-variant'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm">
                  {fixture.homeTeamAbbr || fixture.homeTeam.slice(0, 3).toUpperCase()}
                </div>
                <span className="text-title">{fixture.homeTeam}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-label text-muted">{lobby?.homeCount || 0} playing</span>
                {selectedSide === 'home' && (
                  <span className="material-symbols-outlined text-primary">check</span>
                )}
              </div>
            </button>

            <button
              onClick={() => setSelectedSide('away')}
              className={cn(
                'flex items-center justify-between p-4 border transition-colors',
                selectedSide === 'away'
                  ? 'bg-surface-container-high border-primary-container'
                  : 'bg-surface border-outline-variant/20 hover:border-outline-variant'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-tertiary-fixed text-tertiary-fixed-foreground flex items-center justify-center font-bold text-sm">
                  {fixture.awayTeamAbbr || fixture.awayTeam.slice(0, 3).toUpperCase()}
                </div>
                <span className="text-title">{fixture.awayTeam}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-label text-muted">{lobby?.awayCount || 0} playing</span>
                {selectedSide === 'away' && (
                  <span className="material-symbols-outlined text-primary">check</span>
                )}
              </div>
            </button>
          </div>
        </section>

        <section className="lg:w-[60%] flex flex-col gap-6">
          <div>
            <label className="text-label text-muted mb-2 block">STAKE</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setStake(Math.max(50, stake - 50))}
                className="w-10 h-10 border border-outline-variant flex items-center justify-center hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined">remove</span>
              </button>
              <span className="text-display text-foreground">₦{stake}</span>
              <button
                onClick={() => setStake(Math.min(balance, stake + 50))}
                className="w-10 h-10 border border-outline-variant flex items-center justify-center hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>
          </div>

          <div className="hairline-b" />

          <div>
            <label className="text-label text-muted mb-2 block">GAME MODE</label>
            <div className="flex gap-2">
              <button
                onClick={() => setGameMode('matchup_only')}
                className={cn(
                  'flex-1 py-3 px-4 border text-label font-bold transition-colors',
                  gameMode === 'matchup_only'
                    ? 'bg-primary-container text-on-primary border-primary-container'
                    : 'bg-surface text-foreground border-outline-variant hover:border-primary-container'
                )}
              >
                MATCHUP ONLY
              </button>
              <button
                onClick={() => setGameMode('real_match')}
                className={cn(
                  'flex-1 py-3 px-4 border text-label font-bold transition-colors',
                  gameMode === 'real_match'
                    ? 'bg-primary-container text-on-primary border-primary-container'
                    : 'bg-surface text-foreground border-outline-variant hover:border-primary-container'
                )}
              >
                REAL MATCH MODE
              </button>
            </div>
            <p className="text-label-xs text-muted mt-2">
              {gameMode === 'matchup_only'
                ? 'Play the matchup game only. Settlement happens immediately.'
                : 'Your matchup score is combined with prediction accuracy of the real match result.'}
            </p>
          </div>

          <div className="mt-auto">
            <button
              onClick={handleJoin}
              className="w-full py-4 bg-primary-container text-on-primary font-bold text-label flex items-center justify-center gap-2 hover:bg-primary-container/90 transition-colors"
            >
              FIND OPPONENT
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
            <p className="text-label-xs text-muted mt-3 text-center">
              If no opponent found in 20s, a bot joins.
            </p>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
