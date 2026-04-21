import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layouts';
import { FixtureCard } from '@/components/FixtureCard';

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

const MOCK_FIXTURES: Fixture[] = [
  {
    id: '1',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    homeTeamAbbr: 'ARS',
    awayTeamAbbr: 'CHE',
    league: 'PREMIER LEAGUE',
    kickoffAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    venue: 'Emirates Stadium',
  },
  {
    id: '2',
    homeTeam: 'Barcelona',
    awayTeam: 'Real Madrid',
    homeTeamAbbr: 'BAR',
    awayTeamAbbr: 'RMA',
    league: 'CHAMPIONS LEAGUE',
    kickoffAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    venue: 'Camp Nou',
  },
  {
    id: '3',
    homeTeam: 'Man City',
    awayTeam: 'Liverpool',
    homeTeamAbbr: 'MCI',
    awayTeamAbbr: 'LIV',
    league: 'PREMIER LEAGUE',
    kickoffAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: 'live',
    homeScore: 2,
    awayScore: 1,
    minute: 67,
    venue: 'Etihad Stadium',
  },
  {
    id: '4',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Dortmund',
    homeTeamAbbr: 'BAY',
    awayTeamAbbr: 'DOR',
    league: 'BUNDESLIGA',
    kickoffAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    venue: 'Allianz Arena',
  },
  {
    id: '5',
    homeTeam: 'PSG',
    awayTeam: 'Marseille',
    homeTeamAbbr: 'PSG',
    awayTeamAbbr: 'MAR',
    league: 'LIGUE 1',
    kickoffAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    venue: 'Parc des Princes',
  },
];

export default function Home() {
  const [fixtures] = useState<Fixture[]>(MOCK_FIXTURES);
  const [balance] = useState(1200);
  const navigate = useNavigate();

  useEffect(() => {
    // TODO: Fetch fixtures from API
  }, []);

  const handleJoin = (fixtureId: string) => {
    navigate(`/fixture/${fixtureId}`);
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <PageLayout title="FIXTURES" balance={balance}>
      <div className="mb-6">
        <span className="text-label text-muted">{dateStr.toUpperCase()}</span>
      </div>

      <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
        {fixtures.map((fixture) => (
          <FixtureCard
            key={fixture.id}
            fixture={fixture}
            onJoin={() => handleJoin(fixture.id)}
          />
        ))}
      </div>
    </PageLayout>
  );
}
