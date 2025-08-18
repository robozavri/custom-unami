/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Config (can be overridden via CLI flags)
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2025-07-01'; // YYYY-MM-DD
const DEFAULT_END_DATE = '2025-08-30'; // YYYY-MM-DD
const BASELINE_VISITS_PER_DAY = 240; // sessions/day
const AVG_PAGES_PER_VISIT = 3.2; // avg pageviews per session
const BASELINE_CLICK_RATE = 0.06; // 6% of impressions become clicks

// Simple pools
const PATHS = ['/', '/pricing', '/about', '/contact', '/blog'];
const DEVICES = ['desktop', 'mobile', 'tablet'];
const COUNTRIES = ['US', 'DE', 'GB', 'FR', 'CA'];
const UTM_SOURCES = ['email', 'social', 'search', 'direct', 'affiliate'];

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

function pickFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

async function ensureWebsite(websiteId) {
  const existing = await prisma.website.findUnique({ where: { id: websiteId } }).catch(() => null);
  if (existing) return existing;
  return prisma.website.create({
    data: { id: websiteId, name: 'CTR Test Website', domain: 'ctr-test.local' },
  });
}

async function cleanupRange(websiteId, start, end) {
  const endPlus = new Date(end.getTime() + 24 * 3600 * 1000);

  // Find sessions in range
  const sessionsInRange = await prisma.session.findMany({
    where: { websiteId, createdAt: { gte: start, lt: endPlus } },
    select: { id: true },
  });
  const sessionIds = sessionsInRange.map(s => s.id);

  // Helper to process in chunks to avoid too many bind variables
  const chunkSize = 1000;
  for (let i = 0; i < sessionIds.length; i += chunkSize) {
    const chunk = sessionIds.slice(i, i + chunkSize);
    // Delete event data for events of these sessions
    await prisma.eventData.deleteMany({
      where: { websiteEvent: { websiteId, sessionId: { in: chunk } } },
    });
    // Delete website events for these sessions
    await prisma.websiteEvent.deleteMany({
      where: { websiteId, sessionId: { in: chunk } },
    });
  }

  // Delete any remaining event/session data strictly by date range (safety net)
  await prisma.eventData.deleteMany({
    where: { websiteId, createdAt: { gte: start, lt: endPlus } },
  });
  await prisma.sessionData.deleteMany({
    where: { websiteId, createdAt: { gte: start, lt: endPlus } },
  });

  // Now remove the sessions in range
  for (let i = 0; i < sessionIds.length; i += chunkSize) {
    const chunk = sessionIds.slice(i, i + chunkSize);
    await prisma.session.deleteMany({ where: { id: { in: chunk }, websiteId } });
  }
}

function buildDayPlan() {
  // Introduce gentle variations day-to-day
  const visitMultiplier = 0.85 + Math.random() * 0.3; // 0.85..1.15
  const clickRate = Math.max(
    0.02,
    Math.min(0.12, BASELINE_CLICK_RATE + (Math.random() - 0.5) * 0.02),
  );
  return {
    visits: Math.round(BASELINE_VISITS_PER_DAY * visitMultiplier),
    clickRate,
  };
}

async function seedDay({ websiteId, dayStartUtc, plan }) {
  // Create sessions with demographics
  const sessions = Array.from({ length: plan.visits }).map(() => {
    const sessionId = randomUUID();
    const device = pickFrom(DEVICES);
    const country = pickFrom(COUNTRIES);
    return {
      id: sessionId,
      websiteId,
      createdAt: new Date(dayStartUtc.getTime() + pickInt(0, 23) * 3600 * 1000),
      device,
      country,
      browser: device === 'mobile' ? 'safari' : 'chrome',
      os: device === 'mobile' ? 'ios' : 'windows',
      screen: device === 'mobile' ? '375x667' : '1920x1080',
      language: 'en-US',
      region: country === 'US' ? 'CA' : 'BY',
      city: country === 'US' ? 'San Francisco' : 'Berlin',
    };
  });

  await prisma.$transaction(
    sessions.map(s =>
      prisma.session.create({
        data: {
          id: s.id,
          websiteId: s.websiteId,
          createdAt: s.createdAt,
          device: s.device,
          country: s.country,
          browser: s.browser,
          os: s.os,
          screen: s.screen,
          language: s.language,
          region: s.region,
          city: s.city,
        },
      }),
    ),
    { timeout: 60000 },
  );

  const events = [];
  for (const session of sessions) {
    const baseTime = new Date(session.createdAt.getTime() + pickInt(0, 59) * 60 * 1000);
    const views = Math.max(2, Math.round(AVG_PAGES_PER_VISIT + (Math.random() - 0.5) * 2));
    for (let i = 0; i < views; i++) {
      const path = pickFrom(PATHS);
      const utmSource = pickFrom(UTM_SOURCES);
      const viewTime = new Date(baseTime.getTime() + i * pickInt(60, 300) * 1000);
      // Pageview (impression)
      events.push({
        id: randomUUID(),
        websiteId,
        sessionId: session.id,
        visitId: session.id,
        createdAt: viewTime,
        urlPath: path,
        eventType: 1,
        eventName: null,
        referrerDomain: utmSource === 'direct' ? null : `${utmSource}.example.com`,
        utmSource: utmSource === 'direct' ? null : utmSource,
        pageTitle: path === '/' ? 'Home' : path.slice(1).toUpperCase(),
      });

      // Potential click shortly after impression
      if (Math.random() < plan.clickRate) {
        const clickTime = new Date(viewTime.getTime() + pickInt(1, 8) * 1000);
        events.push({
          id: randomUUID(),
          websiteId,
          sessionId: session.id,
          visitId: session.id,
          createdAt: clickTime,
          urlPath: path,
          eventType: 2,
          eventName: 'click',
          referrerDomain: null,
          utmSource: null,
          pageTitle: null,
        });
      }
    }
  }

  // Persist events in batches
  const BATCH = 500;
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
            eventName: e.eventName,
            referrerDomain: e.referrerDomain,
            utmSource: e.utmSource,
            pageTitle: e.pageTitle,
          },
        }),
      ),
      { timeout: 120000 },
    );
  }

  return { sessions: sessions.length, events: events.length };
}

async function main() {
  const { websiteId, startDate, endDate, resetRange } = parseArgs();
  console.log('[seed:ctr] config', { websiteId, startDate, endDate, resetRange });

  await ensureWebsite(websiteId);

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  if (resetRange) {
    console.log('[seed:ctr] cleaning up existing data in range');
    await cleanupRange(websiteId, start, end);
  }

  let totalSessions = 0;
  let totalEvents = 0;
  let dayIndex = 0;
  for (let dt = new Date(start); dt < end; dt = addDays(dt, 1)) {
    const plan = buildDayPlan(dayIndex++);
    const { sessions, events } = await seedDay({ websiteId, dayStartUtc: dt, plan });
    totalSessions += sessions;
    totalEvents += events;
    console.log(`[seed:ctr] ${toDateOnlyString(dt)} visits=${sessions} events=${events}`);
  }

  console.log('[seed:ctr] done', { totalSessions, totalEvents });
  console.log('\nExample tool call params:');
  console.log('  name: get-click-through-rate');
  console.log('  params:', {
    period: { granularity: 'day', start: startDate, end: endDate },
    impression_events: ['page_view'],
    click_events: ['click'],
    breakdown: { by: 'page_url' },
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
