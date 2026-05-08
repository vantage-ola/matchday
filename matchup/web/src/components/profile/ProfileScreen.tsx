import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft } from 'lucide-react';
import { getProfile, getMatchHistory, type PlayerProfile, type MatchRecord } from '@/lib/storage';

interface ProfileScreenProps {
  onBack: () => void;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card size="sm" className="items-center text-center">
      <CardContent className="flex flex-col items-center gap-0.5 py-0">
        <span className="text-xl font-bold tabular-nums">{value}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

export function ProfileScreen({ onBack }: ProfileScreenProps) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [recent, setRecent] = useState<MatchRecord[]>([]);

  useEffect(() => {
    Promise.all([getProfile(), getMatchHistory()]).then(([p, h]) => {
      setProfile(p);
      setRecent(h.slice(0, 5));
    });
  }, []);

  if (!profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const winRate = profile.matchesPlayed > 0
    ? Math.round((profile.wins / profile.matchesPlayed) * 100)
    : 0;

  return (
    <div className="flex min-h-dvh flex-col p-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-9 w-9 px-0" onClick={onBack}>
          <ArrowLeft size={18} />
        </Button>
        <h2 className="text-lg font-bold uppercase tracking-wide">Profile</h2>
      </div>

      <div className="mx-auto w-full max-w-md space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-2">
          <Avatar size="lg">
            <AvatarFallback>M</AvatarFallback>
          </Avatar>
          <Badge variant="secondary">Manager</Badge>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Played" value={profile.matchesPlayed} />
          <StatCard label="Win Rate" value={`${winRate}%`} />
          <StatCard label="Won" value={profile.wins} />
          <StatCard label="Drawn" value={profile.draws} />
          <StatCard label="Lost" value={profile.losses} />
          <StatCard
            label="Goal Diff"
            value={`${profile.goalsScored > profile.goalsConceded ? '+' : ''}${profile.goalsScored - profile.goalsConceded}`}
          />
        </div>

        {/* Goal tally */}
        <Card size="sm">
          <CardContent className="flex items-center justify-center gap-6 py-0">
            <div className="text-center">
              <span className="block text-lg font-bold tabular-nums text-primary">{profile.goalsScored}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Scored</span>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="text-center">
              <span className="block text-lg font-bold tabular-nums text-destructive">{profile.goalsConceded}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Conceded</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent matches */}
        {recent.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Recent Matches
            </h3>
            <div className="space-y-1">
              {recent.map((m, i) => {
                const variant = m.result === 'win' ? 'default' as const
                  : m.result === 'loss' ? 'destructive' as const
                  : 'secondary' as const;
                return (
                  <div key={m.matchId + i} className="flex items-center gap-2 text-sm">
                    <Badge variant={variant}>
                      {m.result === 'win' ? 'W' : m.result === 'loss' ? 'L' : 'D'}
                    </Badge>
                    <span className="font-bold tabular-nums">
                      {m.score.home} – {m.score.away}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {m.homeFormation} vs {m.awayFormation}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
