import type { Fixture } from '../types/index.js';

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

  return data.matches.map((match) => ({
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
    homeTeamColors: parseTeamColors(match.homeTeam.name),
    awayTeamColors: parseTeamColors(match.awayTeam.name),
  }));
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