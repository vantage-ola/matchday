import type { MatchupResult } from '../types';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle } from 'lucide-react';

interface SettlementCardProps {
  result: MatchupResult | null;
  settlement: {
    player1MatchupScore: number;
    player2MatchupScore: number;
    player1CombinedScore: number;
    player2CombinedScore: number;
    player1Payout: number;
    player2Payout: number;
  };
  playerSide: 'p1' | 'p2';
  homeTeam?: string;
  awayTeam?: string;
}

export default function SettlementCard({
  result,
  settlement,
  playerSide,
  homeTeam = 'HOME',
  awayTeam = 'AWAY',
}: SettlementCardProps) {
  const isP1 = playerSide === 'p1';

  const myGoals = isP1 ? result?.player1Goals : result?.player2Goals;
  const oppGoals = isP1 ? result?.player2Goals : result?.player1Goals;
  const myPossession = isP1 ? result?.player1Possession : result?.player2Possession;
  const oppPossession = isP1 ? result?.player2Possession : result?.player1Possession;
  const myTackles = isP1 ? result?.player1Tackles : result?.player2Tackles;
  const oppTackles = isP1 ? result?.player2Tackles : result?.player1Tackles;
  const myShots = isP1 ? result?.player1Shots : result?.player2Shots;
  const oppShots = isP1 ? result?.player2Shots : result?.player1Shots;

  const myPayout = isP1 ? settlement.player1Payout : settlement.player2Payout;
  const oppPayout = isP1 ? settlement.player2Payout : settlement.player1Payout;
  const iWon = myPayout >= oppPayout;

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-outline-variant/20">
        <h1 className="text-headline text-primary">FULL TIME</h1>
        <p className="text-label text-muted mt-1">{homeTeam} vs {awayTeam}</p>
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex justify-between items-start gap-6 mb-8">
          <div className="flex-1">
            <span className="text-label text-muted">YOU</span>
            <div className="text-display text-primary mt-2">
              {myGoals ?? 0} - {oppGoals ?? 0}
            </div>
          </div>

          <div className="flex-1 text-right">
            <span className="text-label text-muted">OPPONENT</span>
            <div className="text-display text-foreground mt-2">
              {oppGoals ?? 0} - {myGoals ?? 0}
            </div>
          </div>
        </div>

        <div className="hairline-b mb-6" />

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <span className="text-label-xs text-muted block">POSSESSION</span>
            <span className="text-title mt-2 block">{myPossession ?? 0}%</span>
            <span className="text-label-xs text-muted">{oppPossession ?? 0}%</span>
          </div>
          <div>
            <span className="text-label-xs text-muted block">TACKLES</span>
            <span className="text-title mt-2 block">{myTackles ?? 0}</span>
            <span className="text-label-xs text-muted">{oppTackles ?? 0}</span>
          </div>
          <div>
            <span className="text-label-xs text-muted block">SHOTS</span>
            <span className="text-title mt-2 block">{myShots ?? 0}</span>
            <span className="text-label-xs text-muted">{oppShots ?? 0}</span>
          </div>
        </div>

        <div className="hairline-b my-6" />

        {iWon ? (
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="w-5 h-5 text-primary-container" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary-container">YOU WON THE MATCHUP</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted">
            <XCircle className="w-5 h-5" />
            <span className="text-[11px] font-bold uppercase tracking-wider">YOU LOST THE MATCHUP</span>
          </div>
        )}

        <div className="mt-6">
          <span className={cn(
            'text-3xl font-black tracking-tight',
            iWon ? 'text-primary' : 'text-foreground'
          )}>
            {iWon ? '+' : '-'}₦{Math.abs(myPayout).toLocaleString()}
          </span>
          <p className="text-label-xs text-muted mt-1">Credited to wallet</p>
        </div>
      </div>
    </div>
  );
}
