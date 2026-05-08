import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Gamepad2, GraduationCap, Settings, BookOpen, PlayCircle, History, User } from 'lucide-react';
import { SettingsSheet } from './SettingsSheet';
import { loadSavedMatch } from '@/lib/storage';

interface MenuScreenProps {
  onPlay: () => void;
  onContinue: () => void;
  onTutorial: () => void;
  onShowRulebook: () => void;
  onHistory: () => void;
  onProfile: () => void;
}

export function MenuScreen({ onPlay, onContinue, onTutorial, onShowRulebook, onHistory, onProfile }: MenuScreenProps) {
  const [showSettings, setShowSettings] = useState(false);

  const save = loadSavedMatch();
  const hasSave = !!save;
  const saveInfo = save
    ? `${save.state.score.home} – ${save.state.score.away} · ${Math.floor((5400 - save.state.timeRemaining) / 60)}'`
    : '';

  if (showSettings) {
    return <SettingsSheet onBack={() => setShowSettings(false)} />;
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center p-4">
      <div className="absolute right-3 top-3">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-xs space-y-8">
        {/* Wordmark */}
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-black uppercase tracking-tight">
            Matchup
          </h1>
          <p className="text-sm leading-tight text-muted-foreground">
            Play the match. Own the result.
          </p>
        </div>

        {/* Menu items */}
        <div className="space-y-2.5">
          {hasSave && (
            <Button
              className="h-[52px] w-full text-sm font-bold uppercase tracking-wide"
              onClick={onContinue}
            >
              <PlayCircle size={18} className="mr-2" />
              <span className="flex flex-col items-start leading-tight">
                <span>Continue</span>
                <span className="text-[10px] font-normal opacity-70">{saveInfo}</span>
              </span>
            </Button>
          )}

          <Button
            variant={hasSave ? 'outline' : 'default'}
            className="h-[52px] w-full text-sm font-bold uppercase tracking-wide"
            onClick={onPlay}
          >
            <Gamepad2 size={18} className="mr-2" />
            Play
          </Button>

          <Button
            variant="outline"
            className="h-[52px] w-full text-sm font-bold uppercase tracking-wide"
            onClick={onTutorial}
          >
            <GraduationCap size={18} className="mr-2" />
            Tutorial
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-[44px] text-xs font-bold uppercase tracking-wide"
              onClick={onHistory}
            >
              <History size={16} className="mr-1.5" />
              History
            </Button>
            <Button
              variant="outline"
              className="h-[44px] text-xs font-bold uppercase tracking-wide"
              onClick={onProfile}
            >
              <User size={16} className="mr-1.5" />
              Profile
            </Button>
          </div>

          <Button
            variant="ghost"
            className="h-[44px] w-full text-xs font-bold uppercase tracking-wide text-muted-foreground"
            onClick={() => setShowSettings(true)}
          >
            <Settings size={16} className="mr-1.5" />
            Settings
          </Button>

          <Button
            variant="ghost"
            className="h-[44px] w-full text-xs font-bold uppercase tracking-wide text-muted-foreground"
            onClick={onShowRulebook}
          >
            <BookOpen size={16} className="mr-1.5" />
            How to Play
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground/50">
          Built for football heads
        </p>
      </div>
    </div>
  );
}
