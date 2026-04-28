import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layouts';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { getTeamColors, getTeamAbbr } from '@/lib/team-colors';
import { cn } from '@/lib/utils';
import type { MatchupResult } from '../types';

interface Settlement {
  sessionId: string;
  player1MatchupScore: number;
  player2MatchupScore: number;
  player1AccuracyScore: number | null;
  player2AccuracyScore: number | null;
  player1CombinedScore: number;
  player2CombinedScore: number;
  player1Payout: number;
  player2Payout: number;
  status: 'pending' | 'complete';
}

interface SessionData {
  id: string;
  fixtureId: string;
  player1Id: string;
  player2Id: string;
  player1Side: string;
  player2Side: string;
  stakePerPlayer: number;
  pot: number;
  gameMode: string;
  status: string;
  homeTeam: string;
  awayTeam: string;
}

export default function Settlement() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { token, user, updateBalance } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [result, setResult] = useState<MatchupResult | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);

  const fetchSettlement = useCallback(async () => {
    if (!sessionId || !token) return;
    
    try {
      const sessionData = await api.getSession(sessionId, token);
      setSession(sessionData.session as SessionData);
      
      const resultData = await api.getResult(sessionId, token);
      setResult(resultData.result as MatchupResult);
      
      const settlementData = await api.getSettlement(sessionId, token);
      setSettlement(settlementData.settlement as Settlement);

      // Refresh wallet balance
      if (user && token) {
        const me = await api.getMe(token);
        updateBalance(me.walletBalance);
      }
    } catch {
      toast.error('Failed to load settlement');
    } finally {
      setLoading(false);
    }
  }, [sessionId, token, user, updateBalance]);

  useEffect(() => {
    fetchSettlement();
  }, [fetchSettlement]);

  if (loading) {
    return (
      <PageLayout balance={user?.walletBalance ?? 0}>
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-6 py-6">
          <Skeleton className="h-10 w-64 mx-auto" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageLayout>
    );
  }

  if (!settlement || !result || !session) {
    return (
      <PageLayout balance={user?.walletBalance ?? 0}>
        <div className="flex items-center justify-center h-64">
          <span className="text-label text-muted">SETTLEMENT NOT FOUND</span>
        </div>
      </PageLayout>
    );
  }

  // Derive player perspective
  const isPlayer1 = session.player1Id === user?.id;
  const yourGoals = isPlayer1 ? result.player1Goals : result.player2Goals;
  const oppGoals = isPlayer1 ? result.player2Goals : result.player1Goals;
  const yourPayout = isPlayer1 ? settlement.player1Payout : settlement.player2Payout;
  const yourScore = isPlayer1 ? settlement.player1CombinedScore : settlement.player2CombinedScore;
  const oppScore = isPlayer1 ? settlement.player2CombinedScore : settlement.player1CombinedScore;
  const stake = session.stakePerPlayer;
  const netProfit = yourPayout - stake;

  const yourTeam = isPlayer1
    ? session.player1Side === 'home' ? session.homeTeam : session.awayTeam
    : session.player2Side === 'home' ? session.homeTeam : session.awayTeam;
  const oppTeam = isPlayer1
    ? session.player1Side === 'home' ? session.awayTeam : session.homeTeam
    : session.player2Side === 'home' ? session.awayTeam : session.homeTeam;

  const yourColors = getTeamColors(yourTeam);
  const oppTeamColors = getTeamColors(oppTeam);
  const yourAbbr = getTeamAbbr(yourTeam);
  const oppAbbr = getTeamAbbr(oppTeam);

  let resultTag: 'WIN' | 'LOSS' | 'DRAW';
  if (yourGoals > oppGoals) resultTag = 'WIN';
  else if (yourGoals < oppGoals) resultTag = 'LOSS';
  else resultTag = 'DRAW';

  // Stats
  const yourPoss = isPlayer1 ? result.player1Possession : result.player2Possession;
  const oppPoss = isPlayer1 ? result.player2Possession : result.player1Possession;
  const yourShots = isPlayer1 ? result.player1Shots : result.player2Shots;
  const oppShots = isPlayer1 ? result.player2Shots : result.player1Shots;
  const yourTackles = isPlayer1 ? result.player1Tackles : result.player2Tackles;
  const oppTackles = isPlayer1 ? result.player2Tackles : result.player1Tackles;

  return (
    <PageLayout balance={user?.walletBalance ?? 0}>
      <div className="max-w-2xl mx-auto w-full flex flex-col gap-6 py-4 md:py-8 px-4">
        {/* Result badge */}
        <div className="text-center">
          <span className={cn(
            'inline-block px-6 py-2 font-black text-lg tracking-wider',
            resultTag === 'WIN' && 'bg-primary-container text-on-primary',
            resultTag === 'LOSS' && 'bg-surface-container-high text-muted',
            resultTag === 'DRAW' && 'bg-surface border border-outline-variant text-foreground',
          )}>
            {resultTag}
          </span>
        </div>

        {/* Scoreline */}
        <div className="flex items-center justify-center gap-6 md:gap-10">
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center font-black text-lg"
              style={{ backgroundColor: yourColors.primary, color: yourColors.text }}
            >
              {yourAbbr}
            </div>
            <span className="text-label text-muted">YOU</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-5xl font-black tabular-nums">{yourGoals}</span>
            <span className="text-2xl text-muted font-light">-</span>
            <span className="text-5xl font-black tabular-nums">{oppGoals}</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center font-black text-lg"
              style={{ backgroundColor: oppTeamColors.primary, color: oppTeamColors.text }}
            >
              {oppAbbr}
            </div>
            <span className="text-label text-muted">OPP</span>
          </div>
        </div>

        {/* Payout card */}
        <div className="bg-surface border border-outline-variant/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-label text-muted">YOUR PAYOUT</span>
            <span className={cn(
              'text-2xl font-black tabular-nums',
              netProfit > 0 ? 'text-primary' : netProfit < 0 ? 'text-red-500' : 'text-foreground'
            )}>
              ₦{yourPayout.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-outline-variant/20">
            <span className="text-label-xs text-muted">STAKE</span>
            <span className="text-sm font-medium">₦{stake.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-outline-variant/20">
            <span className="text-label-xs text-muted">NET PROFIT</span>
            <span className={cn(
              'text-sm font-bold',
              netProfit > 0 ? 'text-primary' : netProfit < 0 ? 'text-red-500' : 'text-foreground'
            )}>
              {netProfit > 0 ? '+' : ''}₦{netProfit.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-outline-variant/20">
            <span className="text-label-xs text-muted">MATCHUP SCORE</span>
            <span className="text-sm font-medium">{yourScore} vs {oppScore}</span>
          </div>
        </div>

        {/* Match stats */}
        <div className="bg-surface-container-low border border-outline-variant/20 p-6">
          <h3 className="text-label text-muted mb-4">MATCH STATS</h3>

          <div className="space-y-3">
            <StatRow label="POSSESSION" yours={`${yourPoss}%`} opp={`${oppPoss}%`} />
            <StatRow label="SHOTS" yours={String(yourShots)} opp={String(oppShots)} />
            <StatRow label="TACKLES" yours={String(yourTackles)} opp={String(oppTackles)} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-4 px-6 bg-primary-container text-on-primary font-bold text-label hover:bg-primary-container/90 transition-colors"
          >
            PLAY AGAIN
          </button>
          <button
            onClick={() => navigate('/wallet')}
            className="flex-1 py-4 px-6 border border-outline text-muted font-bold text-label hover:bg-surface-container transition-colors"
          >
            VIEW WALLET
          </button>
        </div>
      </div>
    </PageLayout>
  );
}

function StatRow({ label, yours, opp }: { label: string; yours: string; opp: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-outline-variant/10">
      <span className="text-sm font-bold tabular-nums w-16 text-right">{yours}</span>
      <span className="text-label-xs text-muted">{label}</span>
      <span className="text-sm font-bold tabular-nums w-16">{opp}</span>
    </div>
  );
}
