import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  Minus,
  Target,
  Crosshair,
  ShieldCheck,
  Footprints,
  Swords,
  Goal,
  ShieldX,
  Zap,
  Clock,
  ListOrdered,
} from 'lucide-react';
import type { GameState, Player, MatchEvent } from '@/lib/engine';

// ─── helpers ─────────────────────────────────────────────────────────────

interface TeamStats {
  passes: number;
  passesCompleted: number;
  shots: number;
  shotsOnTarget: number;
  goals: number;
  tackles: number;
  tacklesWon: number;
  interceptions: number;
}

function aggregateTeam(players: Player[], team: 'home' | 'away'): TeamStats {
  return players
    .filter((p) => p.team === team)
    .reduce(
      (acc, p) => ({
        passes: acc.passes + p.stats.passes,
        passesCompleted: acc.passesCompleted + p.stats.passesCompleted,
        shots: acc.shots + p.stats.shots,
        shotsOnTarget: acc.shotsOnTarget + p.stats.shotsOnTarget,
        goals: acc.goals + p.stats.goals,
        tackles: acc.tackles + p.stats.tackles,
        tacklesWon: acc.tacklesWon + p.stats.tacklesWon,
        interceptions: acc.interceptions + p.stats.interceptions,
      }),
      { passes: 0, passesCompleted: 0, shots: 0, shotsOnTarget: 0, goals: 0, tackles: 0, tacklesWon: 0, interceptions: 0 },
    );
}

function computePossession(events: MatchEvent[]): { home: number; away: number } {
  if (events.length === 0) return { home: 50, away: 50 };
  let h = 0;
  let a = 0;
  for (const e of events) {
    if (e.team === 'home') h++;
    else a++;
  }
  const total = h + a;
  const hp = Math.round((h / total) * 100);
  return { home: hp, away: 100 - hp };
}

function topPlayer(players: Player[], team: 'home' | 'away', stat: keyof Player['stats']): Player | null {
  const filtered = players.filter((p) => p.team === team);
  if (filtered.length === 0) return null;
  return filtered.reduce((best, p) => (p.stats[stat] > best.stats[stat] ? p : best));
}

function formatMatchMinute(time: number): string {
  const mins = Math.floor((5400 - time) / 60);
  return `${mins}'`;
}


// ─── types ───────────────────────────────────────────────────────────────

type Tab = 'summary' | 'log' | 'replay';

interface FullTimeScreenProps {
  state: GameState;
  homeFormation: string;
  awayFormation: string;
  onPlayAgain: () => void;
  onRematch?: () => void;
}

// ─── event icon mapping ──────────────────────────────────────────────────

const EVENT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  goal: Goal,
  miss: Target,
  interception: ShieldX,
  blocked: ShieldCheck,
  tackle: Swords,
  tackleFailed: Swords,
  pass: Zap,
  move: Footprints,
};

// ─── stat bar ────────────────────────────────────────────────────────────

function StatRow({ label, home, away }: { label: string; home: number; away: number }) {
  const total = home + away || 1;
  const homePct = (home / total) * 100;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-8 text-right font-bold tabular-nums">{home}</span>
      <div className="relative flex h-[6px] flex-1 overflow-hidden rounded-full bg-muted/30">
        <div
          className="h-full rounded-full transition-all duration-500 bg-primary"
          style={{ width: `${homePct}%` }}
        />
        <div
          className="h-full rounded-full transition-all duration-500 bg-destructive/80"
          style={{ width: `${100 - homePct}%` }}
        />
      </div>
      <span className="w-8 font-bold tabular-nums">{away}</span>
      <span className="w-20 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── component ───────────────────────────────────────────────────────────

export function FullTimeScreen({
  state,
  homeFormation,
  awayFormation,
  onPlayAgain,
  onRematch,
}: FullTimeScreenProps) {
  const [tab, setTab] = useState<Tab>('summary');

  const winner =
    state.score.home > state.score.away
      ? 'HOME WINS'
      : state.score.away > state.score.home
        ? 'AWAY WINS'
        : 'DRAW';

  const possession = useMemo(() => computePossession(state.events), [state.events]);
  const homeStats = useMemo(() => aggregateTeam(state.players, 'home'), [state.players]);
  const awayStats = useMemo(() => aggregateTeam(state.players, 'away'), [state.players]);

  const topScorer = useMemo(() => {
    const h = topPlayer(state.players, 'home', 'goals');
    const a = topPlayer(state.players, 'away', 'goals');
    if (!h && !a) return null;
    if (!a || (h && h.stats.goals >= a.stats.goals)) return h;
    return a;
  }, [state.players]);

  const topPasser = useMemo(() => {
    const h = topPlayer(state.players, 'home', 'passesCompleted');
    const a = topPlayer(state.players, 'away', 'passesCompleted');
    if (!h && !a) return null;
    if (!a || (h && h.stats.passesCompleted >= a.stats.passesCompleted)) return h;
    return a;
  }, [state.players]);

  const topTackler = useMemo(() => {
    const h = topPlayer(state.players, 'home', 'tacklesWon');
    const a = topPlayer(state.players, 'away', 'tacklesWon');
    if (!h && !a) return null;
    if (!a || (h && h.stats.tacklesWon >= a.stats.tacklesWon)) return h;
    return a;
  }, [state.players]);

  const goalEvents = useMemo(
    () => state.events.filter((e) => e.type === 'goal'),
    [state.events],
  );

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-4 md:p-8 bg-background">
      <div className="w-full max-w-5xl flex flex-col md:flex-row gap-8">
        
        {/* ── Left Column (45%) ──────────────────────────────────── */}
        <div className="w-full md:w-[45%] flex flex-col gap-6">
          <header className="text-center md:text-left space-y-1 bg-card rounded-lg p-6 border border-border">
            <h1 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            FULL TIME
          </h1>
          <div className="flex items-center justify-center gap-6 py-2">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {homeFormation}
              </p>
              <p className="text-5xl font-black tabular-nums leading-none tracking-tighter">{state.score.home}</p>
            </div>
            <span className="text-xl text-muted-foreground">—</span>
            <div className="text-left">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {awayFormation}
              </p>
              <p className="text-5xl font-black tabular-nums leading-none tracking-tighter">{state.score.away}</p>
            </div>
          </div>
          <p className="text-sm font-bold tracking-wide">
            {winner === 'DRAW' ? (
              <span className="flex items-center justify-center gap-1 text-muted-foreground">
                <Minus size={14} /> DRAW
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1 text-primary">
                <Trophy size={14} /> {winner}
              </span>
            )}
          </p>
          </header>

          {/* Goal scorers */}
          {goalEvents.length > 0 && (
            <div className="rounded-lg bg-card p-4 border border-border">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Goals
              </p>
              <div className="space-y-2">
                {goalEvents.map((evt, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-10 text-right tabular-nums text-muted-foreground">
                      {formatMatchMinute(evt.time)}
                    </span>
                    <Goal size={14} className="text-primary" />
                    <span className="font-medium">{evt.description}</span>
                    <span className="ml-auto rounded bg-muted/50 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                      {evt.team === 'home' ? homeFormation : awayFormation}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column (55%) ─────────────────────────────────── */}
        <div className="w-full md:w-[55%] flex flex-col gap-6">
          {/* ── Tab bar ─────────────────────────────────────────────── */}
        <nav className="flex rounded-lg bg-muted/40 p-0.5">
          {([
            { key: 'summary' as Tab, label: 'Summary', icon: Crosshair },
            { key: 'log' as Tab, label: 'Match Log', icon: ListOrdered },
            { key: 'replay' as Tab, label: 'Replay', icon: Clock },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                tab === key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/80'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </nav>

        {/* ── Tab content ─────────────────────────────────────────── */}
        {tab === 'summary' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            {/* Stat bars */}
            <div className="space-y-2 rounded-lg bg-card p-4">
              <StatRow label="Possession" home={possession.home} away={possession.away} />
              <StatRow label="Shots" home={homeStats.shots} away={awayStats.shots} />
              <StatRow
                label="On target"
                home={homeStats.shotsOnTarget}
                away={awayStats.shotsOnTarget}
              />
              <StatRow label="Passes" home={homeStats.passesCompleted} away={awayStats.passesCompleted} />
              <StatRow label="Tackles" home={homeStats.tacklesWon} away={awayStats.tacklesWon} />
              <StatRow label="Intercepts" home={homeStats.interceptions} away={awayStats.interceptions} />
            </div>

            {/* MVP strip */}
            <div className="flex gap-2">
              {topScorer && topScorer.stats.goals > 0 && (
                <div className="flex-1 rounded-lg bg-card p-3 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    Top Scorer
                  </p>
                  <p className="text-sm font-bold">{topScorer.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {topScorer.stats.goals} goal{topScorer.stats.goals !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
              {topPasser && topPasser.stats.passesCompleted > 0 && (
                <div className="flex-1 rounded-lg bg-card p-3 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    Top Passer
                  </p>
                  <p className="text-sm font-bold">{topPasser.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {topPasser.stats.passesCompleted} pass
                    {topPasser.stats.passesCompleted !== 1 ? 'es' : ''}
                  </p>
                </div>
              )}
              {topTackler && topTackler.stats.tacklesWon > 0 && (
                <div className="flex-1 rounded-lg bg-card p-3 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    Top Tackler
                  </p>
                  <p className="text-sm font-bold">{topTackler.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {topTackler.stats.tacklesWon} tackle
                    {topTackler.stats.tacklesWon !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>

            </div>
          )}

          {tab === 'log' && (
          <div className="animate-in fade-in-50 duration-200">
            <div className="max-h-[45vh] overflow-y-auto rounded-lg bg-card p-3 space-y-0.5">
              {state.events.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No events recorded.</p>
              ) : (
                state.events.map((evt, i) => {
                  const Icon = EVENT_ICONS[evt.type] ?? Footprints;
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded px-2 py-1.5 text-xs ${
                        evt.type === 'goal' ? 'bg-primary/10' : 'hover:bg-muted/20'
                      }`}
                    >
                      <span className="mt-0.5 w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                        {formatMatchMinute(evt.time)}
                      </span>
                      <Icon size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 leading-snug">{evt.description}</span>
                      <span className="shrink-0 rounded bg-muted/40 px-1 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
                        {evt.team === 'home' ? homeFormation : awayFormation}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === 'replay' && (
          <div className="animate-in fade-in-50 duration-200">
            <div className="flex flex-col items-center justify-center rounded-lg bg-card py-16 px-6 text-center">
              <Clock size={32} className="mb-3 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                Replay viewer coming soon
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Step through every move of this match
              </p>
            </div>
          </div>
        )}

          {/* ── Actions ─────────────────────────────────────────────── */}
          <div className="space-y-3 mt-auto">
            <Button className="h-14 w-full text-base font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90" onClick={onPlayAgain}>
              Play Again
            </Button>
            {onRematch && (
              <Button
                variant="outline"
                className="h-14 w-full text-sm font-bold uppercase tracking-wider border-border text-foreground hover:bg-muted"
                onClick={onRematch}
              >
                Rematch — Swap Sides
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
