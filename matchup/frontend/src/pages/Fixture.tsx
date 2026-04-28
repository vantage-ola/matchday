import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Minus, Plus, ArrowRight, Check } from 'lucide-react';
import { PageLayout } from '@/components/layouts';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent, CardFooter, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
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
  const timeStr = kickoffTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });
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

  const homeColors = getTeamColors(fixture.homeTeam);
  const awayColors = getTeamColors(fixture.awayTeam);
  const homeAbbr = getTeamAbbr(fixture.homeTeam);
  const awayAbbr = getTeamAbbr(fixture.awayTeam);

  // ─── Fixture Setup Screen ──────────────────────────────────────────────────
  return (
    <PageLayout balance={user?.walletBalance ?? 0}>
      <div className="max-w-lg mx-auto flex flex-col gap-6">
        {/* Fixture Header Card */}
        <Card className="rounded-sm ring-0 border border-outline-variant/20 bg-surface-container-low py-0 gap-0">
          <CardHeader className="border-b border-outline-variant/20 bg-surface-container-high py-3">
            <Badge variant="league">{fixture.league}</Badge>
            <CardAction>
              <span className="text-label-xs text-muted">{dateStr} · {timeStr}</span>
            </CardAction>
          </CardHeader>
          <CardContent className="py-8">
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center gap-3 w-1/3">
                {fixture.homeTeamLogo ? (
                  <img src={fixture.homeTeamLogo} alt={fixture.homeTeam} className="w-14 h-14 object-contain" />
                ) : (
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg"
                    style={{ backgroundColor: homeColors.primary, color: homeColors.text }}
                  >
                    {homeAbbr}
                  </div>
                )}
                <span className="font-bold text-sm text-center">{fixture.homeTeam}</span>
              </div>
              <span className="text-3xl font-black tracking-tight text-foreground">VS</span>
              <div className="flex flex-col items-center gap-3 w-1/3">
                {fixture.awayTeamLogo ? (
                  <img src={fixture.awayTeamLogo} alt={fixture.awayTeam} className="w-14 h-14 object-contain" />
                ) : (
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg"
                    style={{ backgroundColor: awayColors.primary, color: awayColors.text }}
                  >
                    {awayAbbr}
                  </div>
                )}
                <span className="font-bold text-sm text-center">{fixture.awayTeam}</span>
              </div>
            </div>
          </CardContent>
          {fixture.venue && (
            <CardFooter className="border-t border-outline-variant/20 bg-surface-container py-3">
              <span className="text-[10px] uppercase tracking-wider text-muted">{fixture.venue}</span>
            </CardFooter>
          )}
        </Card>

        {/* Side Selection */}
        <div>
          <h3 className="text-label text-muted mb-4">SELECT YOUR SIDE</h3>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setSelectedSide('home')}
              className={cn(
                'flex items-center justify-between p-4 border transition-colors rounded-sm',
                selectedSide === 'home'
                  ? 'bg-surface-container-high border-primary-container'
                  : 'bg-surface border-outline-variant/20 hover:border-outline-variant'
              )}
            >
              <div className="flex items-center gap-3">
                {fixture.homeTeamLogo ? (
                  <img src={fixture.homeTeamLogo} alt={fixture.homeTeam} className="w-10 h-10 object-contain" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ backgroundColor: homeColors.primary, color: homeColors.text }}
                  >
                    {homeAbbr}
                  </div>
                )}
                <span className="text-title">{fixture.homeTeam}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-label-xs text-muted">{lobby?.homeCount || 0} playing</span>
                {selectedSide === 'home' && <Check className="w-4 h-4 text-primary" />}
              </div>
            </button>

            <button
              onClick={() => setSelectedSide('away')}
              className={cn(
                'flex items-center justify-between p-4 border transition-colors rounded-sm',
                selectedSide === 'away'
                  ? 'bg-surface-container-high border-primary-container'
                  : 'bg-surface border-outline-variant/20 hover:border-outline-variant'
              )}
            >
              <div className="flex items-center gap-3">
                {fixture.awayTeamLogo ? (
                  <img src={fixture.awayTeamLogo} alt={fixture.awayTeam} className="w-10 h-10 object-contain" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ backgroundColor: awayColors.primary, color: awayColors.text }}
                  >
                    {awayAbbr}
                  </div>
                )}
                <span className="text-title">{fixture.awayTeam}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-label-xs text-muted">{lobby?.awayCount || 0} playing</span>
                {selectedSide === 'away' && <Check className="w-4 h-4 text-primary" />}
              </div>
            </button>
          </div>
        </div>

        <Separator className="bg-outline-variant/20" />

        {/* Game Mode */}
        <div>
          <h3 className="text-label text-muted mb-4">GAME MODE</h3>
          <Tabs value={gameMode} onValueChange={(val) => setGameMode(val as 'matchup_only' | 'real_match')}>
            <TabsList variant="line" className="w-full">
              <TabsTrigger value="matchup_only" className="flex-1 text-label font-bold uppercase tracking-wider">
                Matchup Only
              </TabsTrigger>
              <TabsTrigger value="real_match" className="flex-1 text-label font-bold uppercase tracking-wider">
                Real Match
              </TabsTrigger>
            </TabsList>
            <TabsContent value="matchup_only">
              <p className="text-label-xs text-muted mt-3">
                Play the matchup game only. Settlement happens immediately.
              </p>
            </TabsContent>
            <TabsContent value="real_match">
              <p className="text-label-xs text-muted mt-3">
                Your matchup score is combined with prediction accuracy of the real match result.
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <Separator className="bg-outline-variant/20" />

        {/* Stake */}
        <div>
          <h3 className="text-label text-muted mb-4">STAKE</h3>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStake(Math.max(50, stake - 50))}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="text-display text-foreground tabular-nums">₦{stake}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStake(Math.min(user?.walletBalance ?? 1000, stake + 50))}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* CTA */}
        <div className="pt-2">
          <Button
            variant="primary"
            onClick={handleJoin}
            disabled={matchmaking}
            className="w-full h-12 text-label font-bold gap-2"
          >
            FIND OPPONENT
            <ArrowRight className="w-4 h-4" />
          </Button>
          <p className="text-label-xs text-muted mt-3 text-center">
            If no opponent found in 20s, a bot joins automatically.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
