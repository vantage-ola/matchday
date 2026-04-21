import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layouts';
import SettlementCard from '@/components/SettlementCard';
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

const MOCK_RESULT: MatchupResult = {
  id: '1',
  sessionId: '1',
  player1Goals: 2,
  player2Goals: 1,
  player1Possession: 54,
  player2Possession: 46,
  player1Tackles: 4,
  player2Tackles: 2,
  player1Shots: 3,
  player2Shots: 2,
  player1Assists: 1,
  player2Assists: 0,
  playerEvents: [],
  createdAt: new Date(),
};

const MOCK_SETTLEMENT: Settlement = {
  sessionId: '1',
  player1MatchupScore: 67,
  player2MatchupScore: 33,
  player1AccuracyScore: null,
  player2AccuracyScore: null,
  player1CombinedScore: 67,
  player2CombinedScore: 33,
  player1Payout: 566,
  player2Payout: 234,
  status: 'complete',
};

export default function Settlement() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [settlement] = useState<Settlement | null>(MOCK_SETTLEMENT);
  const [result] = useState<MatchupResult | null>(MOCK_RESULT);
  const [balance] = useState(1766);

  useEffect(() => {
    // TODO: Fetch settlement and matchup result
  }, [sessionId]);

  if (!settlement || !result) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <span className="text-label text-muted">LOADING SETTLEMENT...</span>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout balance={balance}>
      <div className="flex flex-col lg:flex-row h-full gap-6">
        <div className="lg:w-[45%] bg-surface border border-outline-variant/20 rounded overflow-hidden">
          <SettlementCard
            result={result}
            settlement={settlement}
            playerSide="p1"
            homeTeam="Arsenal"
            awayTeam="Chelsea"
          />
        </div>

        <div className="lg:w-[55%] flex flex-col gap-4">
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-4 px-6 border border-primary-container text-primary font-bold text-label hover:bg-surface-container transition-colors"
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

          <div className="bg-surface-container-low border border-outline-variant/20 p-6 rounded">
            <h3 className="text-title mb-4">MATCH DETAILS</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                <span className="text-label text-muted">SESSION ID</span>
                <span className="text-sm font-medium">{sessionId}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                <span className="text-label text-muted">GAME MODE</span>
                <span className="text-sm font-medium">MATCHUP ONLY</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                <span className="text-label text-muted">STAKE</span>
                <span className="text-sm font-medium">₦200</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-label text-muted">PLATFORM FEE</span>
                <span className="text-sm font-medium">10%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
