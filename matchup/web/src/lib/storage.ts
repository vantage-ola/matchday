/**
 * Persistence layer for Matchup.
 *
 * - **Active match save**: localStorage (single slot, fast sync reads).
 * - **Match history + profile**: IndexedDB via idb-keyval (async, no size cap).
 */

import { get, set } from 'idb-keyval';
import type { GameState, FormationName, GameMode, MatchEvent } from './engine';

// ─── Types ───────────────────────────────────────────────────────────────

export interface MatchSave {
  matchId: string;
  state: GameState;
  mode: GameMode;
  homeFormation: FormationName;
  awayFormation: FormationName;
  difficulty: string;
  savedAt: number;
}

export interface MatchRecord {
  matchId: string;
  homeFormation: FormationName;
  awayFormation: FormationName;
  mode: GameMode;
  score: { home: number; away: number };
  result: 'win' | 'loss' | 'draw';
  events: MatchEvent[];
  seed: number;
  playedAt: number;
}

export interface PlayerProfile {
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
}

const EMPTY_PROFILE: PlayerProfile = {
  matchesPlayed: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsScored: 0,
  goalsConceded: 0,
};

// ─── Active match save (localStorage — sync) ────────────────────────────

const SAVE_KEY = 'matchup.save.v1';

export function saveMatch(save: MatchSave): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // quota / private mode
  }
}

export function loadSavedMatch(): MatchSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MatchSave;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

// ─── Match history (IndexedDB) ──────────────────────────────────────────

const HISTORY_KEY = 'matchup.history.v1';
const MAX_HISTORY = 50;

export async function addMatchToHistory(record: MatchRecord): Promise<void> {
  const history = await getMatchHistory();
  history.unshift(record);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  await set(HISTORY_KEY, history);
}

export async function getMatchHistory(): Promise<MatchRecord[]> {
  const data = await get<MatchRecord[]>(HISTORY_KEY);
  return data ?? [];
}

// ─── Player profile (IndexedDB) ─────────────────────────────────────────

const PROFILE_KEY = 'matchup.profile.v1';

export async function getProfile(): Promise<PlayerProfile> {
  const data = await get<PlayerProfile>(PROFILE_KEY);
  return data ?? { ...EMPTY_PROFILE };
}

export async function updateProfile(record: MatchRecord): Promise<PlayerProfile> {
  const profile = await getProfile();
  profile.matchesPlayed++;
  profile.goalsScored += record.score.home;
  profile.goalsConceded += record.score.away;
  if (record.result === 'win') profile.wins++;
  else if (record.result === 'draw') profile.draws++;
  else profile.losses++;
  await set(PROFILE_KEY, profile);
  return profile;
}
