import type { Fixture } from '../types/index.js';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';

const BASE_URL = 'https://api.football-data.org/v4';

export interface TeamDetails {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  clubColors: string;
  venue: string;
  area: {
    name: string;
    flag: string;
  };
  runningCompetitions: {
    id: number;
    name: string;
    code: string;
    emblem: string;
  }[];
  coach: {
    firstName: string;
    lastName: string;
    name: string;
  };
  squad: TeamPlayer[];
}

export interface TeamPlayer {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  position: string;
  dateOfBirth: string;
  nationality: string;
  shirtNumber: number;
  marketValue: number | null;
}

export interface TeamColors {
  primary: string;
  secondary: string;
  text: string;
}

interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  competition?: {
    id: number;
    name: string;
    code: string;
  };
  venue?: string;
}

interface FootballDataResponse {
  count: number;
  matches: FootballDataMatch[];
}

async function fetchWithToken<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'X-Auth-Token': process.env.FOOTBALL_API_KEY ?? '',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Football API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function fetchMatches(
  competitionCode: string,
  dateFrom?: string,
  dateTo?: string
): Promise<Fixture[]> {
  let endpoint = `/competitions/${competitionCode}/matches`;
  const params = new URLSearchParams();

  if (dateFrom) {
    params.set('dateFrom', dateFrom);
  }
  if (dateTo) {
    params.set('dateTo', dateTo);
  }
  params.set('status', 'SCHEDULED');

  if (params.toString()) {
    endpoint += `?${params.toString()}`;
  }

  const data = await fetchWithToken<FootballDataResponse>(endpoint);

  const fixtures = await Promise.all(data.matches.map(async (match) => {
    const homeColors = await getTeamColors(match.homeTeam.name);
    const awayColors = await getTeamColors(match.awayTeam.name);
    return {
      id: crypto.randomUUID(),
      externalId: String(match.id),
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      homeTeamLogo: match.homeTeam.crest,
      awayTeamLogo: match.awayTeam.crest,
      league: match.competition?.name ?? competitionCode,
      kickoffAt: new Date(match.utcDate),
      status: mapStatus(match.status),
      realHomeGoals: match.score.fullTime.home,
      realAwayGoals: match.score.fullTime.away,
      rawResult: match as unknown as Record<string, unknown>,
      createdAt: new Date(),
      homeTeamColors: homeColors,
      awayTeamColors: awayColors,
    };
  }));

  return fixtures;
}

export async function fetchRealResult(
  externalFixtureId: string
): Promise<{ homeGoals: number; awayGoals: number; status: string }> {
  const data = await fetchWithToken<FootballDataMatch>(`/matches/${externalFixtureId}`);

  return {
    homeGoals: data.score.fullTime.home ?? 0,
    awayGoals: data.score.fullTime.away ?? 0,
    status: data.status,
  };
}

export async function fetchTeam(teamId: number): Promise<TeamDetails | null> {
  try {
    return await fetchWithToken<TeamDetails>(`/teams/${teamId}`);
  } catch {
    return null;
  }
}

const TEAM_COLOR_MAP: Record<string, TeamColors> = {
  'Arsenal': { primary: '#EF0107', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Aston Villa': { primary: '#670E36', secondary: '#95BFE5', text: '#FFFFFF' },
  'Bournemouth': { primary: '#DA291C', secondary: '#000000', text: '#FFFFFF' },
  'Brentford': { primary: '#E30613', secondary: '#FFB81C', text: '#FFFFFF' },
  'Brighton & Hove Albion': { primary: '#0057B8', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Burnley': { primary: '#6C1D45', secondary: '#99D6EA', text: '#FFFFFF' },
  'Chelsea': { primary: '#034694', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Crystal Palace': { primary: '#1B458F', secondary: '#C4122E', text: '#FFFFFF' },
  'Everton': { primary: '#003399', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Fulham': { primary: '#FFFFFF', secondary: '#000000', text: '#000000' },
  'Ipswich Town': { primary: '#0044AA', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Leicester City': { primary: '#003090', secondary: '#FDBE11', text: '#FFFFFF' },
  'Liverpool': { primary: '#C8102E', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Luton Town': { primary: '#F78F1E', secondary: '#002D62', text: '#FFFFFF' },
  'Manchester City': { primary: '#6CABDD', secondary: '#FFFFFF', text: '#1C2C5B' },
  'Manchester United': { primary: '#DA291C', secondary: '#FBE122', text: '#FFFFFF' },
  'Newcastle United': { primary: '#241F20', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Nottingham Forest': { primary: '#DD0000', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Sheffield United': { primary: '#EE2737', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Southampton': { primary: '#D71920', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Tottenham Hotspur': { primary: '#FFFFFF', secondary: '#132257', text: '#132257' },
  'West Ham United': { primary: '#7A263A', secondary: '#1BB1E7', text: '#FFFFFF' },
  'Wolverhampton': { primary: '#FDB913', secondary: '#231F20', text: '#231F20' },
  'Barcelona': { primary: '#A50044', secondary: '#004D98', text: '#FFFFFF' },
  'Real Madrid': { primary: '#FFFFFF', secondary: '#FEBE10', text: '#000000' },
  'Atletico Madrid': { primary: '#CB3524', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Bayern Munich': { primary: '#DC052D', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Borussia Dortmund': { primary: '#FDE100', secondary: '#000000', text: '#000000' },
  'AC Milan': { primary: '#FB090B', secondary: '#000000', text: '#FFFFFF' },
  'Inter Milan': { primary: '#010E80', secondary: '#000000', text: '#FFFFFF' },
  'Juventus': { primary: '#000000', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Napoli': { primary: '#12A0D7', secondary: '#FFFFFF', text: '#FFFFFF' },
  'AS Roma': { primary: '#8E1F2F', secondary: '#F0BC42', text: '#FFFFFF' },
  'Paris Saint-Germain': { primary: '#004170', secondary: '#DA291C', text: '#FFFFFF' },
  'Olympique de Marseille': { primary: '#2FAEE0', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Olympique Lyonnais': { primary: '#FFFFFF', secondary: '#DA291C', text: '#DA291C' },
};

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 65%, 45%)`;
}

function textForBg(hex: string): string {
  if (hex.startsWith('hsl')) return '#FFFFFF';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export function parseTeamColors(teamName: string, apiColors?: string): TeamColors {
  const directMatch = TEAM_COLOR_MAP[teamName];
  if (directMatch) return directMatch;

  for (const [key, colors] of Object.entries(TEAM_COLOR_MAP)) {
    if (teamName.includes(key) || key.includes(teamName)) {
      return colors;
    }
  }

  if (apiColors) {
    const parts = apiColors.split(/\s*\/\s*/);
    const firstColor = parts[0]?.trim();
    if (firstColor) {
      const parsed = hexFromColorName(firstColor);
      const secondColor = parts[1]?.trim();
      return {
        primary: parsed,
        secondary: secondColor ? hexFromColorName(secondColor) : '#FFFFFF',
        text: textForBg(parsed),
      };
    }
  }

  return {
    primary: hashColor(teamName),
    secondary: '#FFFFFF',
    text: textForBg(hashColor(teamName)),
  };
}

function hexFromColorName(colorName: string): string {
  const colorMap: Record<string, string> = {
    red: '#DA291C', blue: '#004D98', sky: '#6CABDD', skyblue: '#6CABDD', navy: '#001F3F',
    green: '#00954C', white: '#FFFFFF', black: '#000000', yellow: '#FDB913', orange: '#F78F1E',
    purple: '#660066', pink: '#FF69B4', grey: '#808080', gray: '#808080', maroon: '#800000',
    crimson: '#DC143C', gold: '#FFD700', amber: '#FFBF00', turquoise: '#40E0D0', teal: '#008080',
  };
  const lower = colorName.toLowerCase();
  if (colorMap[lower]) return colorMap[lower];
  if (/^#[0-9A-Fa-f]{6}$/.test(colorName)) return colorName;
  return hashColor(colorName);
}

export async function getTeamColors(teamName: string): Promise<TeamColors> {
  const cached = await prisma.teamColors.findUnique({ where: { team_name: teamName } });
  if (cached) {
    return { primary: cached.primary, secondary: cached.secondary, text: cached.text };
  }

  let colors = TEAM_COLOR_MAP[teamName];
  if (!colors) {
    for (const [key, c] of Object.entries(TEAM_COLOR_MAP)) {
      if (teamName.includes(key) || key.includes(teamName)) {
        colors = c;
        break;
      }
    }
  }

  if (!colors) {
    colors = { primary: hashColor(teamName), secondary: '#FFFFFF', text: textForBg(hashColor(teamName)) };
  }

  const rawColors = colors.primary === '#FFFFFF' ? 'White' :
    Object.entries({
      '#EF0107': 'Red', '#670E36': 'Claret', '#DA291C': 'Red', '#E30613': 'Red', '#0057B8': 'Blue',
      '#6C1D45': 'Claret', '#034694': 'Blue', '#1B458F': 'Blue', '#003399': 'Blue',
      '#0044AA': 'Blue', '#003090': 'Blue', '#C8102E': 'Red', '#F78F1E': 'Orange',
      '#6CABDD': 'Sky Blue', '#FBE122': 'Yellow', '#241F20': 'Black', '#DD0000': 'Red',
      '#EE2737': 'Red', '#D71920': 'Red', '#132257': 'Navy', '#7A263A': 'Claret',
      '#FDB913': 'Gold', '#A50044': 'Red', '#004D98': 'Blue', '#CB3524': 'Red',
      '#DC052D': 'Red', '#FDE100': 'Yellow', '#FB090B': 'Red', '#010E80': 'Blue',
      '#000000': 'Black', '#12A0D7': 'Sky Blue', '#8E1F2F': 'Red', '#004170': 'Blue',
      '#2FAEE0': 'Blue',
    }).find(([, name]) => colors!.primary.toUpperCase() === name)?.[0] || 'Unknown';

  await prisma.teamColors.upsert({
    where: { team_name: teamName },
    create: { team_name: teamName, primary: colors.primary, secondary: colors.secondary, text: colors.text, club_colors: rawColors },
    update: { primary: colors.primary, secondary: colors.secondary, text: colors.text, club_colors: rawColors, updated_at: new Date() },
  });

  return colors;
}

export async function fetchTodayMatches(): Promise<Fixture[]> {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  return fetchMatches('PL', dateStr, dateStr);
}

export async function fetchUpcomingMatches(
  competitionCode: string,
  daysAhead: number = 7
): Promise<Fixture[]> {
  const today = new Date();
  const future = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const dateFrom = today.toISOString().split('T')[0];
  const dateTo = future.toISOString().split('T')[0];

  return fetchMatches(competitionCode, dateFrom, dateTo);
}

function mapStatus(apiStatus: string): 'scheduled' | 'live' | 'finished' {
  switch (apiStatus) {
    case 'SCHEDULED':
    case 'TIMED':
    case 'POSTPONED':
      return 'scheduled';
    case 'LIVE':
    case 'IN_PLAY':
    case 'PAUSED':
      return 'live';
    case 'FINISHED':
    case 'AWARDED':
    case 'SUSPENDED':
    case 'CANCELLED':
      return 'finished';
    default:
      return 'scheduled';
  }
}

const SQUAD_CACHE_TTL = 60 * 60 * 24; // 24h in seconds
const TEAM_CACHE_TTL = 60 * 60 * 24; // 24h in seconds

async function fetchTeamCached(teamId: number): Promise<TeamDetails | null> {
  const cacheKey = `team:${teamId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as TeamDetails;
  }

  const team = await fetchTeam(teamId);
  if (team) {
    await redis.setex(cacheKey, TEAM_CACHE_TTL, JSON.stringify(team));
  }
  return team;
}

const TEAM_NAME_TO_API_ID: Record<string, number> = {
  'Arsenal FC': 57, 'Arsenal': 57,
  'Aston Villa FC': 58, 'Aston Villa': 58,
  'AFC Bournemouth': 1044, 'Bournemouth': 1044,
  'Brentford FC': 402, 'Brentford': 402,
  'Brighton & Hove Albion FC': 397, 'Brighton': 397,
  'Chelsea FC': 61, 'Chelsea': 61,
  'Crystal Palace FC': 354, 'Crystal Palace': 354,
  'Everton FC': 62, 'Everton': 62,
  'Fulham FC': 63, 'Fulham': 63,
  'Ipswich Town FC': 349, 'Ipswich Town': 349,
  'Leicester City FC': 338, 'Leicester City': 338,
  'Liverpool FC': 64, 'Liverpool': 64,
  'Manchester City FC': 65, 'Manchester City': 65,
  'Manchester United FC': 66, 'Manchester United': 66,
  'Newcastle United FC': 67, 'Newcastle United': 67,
  'Nottingham Forest FC': 351, 'Nottingham Forest': 351,
  'Southampton FC': 340, 'Southampton': 340,
  'Tottenham Hotspur FC': 73, 'Tottenham Hotspur': 73,
  'West Ham United FC': 563, 'West Ham United': 563,
  'Wolverhampton Wanderers FC': 76, 'Wolverhampton Wanderers': 76,
  'FC Barcelona': 81, 'Barcelona': 81,
  'Real Madrid CF': 86, 'Real Madrid': 86,
  'Club Atlético de Madrid': 78, 'Atletico Madrid': 78,
  'FC Bayern München': 5, 'Bayern Munich': 5,
  'Borussia Dortmund': 4,
  'AC Milan': 98,
  'FC Internazionale Milano': 108, 'Inter Milan': 108,
  'Juventus FC': 109, 'Juventus': 109,
  'SSC Napoli': 113, 'Napoli': 113,
  'AS Roma': 100,
  'Paris Saint-Germain FC': 524, 'Paris Saint-Germain': 524,
  'Olympique de Marseille': 516,
  'Olympique Lyonnais': 523,
};

function teamIdFromName(name: string): number | null {
  if (TEAM_NAME_TO_API_ID[name]) return TEAM_NAME_TO_API_ID[name];

  const normalized = name.toLowerCase();
  for (const [teamName, teamId] of Object.entries(TEAM_NAME_TO_API_ID)) {
    if (normalized.includes(teamName.toLowerCase()) || teamName.toLowerCase().includes(normalized)) {
      return teamId;
    }
  }
  return null;
}

export async function fetchSquadForFixture(
  fixtureId: string
): Promise<{ home: TeamPlayer[]; away: TeamPlayer[] }> {
  const cacheKey = `squad:${fixtureId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as { home: TeamPlayer[]; away: TeamPlayer[] };
  }

  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
  });

  if (!fixture) {
    return { home: [], away: [] };
  }

  let homeTeamId: number | null = null;
  let awayTeamId: number | null = null;

  // Try to extract team IDs from raw_result (most reliable — comes from the API response)
  const rawResult = fixture.raw_result as Record<string, unknown> | null;
  if (rawResult) {
    const homeTeam = rawResult.homeTeam as { id?: number } | undefined;
    const awayTeam = rawResult.awayTeam as { id?: number } | undefined;
    if (homeTeam?.id) homeTeamId = homeTeam.id;
    if (awayTeam?.id) awayTeamId = awayTeam.id;
  }

  // Fall back to name mapping
  if (!homeTeamId) homeTeamId = teamIdFromName(fixture.home_team);
  if (!awayTeamId) awayTeamId = teamIdFromName(fixture.away_team);

  if (!homeTeamId || !awayTeamId) {
    return { home: [], away: [] };
  }

  let homeSquad: TeamPlayer[] = [];
  let awaySquad: TeamPlayer[] = [];

  try {
    const homeDetails = await fetchTeamCached(homeTeamId);
    homeSquad = homeDetails?.squad ?? [];
  } catch (e) {
    console.error('Failed to fetch home squad:', e);
  }

  try {
    const awayDetails = await fetchTeamCached(awayTeamId);
    awaySquad = awayDetails?.squad ?? [];
  } catch (e) {
    console.error('Failed to fetch away squad:', e);
  }

  const result = { home: homeSquad, away: awaySquad };
  if (homeSquad.length > 0 || awaySquad.length > 0) {
    await redis.setex(cacheKey, SQUAD_CACHE_TTL, JSON.stringify(result));
  }

  return result;
}

export function selectStarting11(squad: TeamPlayer[]): MatchLineupPlayer[] {
  const grouped: Record<'gk' | 'def' | 'mid' | 'fwd', TeamPlayer[]> = {
    gk: [], def: [], mid: [], fwd: [],
  };

  for (const p of squad) {
    if (!p.position) continue;
    const role = mapApiPositionToRole(p.position);
    grouped[role].push(p);
  }

  // Sort each group by market value descending (best players first)
  for (const role of Object.keys(grouped) as Array<keyof typeof grouped>) {
    grouped[role].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));
  }

  const picks: TeamPlayer[] = [];
  const target = { gk: 1, def: 4, mid: 3, fwd: 3 };

  for (const role of ['gk', 'def', 'mid', 'fwd'] as const) {
    const available = grouped[role];
    const need = target[role];
    picks.push(...available.slice(0, need));
  }

  // If we have fewer than 11 (e.g. squad has no forwards listed), fill from largest remaining group
  if (picks.length < 11) {
    const picked = new Set(picks.map(p => p.id));
    const remaining = squad
      .filter(p => !picked.has(p.id) && p.position)
      .sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));
    for (const p of remaining) {
      if (picks.length >= 11) break;
      picks.push(p);
    }
  }

  return picks.slice(0, 11).map(p => ({
    id: p.id,
    name: p.name,
    position: p.position,
    shirtNumber: p.shirtNumber ?? 0,
    marketValue: p.marketValue,
  }));
}

export interface MatchLineupPlayer {
  id: number;
  name: string;
  position: string;
  shirtNumber: number;
  marketValue?: number | null;
}

export interface MatchLineup {
  formation: string;
  lineup: MatchLineupPlayer[];
}

export interface MatchTeamLineup {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  formation: string;
  lineup: MatchLineupPlayer[];
}

interface MatchApiResponse {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: MatchTeamLineup;
  awayTeam: MatchTeamLineup;
  score: {
    fullTime: { home: number | null; away: number | null };
  };
}

const LINEUP_CACHE_TTL = 60 * 60; // 1h in seconds

export async function fetchMatchLineup(
  externalFixtureId: string
): Promise<{ home: MatchLineup; away: MatchLineup; formation: string } | null> {
  const cacheKey = `lineup:${externalFixtureId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as { home: MatchLineup; away: MatchLineup; formation: string };
  }

  try {
    const data = await fetchWithToken<MatchApiResponse>(`/matches/${externalFixtureId}`);

    if (!data?.homeTeam?.lineup || !data?.awayTeam?.lineup ||
        data.homeTeam.lineup.length === 0 || data.awayTeam.lineup.length === 0) {
      return null;
    }

    const homeLineup: MatchLineup = {
      formation: data.homeTeam.formation || '4-3-3',
      lineup: data.homeTeam.lineup.slice(0, 11),
    };

    const awayLineup: MatchLineup = {
      formation: data.awayTeam.formation || '4-3-3',
      lineup: data.awayTeam.lineup.slice(0, 11),
    };

    const formation = data.homeTeam.formation || '4-3-3';
    const result = { home: homeLineup, away: awayLineup, formation };
    await redis.setex(cacheKey, LINEUP_CACHE_TTL, JSON.stringify(result));

    return result;
  } catch (e) {
    console.error('Failed to fetch match lineup:', e);
    return null;
  }
}

export function marketValueToRating(marketValue: number | null | undefined): number {
  if (!marketValue || marketValue <= 0) return 60;
  
  const logValue = Math.log10(marketValue);
  const rating = Math.round(30 + logValue * 15);
  return Math.max(40, Math.min(99, rating));
}

export function mapApiPositionToRole(position: string): 'gk' | 'def' | 'mid' | 'fwd' {
  const p = position.toLowerCase();
  
  if (p.includes('goalkeeper') || p.includes('gk')) return 'gk';
  if (p.includes('back') || p.includes('defender') || p.includes('defence')) return 'def';
  if (p.includes('forward') || p.includes('striker') || p.includes('winger') || p.includes('attack')) return 'fwd';
  
  return 'mid';
}

export function getGridPositionForRole(
  role: 'gk' | 'def' | 'mid' | 'fwd',
  side: 'home' | 'away',
  position: string,
  indexInRole: number
): { col: number; row: number } {
  const attackDir = side === 'home' ? 1 : -1;
  const baseCol = side === 'home' ? 0 : 14;
  
  if (role === 'gk') {
    return { col: baseCol + attackDir * 1, row: 4 };
  }

  if (role === 'def') {
    const defPositions: Record<string, number> = {
      'right-back': 1,
      'right centre-back': 3,
      'centre-back': 3,
      'left centre-back': 5,
      'left-back': 7,
    };
    const posKey = position.toLowerCase();
    let row = defPositions[posKey] ?? (indexInRole === 0 ? 1 : indexInRole === 1 ? 3 : indexInRole === 2 ? 5 : 7);
    return { col: baseCol + attackDir * 3, row };
  }

  if (role === 'mid') {
    const midPositions: Record<string, number> = {
      'defensive midfield': 4,
      'central midfield': 4,
      'attacking midfield': 4,
      'right midfield': 2,
      'left midfield': 6,
    };
    const posKey = position.toLowerCase();
    let row = midPositions[posKey] ?? (indexInRole === 0 ? 2 : indexInRole === 1 ? 4 : 6);
    return { col: baseCol + attackDir * 6, row };
  }

  if (role === 'fwd') {
    const fwdPositions: Record<string, number> = {
      'right winger': 1,
      'centre-forward': 4,
      'left winger': 7,
      'striker': 4,
    };
    const posKey = position.toLowerCase();
    let row = fwdPositions[posKey] ?? (indexInRole === 0 ? 3 : indexInRole === 1 ? 4 : 5);
    return { col: baseCol + attackDir * 9, row };
  }

  return { col: 7, row: 4 };
}