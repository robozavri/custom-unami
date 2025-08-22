/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

// Import enhanced constants for realistic data
const {
  // COUNTRIES,
  // DEVICES,
  PATHS,
  // UTM_SOURCES,
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
const DEFAULT_START_DATE = '2025-07-01'; // YYYY-MM-DD
const DEFAULT_DAYS = 14; // total consecutive days
const DEFAULT_ANOMALY_DAY_INDEX = 7; // 0-based index, day 8 is anomaly
const BASELINE_VISITS_PER_DAY = 300;
const BASELINE_PAGES_PER_VISIT = 3.5;

// Segment configurations with baseline distributions
const SEGMENT_CONFIGS = {
  country: {
    baseline: { US: 0.4, DE: 0.25, GB: 0.15, FR: 0.1, CA: 0.1 },
    anomaly: { US: 0.55, DE: 0.2, GB: 0.15, FR: 0.05, CA: 0.05 }, // US +15pp, DE -5pp
    labels: ['US', 'DE', 'GB', 'FR', 'CA'],
  },
  device: {
    baseline: { desktop: 0.6, mobile: 0.35, tablet: 0.05 },
    anomaly: { desktop: 0.45, mobile: 0.5, tablet: 0.05 }, // desktop -15pp, mobile +15pp
    labels: ['desktop', 'mobile', 'tablet'],
  },
  browser: {
    baseline: { chrome: 0.65, firefox: 0.2, safari: 0.1, edge: 0.05 },
    anomaly: { chrome: 0.55, firefox: 0.3, safari: 0.1, edge: 0.05 }, // chrome -10pp, firefox +10pp
    labels: ['chrome', 'firefox', 'safari', 'edge'],
  },
  referrer_domain: {
    baseline: {
      'google.com': 0.45,
      'facebook.com': 0.25,
      'twitter.com': 0.15,
      'linkedin.com': 0.1,
      direct: 0.05,
    },
    anomaly: {
      'google.com': 0.35,
      'facebook.com': 0.35,
      'twitter.com': 0.15,
      'linkedin.com': 0.1,
      direct: 0.05,
    }, // google -10pp, facebook +10pp
    labels: ['google.com', 'facebook.com', 'twitter.com', 'linkedin.com', 'direct'],
  },
  utm_source: {
    baseline: { email: 0.3, social: 0.25, search: 0.25, direct: 0.15, affiliate: 0.05 },
    anomaly: { email: 0.45, social: 0.2, search: 0.2, direct: 0.1, affiliate: 0.05 }, // email +15pp, social -5pp, search -5pp
    labels: ['email', 'social', 'search', 'direct', 'affiliate'],
  },
  path: {
    baseline: { '/': 0.35, '/pricing': 0.25, '/about': 0.2, '/contact': 0.15, '/blog': 0.05 },
    anomaly: { '/': 0.25, '/pricing': 0.35, '/about': 0.2, '/contact': 0.15, '/blog': 0.05 }, // homepage -10pp, pricing +10pp
    labels: ['/', '/pricing', '/about', '/contact', '/blog'],
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
      name: 'Segment Shifts Test Website',
      domain: 'segment-shifts-test.local',
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

  // Delete website events first (they reference sessions)
  await prisma.websiteEvent.deleteMany({
    where: {
      websiteId,
      createdAt: { gte: start, lt: end },
    },
  });

  // Then delete sessions
  await prisma.session.deleteMany({
    where: {
      websiteId,
      createdAt: { gte: start, lt: end },
    },
  });
}

function buildDayPlan(dayIndex, anomalyIndex) {
  const isAnomaly = dayIndex === anomalyIndex;
  const visits = Math.round(BASELINE_VISITS_PER_DAY * (isAnomaly ? 1.2 : 1)); // 20% more visits on anomaly day

  return {
    visits,
    isAnomaly,
    // Use anomaly distributions on anomaly day, baseline on other days
    segmentDistributions: isAnomaly
      ? Object.fromEntries(
          Object.entries(SEGMENT_CONFIGS).map(([key, config]) => [key, config.anomaly]),
        )
      : Object.fromEntries(
          Object.entries(SEGMENT_CONFIGS).map(([key, config]) => [key, config.baseline]),
        ),
  };
}

function generateSessionData(plan, segmentType) {
  const distribution = plan.segmentDistributions[segmentType];
  const labels = SEGMENT_CONFIGS[segmentType].labels;

  // Convert distribution to weighted options array
  const options = labels
    .map(label => ({
      label,
      probability: distribution[label] || 0,
    }))
    .filter(option => option.probability > 0);

  // Ensure we always return a valid label
  if (options.length === 0) {
    return { label: labels[0] || 'unknown' };
  }

  return weightedRandomChoice(options);
}

async function seedDay({ websiteId, dayStartUtc, plan }) {
  // Create sessions with demographic data
  const sessions = Array.from({ length: plan.visits }).map(() => {
    const sessionId = randomUUID();

    // Generate segment values for each session - ensure no null values
    // const country = generateSessionData(plan, 'country');
    // const device = generateSessionData(plan, 'device');
    // const browser = generateSessionData(plan, 'browser');

    // Ensure all demographic fields have valid values
    const deviceInfo = pickRandomDevice();
    const countryInfo = pickRandomCountry();
    const browserInfo = pickRandomBrowser(deviceInfo.type);

    const sessionData = {
      id: sessionId,
      websiteId,
      createdAt: new Date(dayStartUtc.getTime() + pickInt(0, 23) * 3600 * 1000),
      country: countryInfo.code,
      device: deviceInfo.type,
      browser: browserInfo.browser,
      os: deviceInfo.os,
      screen: deviceInfo.screen,
      language: 'en-US',
      region: countryInfo.region,
      city: countryInfo.city,
    };

    // Validate that no demographic field is null/undefined
    if (!sessionData.country || !sessionData.device || !sessionData.browser) {
      console.warn(`Session ${sessionId} has null demographic data:`, {
        country: sessionData.country,
        device: sessionData.device,
        browser: sessionData.browser,
      });
    }

    return sessionData;
  });

  // Persist sessions
  await prisma.$transaction(
    sessions.map(s =>
      prisma.session.create({
        data: {
          id: s.id,
          websiteId: s.websiteId,
          createdAt: s.createdAt,
          country: s.country,
          device: s.device,
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

  // Generate events for each session
  const events = [];

  for (const session of sessions) {
    const visitStartTime = new Date(session.createdAt.getTime() + pickInt(0, 59) * 60 * 1000);

    // Generate 2-6 page visits per session
    const numPages = Math.max(2, Math.round(BASELINE_PAGES_PER_VISIT + (Math.random() - 0.5) * 2));

    for (let i = 0; i < numPages; i++) {
      // Generate segment values for this event - ensure no null values
      const referrer = generateSessionData(plan, 'referrer_domain');
      const utmSource = generateSessionData(plan, 'utm_source');
      const path = pickFrom(PATHS);

      // Add some time between pageviews (1-5 minutes)
      const timeOffset = pickInt(1, 5) * 60 * 1000;
      const eventTime = new Date(visitStartTime.getTime() + i * timeOffset);

      events.push({
        id: randomUUID(),
        websiteId,
        sessionId: session.id,
        visitId: session.id, // treat session as a visit for simplicity
        createdAt: eventTime,
        urlPath: path, // Use enhanced path
        eventType: 1, // pageview
        referrerDomain: referrer.label === 'direct' || !referrer.label ? null : referrer.label,
        utmSource: utmSource.label === 'direct' || !utmSource.label ? null : utmSource.label,
        utmMedium: utmSource.label === 'direct' || !utmSource.label ? null : pickFrom(UTM_MEDIUMS),
        utmCampaign:
          utmSource.label === 'direct' || !utmSource.label ? null : pickFrom(UTM_CAMPAIGNS),
        pageTitle: path === '/home' ? 'Home' : path.slice(1).toUpperCase(),
      });
    }
  }

  // Persist events in batches
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
        (plan.isAnomaly ? ' (ANOMALY - segment distribution changes)' : ''),
    );
  }

  console.log('[seed] done', { totalSessions, totalEvents });
  const dateTo = toDateOnlyString(addDays(start, days - 1));

  console.log(
    '\nNext: run the tool with parameters like:',
    `\nwebsiteId=${websiteId} date_from=${startDate} date_to=${dateTo}`,
    '\n\nExpected anomalies on Day 8:',
    '\n- Country: US +15pp (40% → 55%), DE -5pp (25% → 20%)',
    '\n- Device: Desktop -15pp (60% → 45%), Mobile +15pp (35% → 50%)',
    '\n- Browser: Chrome -10pp (65% → 55%), Firefox +10pp (20% → 30%)',
    '\n- Referrer: Google -10pp (45% → 35%), Facebook +10pp (25% → 35%)',
    '\n- UTM: Email +15pp (30% → 45%), Social -5pp (25% → 20%)',
    '\n- Path: Homepage -10pp (35% → 25%), Pricing +10pp (25% → 35%)',
    '\n\nTool invocation examples:',
    `\n- Single segment: segment_by=country metric=visits`,
    `\n- Multiple segments: segment_by=["country","device"] metric=visits`,
    `\n- Different metric: segment_by=path metric=pageviews`,
    `\n- Lower threshold: min_effect_size=0.05 min_share=0.02`,
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
