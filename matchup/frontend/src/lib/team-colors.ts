/**
 * Team color mapping — maps team names to primary kit colors.
 * Used across the app for pitch player nodes, score bar, fixture cards, etc.
 *
 * Colors are from actual club kits. Falls back to a generated color from team name hash.
 */

export interface TeamColors {
  primary: string;
  secondary: string;
  text: string;
}

export function normalizeColors(colors?: TeamColors): TeamColors {
  if (!colors || !colors.primary) {
    return {
      primary: '#14532d',
      secondary: '#ffffff',
      text: '#ffffff',
    };
  }
  return colors;
}

const TEAM_COLORS: Record<string, TeamColors> = {
  // Premier League
  'Arsenal':            { primary: '#EF0107', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Aston Villa':        { primary: '#670E36', secondary: '#95BFE5', text: '#FFFFFF' },
  'Bournemouth':        { primary: '#DA291C', secondary: '#000000', text: '#FFFFFF' },
  'Brentford':          { primary: '#E30613', secondary: '#FFB81C', text: '#FFFFFF' },
  'Brighton':           { primary: '#0057B8', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Brighton & Hove Albion': { primary: '#0057B8', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Burnley':            { primary: '#6C1D45', secondary: '#99D6EA', text: '#FFFFFF' },
  'Chelsea':            { primary: '#034694', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Crystal Palace':     { primary: '#1B458F', secondary: '#C4122E', text: '#FFFFFF' },
  'Everton':            { primary: '#003399', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Fulham':             { primary: '#FFFFFF', secondary: '#000000', text: '#000000' },
  'Ipswich':            { primary: '#0044AA', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Ipswich Town':       { primary: '#0044AA', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Leicester':          { primary: '#003090', secondary: '#FDBE11', text: '#FFFFFF' },
  'Leicester City':     { primary: '#003090', secondary: '#FDBE11', text: '#FFFFFF' },
  'Liverpool':          { primary: '#C8102E', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Luton':              { primary: '#F78F1E', secondary: '#002D62', text: '#FFFFFF' },
  'Luton Town':         { primary: '#F78F1E', secondary: '#002D62', text: '#FFFFFF' },
  'Manchester City':    { primary: '#6CABDD', secondary: '#FFFFFF', text: '#1C2C5B' },
  'Man City':           { primary: '#6CABDD', secondary: '#FFFFFF', text: '#1C2C5B' },
  'Manchester United':  { primary: '#DA291C', secondary: '#FBE122', text: '#FFFFFF' },
  'Man United':         { primary: '#DA291C', secondary: '#FBE122', text: '#FFFFFF' },
  'Newcastle':          { primary: '#241F20', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Newcastle United':   { primary: '#241F20', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Nottingham Forest':  { primary: '#DD0000', secondary: '#FFFFFF', text: '#FFFFFF' },
  "Nott'ham Forest":    { primary: '#DD0000', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Sheffield United':   { primary: '#EE2737', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Southampton':        { primary: '#D71920', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Tottenham':          { primary: '#FFFFFF', secondary: '#132257', text: '#132257' },
  'Tottenham Hotspur':  { primary: '#FFFFFF', secondary: '#132257', text: '#132257' },
  'West Ham':           { primary: '#7A263A', secondary: '#1BB1E7', text: '#FFFFFF' },
  'West Ham United':    { primary: '#7A263A', secondary: '#1BB1E7', text: '#FFFFFF' },
  'Wolverhampton':      { primary: '#FDB913', secondary: '#231F20', text: '#231F20' },
  'Wolves':             { primary: '#FDB913', secondary: '#231F20', text: '#231F20' },

  // La Liga
  'Barcelona':          { primary: '#A50044', secondary: '#004D98', text: '#FFFFFF' },
  'Real Madrid':        { primary: '#FFFFFF', secondary: '#FEBE10', text: '#000000' },
  'Atletico Madrid':    { primary: '#CB3524', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Real Sociedad':      { primary: '#143C8B', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Real Betis':         { primary: '#00954C', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Villarreal':         { primary: '#FFE667', secondary: '#005AAA', text: '#005AAA' },
  'Sevilla':            { primary: '#FFFFFF', secondary: '#D4021D', text: '#D4021D' },

  // Bundesliga
  'Bayern Munich':      { primary: '#DC052D', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Bayern München':     { primary: '#DC052D', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Borussia Dortmund':  { primary: '#FDE100', secondary: '#000000', text: '#000000' },
  'Dortmund':           { primary: '#FDE100', secondary: '#000000', text: '#000000' },
  'RB Leipzig':         { primary: '#DD0741', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Bayer Leverkusen':   { primary: '#E32221', secondary: '#000000', text: '#FFFFFF' },

  // Serie A
  'AC Milan':           { primary: '#FB090B', secondary: '#000000', text: '#FFFFFF' },
  'Inter Milan':        { primary: '#010E80', secondary: '#000000', text: '#FFFFFF' },
  'Inter':              { primary: '#010E80', secondary: '#000000', text: '#FFFFFF' },
  'Juventus':           { primary: '#000000', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Napoli':             { primary: '#12A0D7', secondary: '#FFFFFF', text: '#FFFFFF' },
  'AS Roma':            { primary: '#8E1F2F', secondary: '#F0BC42', text: '#FFFFFF' },
  'Roma':               { primary: '#8E1F2F', secondary: '#F0BC42', text: '#FFFFFF' },

  // Ligue 1
  'PSG':                { primary: '#004170', secondary: '#DA291C', text: '#FFFFFF' },
  'Paris Saint-Germain': { primary: '#004170', secondary: '#DA291C', text: '#FFFFFF' },
  'Marseille':          { primary: '#2FAEE0', secondary: '#FFFFFF', text: '#FFFFFF' },
  'Lyon':               { primary: '#FFFFFF', secondary: '#DA291C', text: '#DA291C' },
  'Monaco':             { primary: '#E7334A', secondary: '#FFFFFF', text: '#FFFFFF' },
};

/**
 * Generate a deterministic color from a team name string.
 * Used as fallback when team isn't in the mapping.
 */
function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 65%, 45%)`;
}

function textForBg(hex: string): string {
  // Simple luminance check
  if (hex.startsWith('hsl')) return '#FFFFFF';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export function getTeamColors(teamName: string): TeamColors {
  // Try exact match first
  if (TEAM_COLORS[teamName]) return TEAM_COLORS[teamName];

  // Try partial match (e.g., "Arsenal FC" → "Arsenal")
  for (const [key, colors] of Object.entries(TEAM_COLORS)) {
    if (teamName.includes(key) || key.includes(teamName)) {
      return colors;
    }
  }

  // Fallback: generate from name hash
  const primary = hashColor(teamName);
  return {
    primary,
    secondary: '#FFFFFF',
    text: textForBg(primary),
  };
}

export function getTeamAbbr(teamName: string): string {
  // Common abbreviations
  const ABBRS: Record<string, string> = {
    'Manchester United': 'MUN', 'Man United': 'MUN',
    'Manchester City': 'MCI', 'Man City': 'MCI',
    'Tottenham Hotspur': 'TOT', 'Tottenham': 'TOT',
    'Newcastle United': 'NEW', 'Newcastle': 'NEW',
    'West Ham United': 'WHU', 'West Ham': 'WHU',
    'Crystal Palace': 'CRY', 'Wolverhampton': 'WOL', 'Wolves': 'WOL',
    'Brighton & Hove Albion': 'BHA', 'Brighton': 'BHA',
    'Nottingham Forest': 'NFO', "Nott'ham Forest": 'NFO',
    'Sheffield United': 'SHU', 'Leicester City': 'LEI', 'Leicester': 'LEI',
    'Ipswich Town': 'IPS', 'Ipswich': 'IPS', 'Luton Town': 'LUT', 'Luton': 'LUT',
    'Aston Villa': 'AVL', 'Bournemouth': 'BOU', 'Brentford': 'BRE',
    'Arsenal': 'ARS', 'Chelsea': 'CHE', 'Everton': 'EVE',
    'Fulham': 'FUL', 'Liverpool': 'LIV', 'Burnley': 'BUR', 'Southampton': 'SOU',
    'Barcelona': 'BAR', 'Real Madrid': 'RMA', 'Atletico Madrid': 'ATM',
    'Bayern Munich': 'BAY', 'Bayern München': 'BAY',
    'Borussia Dortmund': 'BVB', 'Dortmund': 'BVB',
    'PSG': 'PSG', 'Paris Saint-Germain': 'PSG',
    'Juventus': 'JUV', 'AC Milan': 'ACM', 'Inter Milan': 'INT', 'Inter': 'INT',
    'Napoli': 'NAP', 'AS Roma': 'ROM', 'Roma': 'ROM',
  };

  if (ABBRS[teamName]) return ABBRS[teamName];

  // Fallback: first 3 chars
  return teamName.slice(0, 3).toUpperCase();
}
