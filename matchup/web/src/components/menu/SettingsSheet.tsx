import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ArrowLeft, Volume2, VolumeOff } from 'lucide-react';
import { loadSettings, updateSettings, type Settings, type Difficulty } from '@/lib/settings';
import { useTheme } from 'next-themes';

interface SettingsSheetProps {
  onBack: () => void;
}

const DIFFICULTIES: { value: Difficulty; label: string; desc: string }[] = [
  { value: 'easy', label: 'EASY', desc: 'AI plays safe, rarely shoots' },
  { value: 'normal', label: 'NORMAL', desc: 'Balanced aggression' },
  { value: 'hard', label: 'HARD', desc: 'Tactical AI, minimizes risk' },
];

const THEMES = [
  { name: 'light', label: 'Light', swatch: '#ffffff' },
  { name: 'dark', label: 'Dark', swatch: '#1a1a1a' },
  { name: 'high-contrast', label: 'Contrast', swatch: '#064e3b' },
  { name: 'night-mode', label: 'Night', swatch: '#2a1f0f' },
  { name: 'pitch-dark', label: 'Pitch Dark', swatch: '#050505' },
  { name: 'ferrous', label: 'Ferrous', swatch: '#0a0a0a' },
  { name: 'skeleton', label: 'Skeleton', swatch: '#f3f3f3' },
];

export function SettingsSheet({ onBack }: SettingsSheetProps) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const { theme, setTheme } = useTheme();

  // Persist on every change
  useEffect(() => {
    updateSettings(settings);
  }, [settings]);

  const patch = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));

  return (
    <div className="flex min-h-dvh flex-col p-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-9 w-9 px-0" onClick={onBack}>
          <ArrowLeft size={18} />
        </Button>
        <h2 className="text-lg font-bold uppercase tracking-wide">Settings</h2>
      </div>

      <div className="mx-auto w-full max-w-md space-y-6">
        {/* ── Difficulty ────────────────────────────────────── */}
        <div className="space-y-2">
          <Label>AI Difficulty</Label>
          <ToggleGroup
            value={[settings.difficulty]}
            onValueChange={(val) => { if (val.length > 0) patch({ difficulty: val[val.length - 1] as Difficulty }); }}
            variant="outline"
            className="grid w-full grid-cols-3 gap-1.5"
          >
            {DIFFICULTIES.map((d) => (
              <ToggleGroupItem
                key={d.value}
                value={d.value}
                className="flex h-auto flex-col gap-0.5 px-3 py-2.5"
              >
                <span className="text-[11px] font-bold">{d.label}</span>
                <span className="text-[9px] leading-tight opacity-70">{d.desc}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <Separator />

        {/* ── Sound ────────────────────────────────────────── */}
        <div className="space-y-3">
          <Label>Sound</Label>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 px-0"
              onClick={() => patch({ soundEnabled: !settings.soundEnabled })}
              aria-label={settings.soundEnabled ? 'Mute' : 'Unmute'}
            >
              {settings.soundEnabled ? <Volume2 size={18} /> : <VolumeOff size={18} />}
            </Button>
            <Slider
              min={0}
              max={100}
              value={[Math.round(settings.volume * 100)]}
              onValueChange={(val) => patch({ volume: (val as number[])[0] / 100 })}
              disabled={!settings.soundEnabled}
              className="flex-1"
            />
            <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
              {Math.round(settings.volume * 100)}
            </span>
          </div>
        </div>

        <Separator />

        {/* ── Theme ───────────────────────────────────────── */}
        <div className="space-y-2">
          <Label>Theme</Label>
          <ToggleGroup
            value={[theme ?? 'dark']}
            onValueChange={(val) => { if (val.length > 0) setTheme(val[val.length - 1]); }}
            variant="outline"
            className="flex flex-wrap gap-2"
          >
            {THEMES.map((t) => (
              <ToggleGroupItem
                key={t.name}
                value={t.name}
                className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold"
              >
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border border-foreground/20"
                  style={{ backgroundColor: t.swatch }}
                />
                {t.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <Separator />

        {/* ── Gameplay ─────────────────────────────────────── */}
        <div className="space-y-3">
          <Label>Gameplay Defaults</Label>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal normal-case tracking-normal">Passing lanes</Label>
            <Switch
              checked={settings.passingLanes}
              onCheckedChange={(v) => patch({ passingLanes: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal normal-case tracking-normal">Tackle zones</Label>
            <Switch
              checked={settings.tackleZones}
              onCheckedChange={(v) => patch({ tackleZones: v })}
            />
          </div>
        </div>

        <Separator />

        {/* ── Accessibility ────────────────────────────────── */}
        <div className="space-y-3">
          <Label>Accessibility</Label>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal normal-case tracking-normal">Reduced motion</Label>
            <Switch
              checked={settings.reducedMotion}
              onCheckedChange={(v) => patch({ reducedMotion: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal normal-case tracking-normal">Color-blind mode</Label>
            <Switch
              checked={settings.colorBlind}
              onCheckedChange={(v) => patch({ colorBlind: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
