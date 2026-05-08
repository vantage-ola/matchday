import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listFormations, type FormationName, type GameMode } from '@/lib/engine';
import { ThemeToggle } from '@/components/theme-toggle';
import { ArrowLeft } from 'lucide-react';

interface SetupScreenProps {
  onStart: (mode: GameMode, homeFormation: FormationName, awayFormation: FormationName) => void;
  onShowRulebook: () => void;
  onBack: () => void;
}

export function SetupScreen({ onStart, onShowRulebook, onBack }: SetupScreenProps) {
  const formations = listFormations();
  const [mode, setMode] = useState<GameMode>('local');
  const [homeFormation, setHomeFormation] = useState<FormationName>('4-3-3');
  const [awayFormation, setAwayFormation] = useState<FormationName>('4-3-3');

  return (
    <div className="relative flex min-h-dvh items-center justify-center p-4">
      <div className="absolute left-3 top-3">
        <Button variant="ghost" size="sm" className="h-9 w-9 px-0" onClick={onBack}>
          <ArrowLeft size={18} />
        </Button>
      </div>
      <div className="absolute right-3 top-3">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-3xl font-bold tracking-tight">MATCHUP</h1>
          <p className="text-sm text-muted-foreground">Play the match. Own the result.</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={mode === 'local' ? 'default' : 'outline'}
            onClick={() => setMode('local')}
            className="h-12"
          >
            1v1 LOCAL
          </Button>
          <Button
            variant={mode === 'ai' ? 'default' : 'outline'}
            onClick={() => setMode('ai')}
            className="h-12"
          >
            VS AI
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {mode === 'ai' ? 'YOUR FORMATION' : 'HOME FORMATION'}
            </label>
            <Select value={homeFormation} onValueChange={(v) => setHomeFormation(v as FormationName)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formations.map((f) => (
                  <SelectItem key={f.name} value={f.name}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {mode === 'ai' ? 'AI FORMATION' : 'AWAY FORMATION'}
            </label>
            <Select value={awayFormation} onValueChange={(v) => setAwayFormation(v as FormationName)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formations.map((f) => (
                  <SelectItem key={f.name} value={f.name}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button className="h-12 w-full text-lg font-bold" onClick={() => onStart(mode, homeFormation, awayFormation)}>
          KICK OFF
        </Button>
        <Button variant="outline" className="h-10 w-full" onClick={onShowRulebook}>
          HOW TO PLAY
        </Button>
      </div>
    </div>
  );
}
