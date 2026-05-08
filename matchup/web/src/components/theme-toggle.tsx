import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

const themes = [
  { name: 'light', label: 'Light' },
  { name: 'dark', label: 'Dark' },
  { name: 'high-contrast', label: 'High Contrast' },
  { name: 'night-mode', label: 'Night' },
  { name: 'pitch-dark', label: 'Pitch Dark' },
  { name: 'ferrous', label: 'Ferrous' },
  { name: 'skeleton', label: 'Skeleton' },
] as const;

const ICONS: Record<string, string> = {
  light: '☀',
  dark: '☾',
  'high-contrast': '◐',
  'night-mode': '☁',
  'pitch-dark': '●',
  ferrous: '⬡',
  skeleton: '△',
};

const emptySubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <button
        className="flex h-8 w-8 items-center justify-center text-base text-muted-foreground"
        aria-label="Theme"
      >
        ☾
      </button>
    );
  }

  const current = themes.find((t) => t.name === theme) || themes[1];

  const cycle = () => {
    const i = themes.findIndex((t) => t.name === theme);
    const next = themes[(i + 1) % themes.length];
    setTheme(next.name);
  };

  return (
    <button
      onClick={cycle}
      className="flex h-8 w-8 items-center justify-center text-base text-muted-foreground transition-colors hover:text-foreground"
      title={`Theme: ${current.label}`}
      aria-label={`Theme: ${current.label}`}
    >
      {ICONS[current.name]}
    </button>
  );
}

