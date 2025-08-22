/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Defaults
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2025-07-01'; // inclusive
const DEFAULT_END_DATE = '2025-09-01'; // exclusive (covers all of July & August 2025)

// Seeding knobs
const NUM_PERSISTENT_SESSIONS = 350; // sessions that will have events in BOTH months (counted as returning)
const NEW_SESSIONS_PER_DAY_PER_MONTH = 150; // sessions unique to that month (non-returning)
const EVENTS_PER_SESSION_MIN = 1;
const EVENTS_PER_SESSION_MAX = 3;

// Import enhanced constants for realistic data
const {
  BUSINESS_EVENTS,
  PATHS,
  // DEVICES,
  // COUNTRIES,
  // UTM_SOURCES,
  // UTM_MEDIUMS,
  // UTM_CAMPAIGNS,
  pickRandomDevice,
  pickRandomBrowser,
  pickRandomCountry,
  // generateEventData,
} = require('./seed-constants');

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    switch (arg) {
      case '--website':
      case '--websiteId':
        params.websiteId = next;
        i++;
        break;
      case '--from':
      case '--start':
        params.startDate = next;
        i++;
        break;
      case '--to':
      case '--end':
        params.endDate = next;
        i++;
        break;
      case '--reset-range':
        params.resetRange = true;
        break;
      default:
        break;
    }
  }
  return {
    websiteId: params.websiteId || DEFAULT_WEBSITE_ID,
    startDate: params.startDate || DEFAULT_START_DATE,
    endDate: params.endDate || DEFAULT_END_DATE,
    resetRange: !!params.resetRange,
  };
}

// function addDays(date, days) {
//   const d = new Date(date);
//   d.setUTCDate(d.getUTCDate() + days);
//   return d;
// }

// function toDateOnlyString(d) {
//   const y = d.getUTCFullYear();
//   const m = String(d.getUTCMonth() + 1).padStart(2, '0');
//   const day = String(d.getUTCDate()).padStart(2, '0');
//   return `${y}-${m}-${day}`;
// }

function pickFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function pickInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function ensureWebsite(websiteId) {
  const existing = await prisma.website.findUnique({ where: { id: websiteId } }).catch(() => null);
  if (existing) return existing;
  return prisma.website.create({
    data: { id: websiteId, name: 'Returning Users Test', domain: 'returning-test.local' },
  });
}

async function cleanupRange(websiteId, start, end) {
  const endPlus = new Date(end.getTime() + 24 * 3600 * 1000);
  const sessionsInRange = await prisma.session.findMany({
    where: { websiteId, createdAt: { gte: start, lt: endPlus } },
    select: { id: true },
  });
  const sessionIds = sessionsInRange.map(s => s.id);
  const chunkSize = 1000;
  for (let i = 0; i < sessionIds.length; i += chunkSize) {
    const chunk = sessionIds.slice(i, i + chunkSize);
    await prisma.eventData.deleteMany({
      where: { websiteId, websiteEvent: { sessionId: { in: chunk } } },
    });
    await prisma.websiteEvent.deleteMany({ where: { websiteId, sessionId: { in: chunk } } });
  }
  await prisma.eventData.deleteMany({
    where: { websiteId, createdAt: { gte: start, lt: endPlus } },
  });
  await prisma.sessionData.deleteMany({
    where: { websiteId, createdAt: { gte: start, lt: endPlus } },
  });
  for (let i = 0; i < sessionIds.length; i += chunkSize) {
    const chunk = sessionIds.slice(i, i + chunkSize);
    await prisma.session.deleteMany({ where: { id: { in: chunk }, websiteId } });
  }
}

async function createSessions(websiteId, sessionInputs) {
  // sessionInputs: Array<{ id, createdAt, distinctId }>
  const BATCH = 500;
  const sessions = sessionInputs.map(({ id, createdAt, distinctId }) => {
    const deviceInfo = pickRandomDevice();
    const countryInfo = pickRandomCountry();
    const browserInfo = pickRandomBrowser(deviceInfo.type);

    return {
      id,
      websiteId,
      createdAt,
      distinctId,
      device: deviceInfo.type,
      country: countryInfo.code,
      browser: browserInfo.browser,
      os: deviceInfo.os,
      screen: deviceInfo.screen,
      language: 'en-US',
      region: countryInfo.region,
      city: countryInfo.city,
    };
  });

  for (let i = 0; i < sessions.length; i += BATCH) {
    const chunk = sessions.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map(s =>
        prisma.session.create({
          data: s,
        }),
      ),
      { timeout: 60000 },
    );
  }
}

async function createEventsForSessions(websiteId, sessionIds, monthStart, monthEndExclusive) {
  // Distribute 1-3 business events per session randomly within the month
  const BATCH = 500;
  const events = [];
  for (const sessionId of sessionIds) {
    const count = pickInt(EVENTS_PER_SESSION_MIN, EVENTS_PER_SESSION_MAX);
    for (let i = 0; i < count; i++) {
      const millis =
        monthStart.getTime() +
        Math.random() * (monthEndExclusive.getTime() - monthStart.getTime() - 1);
      const when = new Date(Math.floor(millis));
      const eventId = randomUUID();
      const eventName = pickFrom(BUSINESS_EVENTS);
      events.push({
        id: eventId,
        websiteId,
        sessionId,
        visitId: sessionId,
        createdAt: when,
        urlPath: pickFrom(PATHS),
        eventType: 2,
        eventName: eventName,
        referrerDomain: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        pageTitle: null,
      });
    }
  }

  for (let i = 0; i < events.length; i += BATCH) {
    const chunk = events.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map(e =>
        prisma.websiteEvent.create({
          data: e,
        }),
      ),
      { timeout: 120000 },
    );
  }

  return events.length;
}

async function main() {
  const { websiteId, startDate, endDate, resetRange } = parseArgs();
  console.log('[seed:returning-event-users] config', { websiteId, startDate, endDate, resetRange });

  await ensureWebsite(websiteId);

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  // Month boundaries
  const julyStart = new Date('2025-07-01T00:00:00.000Z');
  const augStart = new Date('2025-08-01T00:00:00.000Z');
  const sepStart = new Date('2025-09-01T00:00:00.000Z');

  if (resetRange) {
    console.log('[seed:returning-event-users] cleaning up existing data in range');
    await cleanupRange(websiteId, start, end);
  }

  // 1) Create persistent users with two sessions each (one in July, one in August)
  const persistentUsers = Array.from({ length: NUM_PERSISTENT_SESSIONS }).map(() => randomUUID());
  const persistentJulySessions = [];
  const persistentAugSessions = [];
  for (const userId of persistentUsers) {
    const sJuly = randomUUID();
    const sAug = randomUUID();
    persistentJulySessions.push({
      id: sJuly,
      createdAt: new Date('2025-07-05T12:00:00.000Z'),
      distinctId: userId,
    });
    persistentAugSessions.push({
      id: sAug,
      createdAt: new Date('2025-08-05T12:00:00.000Z'),
      distinctId: userId,
    });
  }
  await createSessions(websiteId, [...persistentJulySessions, ...persistentAugSessions]);
  console.log('[seed:returning-event-users] persistent users created:', persistentUsers.length);

  // 2) Create unique sessions per month (non-returning)
  // July-only users (unique to July)
  const julyUniqueSessions = Array.from({ length: NEW_SESSIONS_PER_DAY_PER_MONTH * 31 }).map(
    () => ({
      id: randomUUID(),
      createdAt: new Date('2025-07-10T12:00:00.000Z'),
      distinctId: randomUUID(),
    }),
  );
  await createSessions(websiteId, julyUniqueSessions);
  console.log(
    '[seed:returning-event-users] july unique sessions created:',
    julyUniqueSessions.length,
  );
  // August-only users (unique to August)
  const augUniqueSessions = Array.from({ length: NEW_SESSIONS_PER_DAY_PER_MONTH * 31 }).map(() => ({
    id: randomUUID(),
    createdAt: new Date('2025-08-10T12:00:00.000Z'),
    distinctId: randomUUID(),
  }));
  await createSessions(websiteId, augUniqueSessions);
  console.log(
    '[seed:returning-event-users] august unique sessions created:',
    augUniqueSessions.length,
  );

  // 3) Create events
  let totalEvents = 0;
  // July: events for persistent July sessions + July-unique sessions
  totalEvents += await createEventsForSessions(
    websiteId,
    persistentJulySessions.map(s => s.id),
    julyStart,
    augStart,
  );
  totalEvents += await createEventsForSessions(
    websiteId,
    julyUniqueSessions.map(s => s.id),
    julyStart,
    augStart,
  );
  // August: events for persistent August sessions + August-unique sessions
  totalEvents += await createEventsForSessions(
    websiteId,
    persistentAugSessions.map(s => s.id),
    augStart,
    sepStart,
  );
  totalEvents += await createEventsForSessions(
    websiteId,
    augUniqueSessions.map(s => s.id),
    augStart,
    sepStart,
  );

  console.log('[seed:returning-event-users] done', {
    sessions: persistentUsers.length * 2 + julyUniqueSessions.length + augUniqueSessions.length,
    events: totalEvents,
  });

  console.log('\nNow test the tool with:');
  console.log('  name: get-returning-event-users');
  console.log('  params:', {
    date_from: '2025-07-01',
    date_to: '2025-08-31',
    granularity: 'month',
  });
}

if (require.main === module) {
  main()
    .catch(err => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { main };
