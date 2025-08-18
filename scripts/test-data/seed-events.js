/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Config (can be overridden via CLI flags)
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2024-07-01'; // YYYY-MM-DD
const DEFAULT_END_DATE = '2024-08-31'; // YYYY-MM-DD
const BASELINE_VISITS_PER_DAY = 180; // sessions/day
const AVG_PAGES_PER_VISIT = 4.5; // avg pageviews per session
const BASELINE_EVENT_RATE = 0.15; // 15% of sessions have business events

// Event types to seed
const BUSINESS_EVENTS = [
  'Start Free Trial',
  'Watch Demo',
  'Select Basic Plan',
  'Select Pro Plan',
  'Select Enterprise Plan',
  'Request Integration',
  'Contact Support',
];

// Simple pools
const PATHS = [
  '/',
  '/pricing',
  '/about',
  '/contact',
  '/blog',
  '/features',
  '/demo',
  '/integrations',
  '/support',
];
const DEVICES = ['desktop', 'mobile', 'tablet'];
const COUNTRIES = ['US', 'DE', 'GB', 'FR', 'CA', 'AU', 'JP', 'BR', 'IN', 'NL'];
const UTM_SOURCES = ['email', 'social', 'search', 'direct', 'affiliate', 'cpc', 'organic'];
const UTM_MEDIUMS = ['email', 'social', 'cpc', 'organic', 'referral', 'banner'];
const UTM_CAMPAIGNS = [
  'summer2024',
  'product-launch',
  'pricing-update',
  'feature-announcement',
  'holiday-sale',
];

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
      case '--event-rate':
        params.eventRate = parseFloat(next);
        i++;
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
    eventRate: params.eventRate || BASELINE_EVENT_RATE,
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
    data: { id: websiteId, name: 'Events Test Website', domain: 'events-test.local' },
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
  const visitMultiplier = 0.8 + Math.random() * 0.4; // 0.8..1.2
  const eventRate = Math.max(
    0.08,
    Math.min(0.25, BASELINE_EVENT_RATE + (Math.random() - 0.5) * 0.04),
  );
  return {
    visits: Math.round(BASELINE_VISITS_PER_DAY * visitMultiplier),
    eventRate,
  };
}

function generateEventData(eventName) {
  const eventData = [];

  switch (eventName) {
    case 'Start Free Trial':
      eventData.push(
        { key: 'plan_type', value: pickFrom(['basic', 'pro', 'enterprise']), type: 1 },
        { key: 'trial_length', value: pickFrom([7, 14, 30]), type: 2 },
        { key: 'source', value: pickFrom(['pricing_page', 'demo', 'landing_page']), type: 1 },
      );
      break;
    case 'Watch Demo':
      eventData.push(
        { key: 'demo_type', value: pickFrom(['product', 'feature', 'use_case']), type: 1 },
        { key: 'duration', value: pickInt(30, 300), type: 2 },
        { key: 'completion_rate', value: Math.random(), type: 2 },
      );
      break;
    case 'Select Basic Plan':
    case 'Select Pro Plan':
    case 'Select Enterprise Plan':
      // eslint-disable-next-line no-case-declarations
      const plan = eventName.replace('Select ', '').replace(' Plan', '').toLowerCase();
      eventData.push(
        { key: 'plan_type', value: plan, type: 1 },
        { key: 'price', value: plan === 'basic' ? 29 : plan === 'pro' ? 99 : 299, type: 2 },
        { key: 'billing_cycle', value: pickFrom(['monthly', 'annual']), type: 1 },
        { key: 'discount_applied', value: Math.random() > 0.7, type: 3 },
      );
      break;
    case 'Request Integration':
      eventData.push(
        { key: 'integration_type', value: pickFrom(['api', 'webhook', 'sdk', 'plugin']), type: 1 },
        {
          key: 'platform',
          value: pickFrom(['shopify', 'woocommerce', 'magento', 'custom']),
          type: 1,
        },
        { key: 'priority', value: pickFrom(['low', 'medium', 'high']), type: 1 },
      );
      break;
    case 'Contact Support':
      eventData.push(
        {
          key: 'support_type',
          value: pickFrom(['technical', 'billing', 'feature_request', 'general']),
          type: 1,
        },
        { key: 'priority', value: pickFrom(['low', 'medium', 'high', 'urgent']), type: 1 },
        { key: 'channel', value: pickFrom(['chat', 'email', 'phone', 'ticket']), type: 1 },
      );
      break;
  }

  return eventData;
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
  const eventDataEntries = [];

  for (const session of sessions) {
    const baseTime = new Date(session.createdAt.getTime() + pickInt(0, 59) * 60 * 1000);
    const views = Math.max(2, Math.round(AVG_PAGES_PER_VISIT + (Math.random() - 0.5) * 2));

    // Generate pageviews
    for (let i = 0; i < views; i++) {
      const path = pickFrom(PATHS);
      const utmSource = pickFrom(UTM_SOURCES);
      const utmMedium = pickFrom(UTM_MEDIUMS);
      const utmCampaign = pickFrom(UTM_CAMPAIGNS);
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
        utmMedium: utmSource === 'direct' ? null : utmMedium,
        utmCampaign: utmSource === 'direct' ? null : utmCampaign,
        pageTitle: path === '/' ? 'Home' : path.slice(1).toUpperCase(),
      });
    }

    // Generate business events based on probability
    if (Math.random() < plan.eventRate) {
      const eventName = pickFrom(BUSINESS_EVENTS);
      const eventTime = new Date(baseTime.getTime() + pickInt(300, 1800) * 1000); // 5-30 minutes after session start

      const eventId = randomUUID();
      events.push({
        id: eventId,
        websiteId,
        sessionId: session.id,
        visitId: session.id,
        createdAt: eventTime,
        urlPath: '/',
        eventType: 2,
        eventName: eventName,
        referrerDomain: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        pageTitle: null,
      });

      // Generate event data for this business event
      const dataEntries = generateEventData(eventName);
      dataEntries.forEach(entry => {
        eventDataEntries.push({
          id: randomUUID(),
          websiteId,
          websiteEventId: eventId,
          dataKey: entry.key,
          stringValue: entry.type === 1 ? entry.value : null,
          numberValue: entry.type === 2 ? entry.value : null,
          dateValue: entry.type === 3 ? new Date() : null,
          dataType: entry.type,
          createdAt: eventTime,
        });
      });
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
            utmMedium: e.utmMedium,
            utmCampaign: e.utmCampaign,
            pageTitle: e.pageTitle,
          },
        }),
      ),
      { timeout: 120000 },
    );
  }

  // Persist event data in batches
  if (eventDataEntries.length > 0) {
    for (let i = 0; i < eventDataEntries.length; i += BATCH) {
      const chunk = eventDataEntries.slice(i, i + BATCH);
      await prisma.$transaction(
        chunk.map(e =>
          prisma.eventData.create({
            data: {
              id: e.id,
              websiteId: e.websiteId,
              websiteEventId: e.websiteEventId,
              dataKey: e.dataKey,
              stringValue: e.stringValue,
              numberValue: e.numberValue,
              dateValue: e.dateValue,
              dataType: e.dataType,
              createdAt: e.createdAt,
            },
          }),
        ),
        { timeout: 120000 },
      );
    }
  }

  return {
    sessions: sessions.length,
    events: events.length,
    eventData: eventDataEntries.length,
  };
}

async function main() {
  const { websiteId, startDate, endDate, resetRange, eventRate } = parseArgs();
  console.log('[seed:events] config', { websiteId, startDate, endDate, resetRange, eventRate });

  await ensureWebsite(websiteId);

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  if (resetRange) {
    console.log('[seed:events] cleaning up existing data in range');
    await cleanupRange(websiteId, start, end);
  }

  let totalSessions = 0;
  let totalEvents = 0;
  let totalEventData = 0;
  let dayIndex = 0;

  for (let dt = new Date(start); dt < end; dt = addDays(dt, 1)) {
    const plan = buildDayPlan(dayIndex++);
    const { sessions, events, eventData } = await seedDay({ websiteId, dayStartUtc: dt, plan });
    totalSessions += sessions;
    totalEvents += events;
    totalEventData += eventData;
    console.log(
      `[seed:events] ${toDateOnlyString(
        dt,
      )} visits=${sessions} events=${events} eventData=${eventData}`,
    );
  }

  console.log('[seed:events] done', { totalSessions, totalEvents, totalEventData });
  console.log('\nSeeded business events:', BUSINESS_EVENTS);
  console.log('\nExample tool call params:');
  console.log('  name: get-event-counts');
  console.log('  params:', {
    period: { granularity: 'day', start: startDate, end: endDate },
    events: BUSINESS_EVENTS,
    breakdown: { by: 'event_name' },
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
