import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Minus, Plus, ArrowRight, ArrowLeft } from 'lucide-react';
import { PageLayout } from '@/components/layouts';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getTeamColors, getTeamAbbr } from '@/lib/team-colors';

interface FixtureData {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
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

const BOT_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 2_000;

export default function Fixture() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  
  const [fixture, setFixture] = useState<FixtureData | null>(null);
  const [lobby, setLobby] = useState<LobbyStatus | null>(null);
  const [selectedSide, setSelectedSide] = useState<'home' | 'away'>('home');
  const [stake, setStake] = useState(100);
  const [gameMode, setGameMode] = useState<'matchup_only' | 'real_match'>('matchup_only');
  const [loading, setLoading] = useState(true);
  
  // Matchmaking state
  const [matchmaking, setMatchmaking] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFixture = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getFixture(id);
      setFixture(data.fixture as FixtureData);
    } catch {
      toast.error('Failed to load fixture');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchLobby = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getLobby(id);
      setLobby(data);
    } catch (error) {
      console.error('Failed to load lobby:', error);
    }
  }, [id]);

  useEffect(() => {
    if (id && token) {
      fetchFixture();
      fetchLobby();
    }
  }, [id, token, fetchFixture, fetchLobby]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const stopMatchmaking = useCallback(() => {
    setMatchmaking(false);
    setCountdown(0);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (botTimerRef.current) { clearTimeout(botTimerRef.current); botTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const handleJoin = async () => {
    if (!token || !user) {
      toast.error('Please sign in to join');
      navigate('/login');
      return;
    }

    if (stake > user.walletBalance) {
      toast.error('Insufficient balance');
      return;
    }

    setMatchmaking(true);

    try {
      const result = await api.joinFixture(id!, { side: selectedSide, stake, gameMode }, token);
      
      if (result.sessionId) {
        // Instant match found
        stopMatchmaking();
        navigate(`/matchup/${result.sessionId}`);
        return;
      }

      // No immediate match — start polling + bot fallback timer
      setCountdown(Math.ceil(BOT_TIMEOUT_MS / 1000));

      // Countdown timer
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);

      // Poll for a session being created (opponent joins the queue)
      pollRef.current = setInterval(async () => {
        try {
          const pollResult = await api.joinFixture(id!, { side: selectedSide, stake, gameMode }, token);
          if (pollResult.sessionId) {
            stopMatchmaking();
            navigate(`/matchup/${pollResult.sessionId}`);
          }
        } catch {
          // Ignore poll errors
        }
      }, POLL_INTERVAL_MS);

      // Bot fallback — create a bot session after timeout
      botTimerRef.current = setTimeout(async () => {
        try {
          const botResult = await api.createBotSession(
            id!,
            { side: selectedSide, stake, gameMode },
            token
          );
          stopMatchmaking();
          if (botResult.sessionId) {
            navigate(`/matchup/${botResult.sessionId}`);
          }
        } catch (err) {
          stopMatchmaking();
          toast.error('Failed to create bot match');
        }
      }, BOT_TIMEOUT_MS);

    } catch (err) {
      stopMatchmaking();
      toast.error(err instanceof Error ? err.message : 'Failed to join');
    }
  };

  if (loading) {
    return (
      <PageLayout balance={user?.walletBalance ?? 0}>
        <div className="flex flex-col lg:flex-row h-full gap-6">
          <section className="lg:w-[40%] flex flex-col">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-12 w-full mb-6" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </section>
          <section className="lg:w-[60%] flex flex-col gap-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
          </section>
        </div>
      </PageLayout>
    );
  }

  if (!fixture) {
    return (
      <PageLayout balance={user?.walletBalance ?? 0}>
        <div className="flex items-center justify-center h-64">
          <span className="text-label text-muted">FIXTURE NOT FOUND</span>
        </div>
      </PageLayout>
    );
  }

  const kickoffTime = new Date(fixture.kickoffAt);
  const timeStr = kickoffTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dateStr = kickoffTime.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  // ─── Matchmaking Waiting Screen ─────────────────────────────────────────────
  if (matchmaking) {
    return (
      <PageLayout balance={user?.walletBalance ?? 0}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-sm w-full text-center flex flex-col items-center gap-8">
            {/* Animated searching indicator */}
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 border-2 border-outline-variant/30 rounded-full" />
              <div className="absolute inset-0 border-2 border-t-primary-container rounded-full animate-spin" />
              <div className="absolute inset-2 border-2 border-outline-variant/20 rounded-full" />
              <div className="absolute inset-2 border-2 border-t-tertiary-fixed rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>

            <div>
              <h2 className="text-xl font-black tracking-tight text-foreground mb-2">
                FINDING OPPONENT
              </h2>
              <p className="text-label text-muted">
                {fixture.homeTeam} vs {fixture.awayTeam}
              </p>
              <p className="text-label-xs text-muted mt-1">
                Playing as {selectedSide === 'home' ? fixture.homeTeam : fixture.awayTeam} · ₦{stake} stake
              </p>
            </div>

            {/* Countdown */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-48 h-1 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-container rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / Math.ceil(BOT_TIMEOUT_MS / 1000)) * 100}%` }}
                />
              </div>
              <span className="text-label-xs text-muted tabular-nums">
                {countdown > 0
                  ? `Bot joins in ${countdown}s`
                  : 'Creating bot match...'}
              </span>
            </div>

            {/* Cancel */}
            <button
              onClick={stopMatchmaking}
              className="text-label text-muted hover:text-foreground transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // ─── Fixture Setup Screen ──────────────────────────────────────────────────
  return (
    <PageLayout balance={user?.walletBalance ?? 0}>
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
                {fixture.homeTeamLogo ? (
                  <img
                    src={fixture.homeTeamLogo}
                    alt={fixture.homeTeam}
                    className="w-10 h-10 object-contain"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{
                      backgroundColor: getTeamColors(fixture.homeTeam).primary,
                      color: getTeamColors(fixture.homeTeam).text,
                    }}
                  >
                    {getTeamAbbr(fixture.homeTeam)}
                  </div>
                )}
                <span className="text-title">{fixture.homeTeam}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-label text-muted">{lobby?.homeCount || 0} playing</span>
                {selectedSide === 'home' && (
                  <Check className="w-4 h-4 text-primary" />
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
                {fixture.awayTeamLogo ? (
                  <img
                    src={fixture.awayTeamLogo}
                    alt={fixture.awayTeam}
                    className="w-10 h-10 object-contain"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{
                      backgroundColor: getTeamColors(fixture.awayTeam).primary,
                      color: getTeamColors(fixture.awayTeam).text,
                    }}
                  >
                    {getTeamAbbr(fixture.awayTeam)}
                  </div>
                )}
                <span className="text-title">{fixture.awayTeam}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-label text-muted">{lobby?.awayCount || 0} playing</span>
                {selectedSide === 'away' && (
                  <Check className="w-4 h-4 text-primary" />
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
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-display text-foreground">₦{stake}</span>
              <button
                onClick={() => setStake(Math.min(user?.walletBalance ?? 1000, stake + 50))}
                className="w-10 h-10 border border-outline-variant flex items-center justify-center hover:bg-surface-container transition-colors"
              >
                <Plus className="w-4 h-4" />
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
              disabled={matchmaking}
              className="w-full py-4 bg-primary-container text-on-primary font-bold text-label flex items-center justify-center gap-2 hover:bg-primary-container/90 transition-colors disabled:opacity-50"
            >
              FIND OPPONENT
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-label-xs text-muted mt-3 text-center">
              If no opponent found in 20s, a bot joins automatically.
            </p>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
