import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trophy } from 'lucide-react';
import { getMatchHistory, type MatchRecord } from '@/lib/storage';

interface HistoryScreenProps {
  onBack: () => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function HistoryScreen({ onBack }: HistoryScreenProps) {
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMatchHistory().then((h) => {
      setHistory(h);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex min-h-dvh flex-col p-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-9 w-9 px-0" onClick={onBack}>
          <ArrowLeft size={18} />
        </Button>
        <h2 className="text-lg font-bold uppercase tracking-wide">Match History</h2>
      </div>

      <div className="mx-auto w-full max-w-lg flex-1">
        {loading && (
          <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
        )}

        {!loading && history.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Trophy size={32} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No matches yet. Go play one!</p>
          </div>
        )}

        {!loading && history.length > 0 && (
          <div className="space-y-1.5">
            {history.map((match, i) => {
              const variant = match.result === 'win' ? 'default' as const
                : match.result === 'loss' ? 'destructive' as const
                : 'secondary' as const;
              return (
                <Card key={match.matchId + i} size="sm" className="py-3">
                  <CardContent className="flex items-center gap-3 py-0">
                    <Badge variant={variant} className="w-5 justify-center">
                      {match.result === 'win' ? 'W' : match.result === 'loss' ? 'L' : 'D'}
                    </Badge>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold tabular-nums">
                          {match.score.home} – {match.score.away}
                        </span>
                        <Badge variant="secondary">
                          {match.mode === 'ai' ? 'vs AI' : '1v1'}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {match.homeFormation} vs {match.awayFormation}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatDate(match.playedAt)}</span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
