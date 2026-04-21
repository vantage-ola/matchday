import { useState } from 'react';
import { PageLayout } from '@/components/layouts';

interface MatchHistory {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  yourScore: number;
  oppScore: number;
  result: 'win' | 'loss' | 'draw';
  payout: number;
  league: string;
  createdAt: string;
}

const MOCK_MATCHES: MatchHistory[] = [
  {
    id: '1',
    homeTeam: 'ARS',
    awayTeam: 'CHE',
    homeScore: 2,
    awayScore: 1,
    yourScore: 2,
    oppScore: 1,
    result: 'win',
    payout: 566,
    league: 'UCL',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    homeTeam: 'MCI',
    awayTeam: 'ARS',
    homeScore: 1,
    awayScore: 0,
    yourScore: 0,
    oppScore: 0,
    result: 'draw',
    payout: 0,
    league: 'PL',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    homeTeam: 'ARS',
    awayTeam: 'TOT',
    homeScore: 3,
    awayScore: 1,
    yourScore: 3,
    oppScore: 1,
    result: 'win',
    payout: 420,
    league: 'PL',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    homeTeam: 'LIV',
    awayTeam: 'ARS',
    homeScore: 2,
    awayScore: 0,
    yourScore: 0,
    oppScore: 2,
    result: 'loss',
    payout: -200,
    league: 'PL',
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    homeTeam: 'BAR',
    awayTeam: 'RMA',
    homeScore: 2,
    awayScore: 2,
    yourScore: 2,
    oppScore: 1,
    result: 'win',
    payout: 380,
    league: 'UCL',
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export default function Profile() {
  const [profile] = useState({
    displayName: 'John Doe',
    username: 'jdoe',
  });
  const [matches] = useState<MatchHistory[]>(MOCK_MATCHES);
  const [balance] = useState(4250);

  const wins = matches.filter((m) => m.result === 'win').length;
  const total = matches.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <PageLayout title="PROFILE" balance={balance}>
      <div className="flex flex-col lg:flex-row h-full gap-6">
        <section className="lg:w-[35%] flex flex-col">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-title">{profile.displayName}</span>
              <span className="text-label text-muted">@{profile.username}</span>
            </div>
          </div>

          <div className="hairline-b mb-6" />

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col border-r border-outline-variant/20 pr-4">
              <span className="text-label-xs text-muted">PLAYED</span>
              <span className="text-title mt-1">{total}</span>
            </div>
            <div className="flex flex-col border-r border-outline-variant/20 px-4">
              <span className="text-label-xs text-muted">WON</span>
              <span className="text-title mt-1">{wins}</span>
            </div>
            <div className="flex flex-col pl-4">
              <span className="text-label-xs text-muted">WIN RATE</span>
              <span className="text-title mt-1">{winRate}%</span>
            </div>
          </div>

          <div className="hairline-b my-6" />
        </section>

        <section className="lg:w-[65%] flex flex-col">
          <h3 className="text-label text-muted mb-4">RECENT MATCHES</h3>

          <div className="flex flex-col">
            {matches.map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between py-4 border-b border-outline-variant/20 hover:bg-surface-container-high/50 transition-colors"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold">
                    {match.homeTeam} vs {match.awayTeam}
                  </span>
                  <span className="text-label-xs text-muted">
                    {formatDate(match.createdAt)} · {match.league}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">
                    {match.yourScore}-{match.oppScore}
                  </span>

                  <div
                    className={cn(
                      'w-6 h-6 flex items-center justify-center text-xs font-bold',
                      match.result === 'win'
                        ? 'bg-primary-container text-on-primary'
                        : match.result === 'loss'
                        ? 'bg-surface border border-primary-container text-primary-container'
                        : 'bg-surface border border-outline text-muted'
                    )}
                  >
                    {match.result.charAt(0).toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
