/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Config (can be overridden via CLI flags)
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2023-10-01'; // YYYY-MM-DD
const DEFAULT_DAYS = 14; // total consecutive days
const DEFAULT_ANOMALY_DAY_INDEX = 7; // 0-based index, day 8 is anomaly
const BASELINE_MIN_PAGEVIEWS = 12;
const BASELINE_MAX_PAGEVIEWS = 20;
const ANOMALY_MULTIPLIER = 2.5; // spike multiplier on anomaly day

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
      case '--days':
        params.days = Number(next);
        i++;
        break;
      case '--anomaly-index':
        params.anomalyIndex = Number(next);
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
    days: Number.isFinite(params.days) ? params.days : DEFAULT_DAYS,
    anomalyIndex: Number.isFinite(params.anomalyIndex)
      ? params.anomalyIndex
      : DEFAULT_ANOMALY_DAY_INDEX,
    resetRange: !!params.resetRange,
  };
}

function toDateOnlyString(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function pickInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function ensureWebsite(websiteId) {
  const existing = await prisma.website.findUnique({ where: { id: websiteId } }).catch(() => null);

  if (existing) {
    return existing;
  }

  const created = await prisma.website.create({
    data: {
      id: websiteId,
      name: 'Anomaly Test Website',
      domain: 'anomaly-test.local',
    },
  });

  return created;
}

async function cleanupRange(websiteId, start, end) {
  // Delete in chronological order of dependencies: event_data -> website_event -> session
  await prisma.eventData.deleteMany({
    where: {
      websiteId,
      createdAt: { gte: start, lt: end },
    },
  });

  await prisma.sessionData.deleteMany({
    where: {
      websiteId,
      createdAt: { gte: start, lt: end },
    },
  });

  await prisma.websiteEvent.deleteMany({
    where: {
      websiteId,
      createdAt: { gte: start, lt: end },
    },
  });

  await prisma.session.deleteMany({
    where: {
      websiteId,
      createdAt: { gte: start, lt: end },
    },
  });
}

function buildDayPlan(dayIndex, anomalyIndex) {
  const isAnomaly = dayIndex === anomalyIndex;
  const baseline = pickInt(BASELINE_MIN_PAGEVIEWS, BASELINE_MAX_PAGEVIEWS);
  const pageviews = Math.round(baseline * (isAnomaly ? ANOMALY_MULTIPLIER : 1));
  const visits = Math.max(5, Math.min(pageviews, Math.round(pageviews / 2)));
  return { pageviews, visits, isAnomaly };
}

async function seedDay({ websiteId, dayStartUtc, plan }) {
  // Create sessions (1 per visit)
  const sessions = Array.from({ length: plan.visits }).map(() => ({
    id: randomUUID(),
    websiteId,
    createdAt: new Date(dayStartUtc.getTime() + pickInt(0, 23) * 3600 * 1000),
  }));

  // Persist sessions
  await prisma.$transaction(
    sessions.map(s =>
      prisma.session.create({
        data: {
          id: s.id,
          websiteId: s.websiteId,
          createdAt: s.createdAt,
        },
      }),
    ),
    { timeout: 60000 },
  );

  // Distribute pageviews across sessions (1-3 events per session)
  const events = [];
  let remaining = plan.pageviews;
  let si = 0;

  while (remaining > 0) {
    const session = sessions[si % sessions.length];
    const burst = Math.min(remaining, pickInt(1, 3));
    for (let i = 0; i < burst; i++) {
      const minuteOffset = pickInt(0, 23 * 60 + 59);
      const createdAt = new Date(dayStartUtc.getTime() + minuteOffset * 60 * 1000);
      events.push({
        id: randomUUID(),
        websiteId,
        sessionId: session.id,
        visitId: session.id, // treat session as a visit for simplicity
        createdAt,
        urlPath: i % 2 === 0 ? '/' : '/products',
        eventType: 1, // pageview
      });
    }
    remaining -= burst;
    si++;
  }

  // Persist events in batches to avoid overly large transactions
  const BATCH = 200;
  for (let i = 0; i < events.length; i += BATCH) {
    const chunk = events.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map(e =>
        prisma.websiteEvent.create({
          data: {
            id: e.id,
            websiteId: e.websiteId,
            sessionId: e.sessionId,
            visitId: e.visitId,
            createdAt: e.createdAt,
            urlPath: e.urlPath,
            eventType: e.eventType,
          },
        }),
      ),
      { timeout: 120000 },
    );
  }

  return { sessions: sessions.length, events: events.length };
}

async function main() {
  const { websiteId, startDate, days, anomalyIndex, resetRange } = parseArgs();

  console.log('[seed] config', { websiteId, startDate, days, anomalyIndex, resetRange });

  // Ensure website exists
  await ensureWebsite(websiteId);

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = addDays(start, days);

  if (resetRange) {
    console.log('[seed] cleaning up existing data in range');
    await cleanupRange(websiteId, start, end);
  }

  let totalSessions = 0;
  let totalEvents = 0;

  for (let i = 0; i < days; i++) {
    const dayStartUtc = addDays(start, i);
    const plan = buildDayPlan(i, anomalyIndex);
    const { sessions, events } = await seedDay({ websiteId, dayStartUtc, plan });
    totalSessions += sessions;
    totalEvents += events;
    console.log(
      `[seed] ${toDateOnlyString(dayStartUtc)} visits=${sessions} pageviews=${events}` +
        (plan.isAnomaly ? ' (ANOMALY)' : ''),
    );
  }

  console.log('[seed] done', { totalSessions, totalEvents });
  const dateTo = toDateOnlyString(addDays(start, days - 1));
  console.log(
    '\nNext: run the tool with parameters like:',
    `\nmetric=pageviews interval=day date_from=${startDate} date_to=${dateTo}`,
  );
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
