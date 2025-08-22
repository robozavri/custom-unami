/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

// Import enhanced constants for realistic data
const {
  // COUNTRIES,
  // DEVICES,
  // PATHS,
  UTM_SOURCES,
  UTM_MEDIUMS,
  UTM_CAMPAIGNS,
  pickRandomDevice,
  pickRandomBrowser,
  pickRandomCountry,
  pickFrom,
} = require('./seed-constants');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Config (can be overridden via CLI flags)
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2023-10-01'; // YYYY-MM-DD
const DEFAULT_DAYS = 14; // total consecutive days
const DEFAULT_ANOMALY_DAY_INDEX = 7; // 0-based index, day 8 is anomaly
const BASELINE_VISITS_PER_DAY = 200;
const BASELINE_PAGES_PER_VISIT = 3.5; // average pages per visit
const ANOMALY_DROP_MULTIPLIER = 0.4; // drop to 40% on anomaly day

// Navigation paths and their transition probabilities
const NAVIGATION_PATHS = {
  '/': {
    next: [
      { path: '/pricing', probability: 0.35, name: 'pricing' },
      { path: '/about', probability: 0.25, name: 'about' },
      { path: '/products', probability: 0.2, name: 'products' },
      { path: '/contact', probability: 0.15, name: 'contact' },
      { path: '/blog', probability: 0.05, name: 'blog' },
    ],
    exitRate: 0.1, // 10% exit from homepage
  },
  '/pricing': {
    next: [
      { path: '/signup', probability: 0.6, name: 'signup' },
      { path: '/contact', probability: 0.25, name: 'contact' },
      { path: '/', probability: 0.1, name: 'home' },
      { path: '/about', probability: 0.05, name: 'about' },
    ],
    exitRate: 0.25, // 25% exit from pricing (normal)
  },
  '/about': {
    next: [
      { path: '/contact', probability: 0.4, name: 'contact' },
      { path: '/', probability: 0.35, name: 'home' },
      { path: '/products', probability: 0.2, name: 'products' },
      { path: '/pricing', probability: 0.05, name: 'pricing' },
    ],
    exitRate: 0.3, // 30% exit from about
  },
  '/products': {
    next: [
      { path: '/pricing', probability: 0.5, name: 'pricing' },
      { path: '/', probability: 0.3, name: 'home' },
      { path: '/contact', probability: 0.15, name: 'contact' },
      { path: '/about', probability: 0.05, name: 'about' },
    ],
    exitRate: 0.2, // 20% exit from products
  },
  '/contact': {
    next: [
      { path: '/', probability: 0.6, name: 'home' },
      { path: '/pricing', probability: 0.25, name: 'pricing' },
      { path: '/about', probability: 0.1, name: 'about' },
      { path: '/products', probability: 0.05, name: 'products' },
    ],
    exitRate: 0.35, // 35% exit from contact
  },
  '/signup': {
    next: [
      { path: '/dashboard', probability: 0.8, name: 'dashboard' },
      { path: '/', probability: 0.15, name: 'home' },
      { path: '/pricing', probability: 0.05, name: 'pricing' },
    ],
    exitRate: 0.15, // 15% exit from signup
  },
  '/blog': {
    next: [
      { path: '/', probability: 0.7, name: 'home' },
      { path: '/products', probability: 0.2, name: 'products' },
      { path: '/about', probability: 0.1, name: 'about' },
    ],
    exitRate: 0.45, // 45% exit from blog
  },
  '/dashboard': {
    next: [
      { path: '/profile', probability: 0.4, name: 'profile' },
      { path: '/settings', probability: 0.3, name: 'settings' },
      { path: '/', probability: 0.2, name: 'home' },
      { path: '/logout', probability: 0.1, name: 'logout' },
    ],
    exitRate: 0.05, // 5% exit from dashboard
  },
};

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

function weightedRandomChoice(options) {
  const totalWeight = options.reduce((sum, option) => sum + option.probability, 0);
  let random = Math.random() * totalWeight;

  for (const option of options) {
    random -= option.probability;
    if (random <= 0) {
      return option;
    }
  }

  return options[options.length - 1]; // fallback
}

async function ensureWebsite(websiteId) {
  const existing = await prisma.website.findUnique({ where: { id: websiteId } }).catch(() => null);

  if (existing) {
    return existing;
  }

  const created = await prisma.website.create({
    data: {
      id: websiteId,
      name: 'Path Drop-off Test Website',
      domain: 'path-dropoff-test.local',
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
  const visits = Math.round(BASELINE_VISITS_PER_DAY * (isAnomaly ? ANOMALY_DROP_MULTIPLIER : 1));
  const avgPagesPerVisit = isAnomaly ? BASELINE_PAGES_PER_VISIT * 0.7 : BASELINE_PAGES_PER_VISIT;

  return {
    visits,
    avgPagesPerVisit,
    isAnomaly,
    // On anomaly day, increase exit rates and reduce transition probabilities
    anomalyMultiplier: isAnomaly ? 1.8 : 1.0, // 80% increase in exits
    transitionMultiplier: isAnomaly ? 0.6 : 1.0, // 40% decrease in transitions
  };
}

function generateVisitPath(plan, startTime) {
  const path = ['/']; // Start at homepage
  const timestamps = [startTime];
  let currentPath = '/';
  let currentTime = startTime;

  // Generate 2-6 page visits per session
  const numPages = Math.max(2, Math.round(plan.avgPagesPerVisit + (Math.random() - 0.5) * 2));

  for (let i = 1; i < numPages; i++) {
    const pathConfig = NAVIGATION_PATHS[currentPath];
    if (!pathConfig) break;

    // Apply anomaly effects
    let exitRate = pathConfig.exitRate;
    let transitionProbs = [...pathConfig.next];

    if (plan.isAnomaly) {
      exitRate *= plan.anomalyMultiplier; // Increase exits on anomaly day
      transitionProbs = transitionProbs.map(p => ({
        ...p,
        probability: p.probability * plan.transitionMultiplier, // Decrease transitions
      }));
    }

    // Check if user exits
    if (Math.random() < exitRate) {
      break;
    }

    // Choose next page
    const nextPage = weightedRandomChoice(transitionProbs);
    currentPath = nextPage.path;
    path.push(currentPath);

    // Add some time between pageviews (1-5 minutes)
    const timeOffset = pickInt(1, 5) * 60 * 1000;
    currentTime = new Date(currentTime.getTime() + timeOffset);
    timestamps.push(currentTime);
  }

  return { path, timestamps };
}

async function seedDay({ websiteId, dayStartUtc, plan }) {
  // Create sessions (1 per visit) with enhanced demographics
  const sessions = Array.from({ length: plan.visits }).map(() => {
    const deviceInfo = pickRandomDevice();
    const countryInfo = pickRandomCountry();
    const browserInfo = pickRandomBrowser(deviceInfo.type);

    return {
      id: randomUUID(),
      websiteId,
      createdAt: new Date(dayStartUtc.getTime() + pickInt(0, 23) * 3600 * 1000),
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

  // Persist sessions
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

  // Generate navigation paths for each visit
  const events = [];

  for (const session of sessions) {
    const visitStartTime = new Date(session.createdAt.getTime() + pickInt(0, 59) * 60 * 1000);
    const { path, timestamps } = generateVisitPath(plan, visitStartTime);

    // Create events for each page in the path
    for (let i = 0; i < path.length; i++) {
      const utmSource = pickFrom(UTM_SOURCES);
      const utmMedium = pickFrom(UTM_MEDIUMS);
      const utmCampaign = pickFrom(UTM_CAMPAIGNS);

      events.push({
        id: randomUUID(),
        websiteId,
        sessionId: session.id,
        visitId: session.id, // treat session as a visit for simplicity
        createdAt: timestamps[i],
        urlPath: path[i],
        eventType: 1, // pageview
        referrerDomain: utmSource === 'direct' ? null : `${utmSource}.example.com`,
        utmSource: utmSource === 'direct' ? null : utmSource,
        utmMedium: utmSource === 'direct' ? null : utmMedium,
        utmCampaign: utmSource === 'direct' ? null : utmCampaign,
        pageTitle: path[i] === '/home' ? 'Home' : path[i].slice(1).toUpperCase(),
      });
    }
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
            referrerDomain: e.referrerDomain,
            utmSource: e.utmSource,
            utmMedium: e.utmMedium,
            utmCampaign: e.utmCampaign,
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
        (plan.isAnomaly ? ' (ANOMALY - increased exits, decreased transitions)' : ''),
    );
  }

  console.log('[seed] done', { totalSessions, totalEvents });
  const dateTo = toDateOnlyString(addDays(start, days - 1));
  console.log(
    '\nNext: run the tool with parameters like:',
    `\nwebsiteId=${websiteId} date_from=${startDate} date_to=${dateTo}`,
    '\n\nExpected anomalies:',
    '\n- Day 8: 40% fewer visits, 80% more exits, 40% fewer transitions',
    '\n- /pricing page: exit rate increases from 25% to 45% on anomaly day',
    '\n- Homepage → Pricing transition drops from 35% to 21% on anomaly day',
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
