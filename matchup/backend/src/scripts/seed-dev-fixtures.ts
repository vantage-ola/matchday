/**
 * Dev fixture seeding script — creates hardcoded fixtures for local testing.
 * Run: bun run src/scripts/seed-dev-fixtures.ts
 */
import { prisma } from '../db/prisma.js';

const DEV_FIXTURES = [
  {
    externalId: 'dev-001',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    league: 'Premier League',
    hoursFromNow: 2,
  },
  {
    externalId: 'dev-002',
    homeTeam: 'Manchester United',
    awayTeam: 'Liverpool',
    league: 'Premier League',
    hoursFromNow: 4,
  },
  {
    externalId: 'dev-003',
    homeTeam: 'Barcelona',
    awayTeam: 'Real Madrid',
    league: 'La Liga',
    hoursFromNow: 6,
  },
  {
    externalId: 'dev-004',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Borussia Dortmund',
    league: 'Bundesliga',
    hoursFromNow: 8,
  },
  {
    externalId: 'dev-005',
    homeTeam: 'Inter Milan',
    awayTeam: 'AC Milan',
    league: 'Serie A',
    hoursFromNow: 10,
  },
  {
    externalId: 'dev-006',
    homeTeam: 'PSG',
    awayTeam: 'Marseille',
    league: 'Ligue 1',
    hoursFromNow: 12,
  },
  {
    externalId: 'dev-007',
    homeTeam: 'Manchester City',
    awayTeam: 'Tottenham',
    league: 'Premier League',
    hoursFromNow: 24,
  },
  {
    externalId: 'dev-008',
    homeTeam: 'Atletico Madrid',
    awayTeam: 'Sevilla',
    league: 'La Liga',
    hoursFromNow: 26,
  },
  {
    externalId: 'dev-009',
    homeTeam: 'Juventus',
    awayTeam: 'Napoli',
    league: 'Serie A',
    hoursFromNow: 30,
  },
];

async function seedDevFixtures() {
  console.log('Seeding dev fixtures...');
  let created = 0;

  for (const fixture of DEV_FIXTURES) {
    const existing = await prisma.fixture.findFirst({
      where: { external_id: fixture.externalId },
    });

    if (!existing) {
      const kickoffAt = new Date(Date.now() + fixture.hoursFromNow * 60 * 60 * 1000);
      
      await prisma.fixture.create({
        data: {
          external_id: fixture.externalId,
          home_team: fixture.homeTeam,
          away_team: fixture.awayTeam,
          league: fixture.league,
          kickoff_at: kickoffAt,
          status: 'scheduled',
        },
      });
      created++;
      console.log(`  Created: ${fixture.homeTeam} vs ${fixture.awayTeam} (${fixture.league})`);
    } else {
      // Update kickoff time to keep fixtures always in the future
      const kickoffAt = new Date(Date.now() + fixture.hoursFromNow * 60 * 60 * 1000);
      await prisma.fixture.update({
        where: { id: existing.id },
        data: { kickoff_at: kickoffAt, status: 'scheduled' },
      });
      console.log(`  Updated: ${fixture.homeTeam} vs ${fixture.awayTeam} (${fixture.league})`);
    }
  }

  console.log(`\nDone! Created ${created} new fixtures. Total: ${DEV_FIXTURES.length}`);
  process.exit(0);
}

seedDevFixtures().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
