import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';
import { PageLayout } from '@/components/layouts';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeSelector } from '@/components/ThemeToggle';
import { getTeamColors, getTeamAbbr } from '@/lib/team-colors';
import { cn } from '@/lib/utils';

interface MatchHistoryItem {
  id: string;
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  yourSide: string;
  opponent: { displayName: string; isBot: boolean };
  yourGoals: number;
  oppGoals: number;
  resultTag: 'W' | 'L' | 'D';
  stake: number;
  payout: number;
  netProfit: number;
  playedAt: string;
}

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    try {
      await api.getMe(token);
      const historyData = await api.getMatchHistory(token);
      setMatches(historyData.history as MatchHistoryItem[]);
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  const wins = matches.filter((m) => m.resultTag === 'W').length;
  const losses = matches.filter((m) => m.resultTag === 'L').length;
  const total = matches.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const totalProfit = matches.reduce((sum, m) => sum + m.netProfit, 0);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today, ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday, ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <PageLayout title="PROFILE" balance={user?.walletBalance ?? 0}>
      <div className="flex flex-col lg:flex-row h-full gap-6">
        <section className="lg:w-[35%] flex flex-col">
          {loading ? (
            <>
              <div className="flex items-center gap-4 mb-6">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
              <div className="hairline-b mb-6" />
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold">
                  {user?.displayName?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex flex-col">
                  <span className="text-title">{user?.displayName || 'User'}</span>
                  <span className="text-label text-muted">@{user?.username || 'username'}</span>
                </div>
              </div>

              <div className="hairline-b mb-6" />

              <div className="grid grid-cols-4 gap-3">
                <div className="flex flex-col">
                  <span className="text-label-xs text-muted">PLAYED</span>
                  <span className="text-title mt-1">{total}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-label-xs text-muted">WON</span>
                  <span className="text-title mt-1 text-primary">{wins}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-label-xs text-muted">LOST</span>
                  <span className="text-title mt-1">{losses}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-label-xs text-muted">WIN%</span>
                  <span className="text-title mt-1">{winRate}%</span>
                </div>
              </div>

              <div className="mt-4 py-3 border-t border-b border-outline-variant/20">
                <span className="text-label-xs text-muted block">TOTAL P&L</span>
                <span className={cn(
                  'text-xl font-black',
                  totalProfit > 0 ? 'text-primary' : totalProfit < 0 ? 'text-red-500' : 'text-foreground'
                )}>
                  {totalProfit > 0 ? '+' : ''}₦{totalProfit.toLocaleString()}
                </span>
              </div>

              <div className="hairline-b my-6" />

              <ThemeSelector />

              <button
                onClick={handleLogout}
                className="mt-auto flex items-center gap-2 text-muted hover:text-destructive transition-colors py-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Sign out</span>
              </button>
            </>
          )}
        </section>

        <section className="lg:w-[65%] flex flex-col">
          <h3 className="text-label text-muted mb-4">MATCH HISTORY</h3>

          {loading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between py-4">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-6" />
                </div>
              ))}
            </div>
          ) : matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-muted">No matches played yet</p>
              <p className="text-label-xs text-muted mt-1">Join a fixture to start playing</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {matches.map((match) => {
                const yourTeam = match.yourSide === 'home' ? match.homeTeam : match.awayTeam;
                const colors = getTeamColors(yourTeam);
                const abbr = getTeamAbbr(yourTeam);

                return (
                  <button
                    key={match.id}
                    onClick={() => navigate(`/settlement/${match.id}`)}
                    className="flex items-center justify-between py-4 border-b border-outline-variant/20 hover:bg-surface-container-high/50 transition-colors px-2 -mx-2 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                        style={{ backgroundColor: colors.primary, color: colors.text }}
                      >
                        {abbr}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold">
                          {match.homeTeam} vs {match.awayTeam}
                        </span>
                        <span className="text-label-xs text-muted">
                          {formatDate(match.playedAt)} · vs {match.opponent.isBot ? 'Bot' : match.opponent.displayName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold tabular-nums">
                        {match.yourGoals}-{match.oppGoals}
                      </span>

                      <span className={cn(
                        'text-sm font-bold',
                        match.netProfit > 0 ? 'text-primary' : match.netProfit < 0 ? 'text-red-500' : 'text-muted'
                      )}>
                        {match.netProfit > 0 ? '+' : ''}₦{match.netProfit}
                      </span>

                      <div
                        className={cn(
                          'w-6 h-6 flex items-center justify-center text-xs font-bold',
                          match.resultTag === 'W'
                            ? 'bg-primary-container text-on-primary'
                            : match.resultTag === 'L'
                            ? 'bg-surface border border-outline-variant text-muted'
                            : 'bg-surface border border-outline text-muted'
                        )}
                      >
                        {match.resultTag}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
}
