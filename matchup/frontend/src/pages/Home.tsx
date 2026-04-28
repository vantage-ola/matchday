import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layouts';
import { FixtureCard } from '@/components/FixtureCard';
import { api } from '@/lib/api';
import { useAuthStore, useFixtureStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function Home() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { fixtures, setFixtures } = useFixtureStore();
  const { user } = useAuthStore();

  const fetchFixtures = useCallback(async () => {
    try {
      const data = await api.getFixtures();
      setFixtures(data.fixtures as Fixture[]);
    } catch (error) {
      toast.error('Failed to load fixtures');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [setFixtures]);

  useEffect(() => {
    fetchFixtures();
  }, [fetchFixtures]);

  const handleJoin = (fixtureId: string) => {
    navigate(`/fixture/${fixtureId}`);
  };

  const fixturesByDate = useMemo(() => {
    const groups: Record<string, Fixture[]> = {};
    for (const fixture of fixtures) {
      const dateKey = new Date(fixture.kickoffAt).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(fixture);
    }
    return Object.entries(groups);
  }, [fixtures]);

  return (
    <PageLayout title="FIXTURES" balance={user?.walletBalance ?? 0}>
      {loading ? (
        <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-surface-container-low border border-outline-variant/20 rounded overflow-hidden">
              <div className="p-4 border-b border-outline-variant/20 bg-surface-container-high">
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="p-6 flex items-center justify-between">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-12 w-12 rounded-full" />
              </div>
              <div className="p-4">
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : fixtures.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-muted mb-4">No upcoming fixtures</p>
          <button 
            onClick={fetchFixtures}
            className="text-primary font-semibold hover:underline"
          >
            Refresh
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {fixturesByDate.map(([dateLabel, dateFixtures]) => (
            <section key={dateLabel}>
              <div className="mb-4">
                <span className="text-label text-muted">{dateLabel.toUpperCase()}</span>
              </div>
              <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
                {dateFixtures.map((fixture) => (
                  <FixtureCard
                    key={fixture.id}
                    fixture={fixture}
                    onJoin={() => handleJoin(fixture.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
