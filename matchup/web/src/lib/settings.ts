const STORAGE_KEY = 'matchup.settings.v1';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Settings {
  passingLanes: boolean;
  tackleZones: boolean;
  soundEnabled: boolean;
  volume: number;
  reducedMotion: boolean;
  colorBlind: boolean;
  difficulty: Difficulty;
  tutorialCompleted: boolean;
}

export const defaultSettings: Settings = {
  passingLanes: true,
  tackleZones: true,
  soundEnabled: true,
  volume: 0.6,
  reducedMotion: false,
  colorBlind: false,
  difficulty: 'normal',
  tutorialCompleted: false,
};

function readStorage(): Partial<Settings> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<Settings>;
  } catch {
    return null;
  }
}

function writeStorage(value: Settings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

export function loadSettings(): Settings {
  const stored = readStorage();
  return { ...defaultSettings, ...(stored ?? {}) };
}

export function saveSettings(settings: Settings): void {
  writeStorage(settings);
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch };
  writeStorage(next);
  return next;
}
