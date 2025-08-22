/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Configuration
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2024-07-01';
const DEFAULT_END_DATE = '2024-08-31';
const MIN_ITERATIONS_PER_DAY = 10;
const MAX_ITERATIONS_PER_DAY = 50;

// Visitor simulation settings
const TOTAL_UNIQUE_VISITORS = 500; // Total unique visitors to simulate
const RETURNING_VISITOR_RATE = 0.3; // 30% chance a visitor returns on another day
const MAX_SESSIONS_PER_VISITOR = 5; // Maximum sessions a single visitor can have

// Realistic user agents for different devices and browsers
const USER_AGENTS = {
  desktop: {
    chrome: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    ],
    firefox: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 13.5; rv:124.0) Gecko/20100101 Firefox/124.0',
      'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
    ],
    safari: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    ],
    edge: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/124.0.0.0 Chrome/124.0.0.0 Safari/537.36',
    ],
  },
  mobile: {
    safari: [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    ],
    chrome: [
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 12; OnePlus 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    ],
    samsung: [
      'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
    ],
  },
  tablet: {
    safari: [
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    ],
    chrome: [
      'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    ],
  },
};

// Device configurations
const DEVICES = {
  desktop: {
    screen: ['1920x1080', '1536x864', '1440x900', '1366x768', '1280x720'],
    os: ['Windows', 'macOS', 'Linux'],
  },
  mobile: {
    screen: ['390x844', '375x812', '412x915', '360x800', '414x896'],
    os: ['iOS', 'Android'],
  },
  tablet: {
    screen: ['768x1024', '810x1080', '820x1180', '834x1194'],
    os: ['iOS', 'Android'],
  },
};

// Countries with realistic data
const COUNTRIES = [
  {
    code: 'US',
    name: 'United States',
    region: 'CA',
    city: 'San Francisco',
    timezone: 'America/Los_Angeles',
  },
  { code: 'DE', name: 'Germany', region: 'BY', city: 'Berlin', timezone: 'Europe/Berlin' },
  { code: 'GB', name: 'United Kingdom', region: 'EN', city: 'London', timezone: 'Europe/London' },
  { code: 'FR', name: 'France', region: 'IDF', city: 'Paris', timezone: 'Europe/Paris' },
  { code: 'CA', name: 'Canada', region: 'ON', city: 'Toronto', timezone: 'America/Toronto' },
  { code: 'AU', name: 'Australia', region: 'NSW', city: 'Sydney', timezone: 'Australia/Sydney' },
  { code: 'JP', name: 'Japan', region: '13', city: 'Tokyo', timezone: 'Asia/Tokyo' },
  { code: 'BR', name: 'Brazil', region: 'SP', city: 'São Paulo', timezone: 'America/Sao_Paulo' },
  { code: 'IN', name: 'India', region: 'MH', city: 'Mumbai', timezone: 'Asia/Kolkata' },
  {
    code: 'NL',
    name: 'Netherlands',
    region: 'NH',
    city: 'Amsterdam',
    timezone: 'Europe/Amsterdam',
  },
  { code: 'IT', name: 'Italy', region: 'RM', city: 'Rome', timezone: 'Europe/Rome' },
  { code: 'ES', name: 'Spain', region: 'MD', city: 'Madrid', timezone: 'Europe/Madrid' },
  { code: 'SE', name: 'Sweden', region: 'AB', city: 'Stockholm', timezone: 'Europe/Stockholm' },
  { code: 'NO', name: 'Norway', region: 'OS', city: 'Oslo', timezone: 'Europe/Oslo' },
  { code: 'DK', name: 'Denmark', region: '84', city: 'Copenhagen', timezone: 'Europe/Copenhagen' },
];

// Page paths to visit
const PATHS = [
  '/faqs',
  '/features',
  '/home',
  '/integrations',
  '/pricing',
  '/about',
  '/contact',
  '/blog',
  '/demo',
  '/support',
  '/api',
  '/docs',
  '/tutorials',
  '/case-studies',
  '/team',
];

// Business events
const BUSINESS_EVENTS = [
  'Start Free Trial',
  'Watch Demo',
  'Select Basic Plan',
  'Select Pro Plan',
  'Select Enterprise Plan',
  'Request Integration',
  'Contact Support',
  'Download Whitepaper',
  'Subscribe Newsletter',
  'Request Quote',
];

// UTM parameters for realistic traffic sources
const UTM_SOURCES = [
  'google',
  'facebook',
  'twitter',
  'linkedin',
  'email',
  'direct',
  'organic',
  'referral',
];
const UTM_MEDIUMS = ['cpc', 'social', 'email', 'organic', 'referral', 'banner', 'affiliate'];
const UTM_CAMPAIGNS = [
  'summer2024',
  'product-launch',
  'pricing-update',
  'feature-announcement',
  'holiday-sale',
  'webinar-series',
  'case-study',
  'tutorial-series',
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

function pickRandomDevice() {
  const deviceTypes = Object.keys(DEVICES);
  const deviceType = pickFrom(deviceTypes);
  const deviceConfig = DEVICES[deviceType];

  return {
    type: deviceType,
    screen: pickFrom(deviceConfig.screen),
    os: pickFrom(deviceConfig.os),
  };
}

function pickRandomBrowser(deviceType) {
  const browsers = Object.keys(USER_AGENTS[deviceType]);
  const browser = pickFrom(browsers);
  const userAgent = pickFrom(USER_AGENTS[deviceType][browser]);

  return { browser, userAgent };
}

function pickRandomCountry() {
  return pickFrom(COUNTRIES);
}

// Visitor management
let visitorPool = [];
let visitorSessionCounts = new Map();

function initializeVisitorPool() {
  visitorPool = [];
  visitorSessionCounts.clear();

  // Create a pool of unique visitors
  for (let i = 0; i < TOTAL_UNIQUE_VISITORS; i++) {
    const visitorId = `visitor_${i + 1}_${randomUUID().slice(0, 8)}`;
    visitorPool.push(visitorId);
    visitorSessionCounts.set(visitorId, 0);
  }
}

function getVisitorForSession() {
  // Decide if we should use a returning visitor or create a new one
  if (visitorPool.length > 0 && Math.random() < RETURNING_VISITOR_RATE) {
    // Pick a random visitor from the pool
    const randomIndex = Math.floor(Math.random() * visitorPool.length);
    const visitorId = visitorPool[randomIndex];
    const sessionCount = visitorSessionCounts.get(visitorId);

    // Check if this visitor hasn't exceeded max sessions
    if (sessionCount < MAX_SESSIONS_PER_VISITOR) {
      visitorSessionCounts.set(visitorId, sessionCount + 1);
      return visitorId;
    } else {
      // Remove visitor from pool if they've reached max sessions
      visitorPool.splice(randomIndex, 1);
    }
  }

  // Create a new visitor if pool is empty or for new visitor
  const newVisitorId = `visitor_${visitorPool.length + 1}_${randomUUID().slice(0, 8)}`;
  visitorSessionCounts.set(newVisitorId, 1);
  return newVisitorId;
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
    case 'Select Enterprise Plan': {
      const plan = eventName.replace('Select ', '').replace(' Plan', '').toLowerCase();
      eventData.push(
        { key: 'plan_type', value: plan, type: 1 },
        { key: 'price', value: plan === 'basic' ? 29 : plan === 'pro' ? 99 : 299, type: 2 },
        { key: 'billing_cycle', value: pickFrom(['monthly', 'annual']), type: 1 },
      );
      break;
    }
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
    case 'Download Whitepaper':
      eventData.push(
        {
          key: 'whitepaper_title',
          value: pickFrom(['Analytics Guide', 'ROI Study', 'Best Practices']),
          type: 1,
        },
        { key: 'file_size', value: pickInt(1, 10), type: 2 },
        { key: 'industry', value: pickFrom(['ecommerce', 'saas', 'enterprise']), type: 1 },
      );
      break;
    case 'Subscribe Newsletter':
      eventData.push(
        {
          key: 'newsletter_type',
          value: pickFrom(['weekly', 'monthly', 'product-updates']),
          type: 1,
        },
        { key: 'source', value: pickFrom(['footer', 'popup', 'sidebar']), type: 1 },
      );
      break;
    case 'Request Quote':
      eventData.push(
        { key: 'company_size', value: pickFrom(['1-10', '11-50', '51-200', '200+']), type: 1 },
        { key: 'budget_range', value: pickFrom(['$1k-$5k', '$5k-$10k', '$10k+']), type: 1 },
        { key: 'timeline', value: pickFrom(['immediate', '1-3 months', '3-6 months']), type: 1 },
      );
      break;
  }

  return eventData;
}

async function ensureWebsite(websiteId) {
  const existing = await prisma.website.findUnique({ where: { id: websiteId } }).catch(() => null);
  if (existing) return existing;
  return prisma.website.create({
    data: { id: websiteId, name: 'Comprehensive Test Website', domain: 'comprehensive-test.local' },
  });
}

async function cleanupRange(websiteId, start, end) {
  const endPlus = new Date(end.getTime() + 24 * 3600 * 1000);

  console.log('[seed:comprehensive] cleaning up existing data in range...');

  // Find sessions in range
  const sessionsInRange = await prisma.session.findMany({
    where: { websiteId, createdAt: { gte: start, lt: endPlus } },
    select: { id: true },
  });
  const sessionIds = sessionsInRange.map(s => s.id);

  if (sessionIds.length > 0) {
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

  console.log(`[seed:comprehensive] cleaned up ${sessionIds.length} sessions and related data`);
}

async function seedDay({ websiteId, dayStartUtc }) {
  // Random number of iterations for this day
  const iterations = pickInt(MIN_ITERATIONS_PER_DAY, MAX_ITERATIONS_PER_DAY);

  console.log(
    `[seed:comprehensive] ${toDateOnlyString(dayStartUtc)} - generating ${iterations} iterations`,
  );

  const sessions = [];
  const events = [];
  const eventDataEntries = [];

  for (let i = 0; i < iterations; i++) {
    // Generate unique session data
    const sessionId = randomUUID();
    const visitId = randomUUID();

    // Get a unique visitor (new or returning)
    const distinctId = getVisitorForSession();

    // Pick random device and browser
    const deviceInfo = pickRandomDevice();
    const browserInfo = pickRandomBrowser(deviceInfo.type);
    const countryInfo = pickRandomCountry();

    // Random time within the day
    const sessionTime = new Date(
      dayStartUtc.getTime() + pickInt(0, 23) * 3600 * 1000 + pickInt(0, 59) * 60 * 1000,
    );

    // Create session
    const session = {
      id: sessionId,
      websiteId,
      createdAt: sessionTime,
      device: deviceInfo.type,
      country: countryInfo.code,
      browser: browserInfo.browser,
      os: deviceInfo.os,
      screen: deviceInfo.screen,
      language: 'en-US',
      region: countryInfo.region,
      city: countryInfo.city,
      distinctId: distinctId,
    };

    sessions.push(session);

    // Generate page visits (2-8 pages per session)
    const pageCount = pickInt(2, 8);
    const visitedPaths = new Set();

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      let path;
      do {
        path = pickFrom(PATHS);
      } while (visitedPaths.has(path) && visitedPaths.size < PATHS.length);

      visitedPaths.add(path);

      const pageTime = new Date(sessionTime.getTime() + pageIndex * pickInt(30, 180) * 1000);
      const utmSource = pickFrom(UTM_SOURCES);
      const utmMedium = pickFrom(UTM_MEDIUMS);
      const utmCampaign = pickFrom(UTM_CAMPAIGNS);

      // Pageview event
      events.push({
        id: randomUUID(),
        websiteId,
        sessionId: session.id,
        visitId: visitId,
        createdAt: pageTime,
        urlPath: path,
        eventType: 1, // pageview
        eventName: null,
        referrerDomain: utmSource === 'direct' ? null : `${utmSource}.example.com`,
        utmSource: utmSource === 'direct' ? null : utmSource,
        utmMedium: utmSource === 'direct' ? null : utmMedium,
        utmCampaign: utmSource === 'direct' ? null : utmCampaign,
        pageTitle: path === '/home' ? 'Home' : path.slice(1).toUpperCase(),
      });
    }

    // Generate business events (15-25% probability)
    if (Math.random() < 0.2) {
      const eventName = pickFrom(BUSINESS_EVENTS);
      const eventTime = new Date(sessionTime.getTime() + pickInt(300, 1800) * 1000); // 5-30 minutes after session start

      const eventId = randomUUID();
      events.push({
        id: eventId,
        websiteId,
        sessionId: session.id,
        visitId: visitId,
        createdAt: eventTime,
        urlPath: '/',
        eventType: 2, // custom event
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
          distinctId: s.distinctId,
        },
      }),
    ),
    { timeout: 60000 },
  );

  // Persist events in batches
  const BATCH_SIZE = 500;
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const chunk = events.slice(i, i + BATCH_SIZE);
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
    for (let i = 0; i < eventDataEntries.length; i += BATCH_SIZE) {
      const chunk = eventDataEntries.slice(i, i + BATCH_SIZE);
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
  const { websiteId, startDate, endDate, resetRange } = parseArgs();
  console.log('[seed:comprehensive] config', { websiteId, startDate, endDate, resetRange });

  await ensureWebsite(websiteId);

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  if (resetRange) {
    await cleanupRange(websiteId, start, end);
  }

  // Initialize visitor pool for tracking unique visitors
  initializeVisitorPool();
  console.log(
    `[seed:comprehensive] initialized visitor pool with ${TOTAL_UNIQUE_VISITORS} unique visitors`,
  );

  let totalSessions = 0;
  let totalEvents = 0;
  let totalEventData = 0;

  for (let dt = new Date(start); dt < end; dt = addDays(dt, 1)) {
    const { sessions, events, eventData } = await seedDay({ websiteId, dayStartUtc: dt });
    totalSessions += sessions;
    totalEvents += events;
    totalEventData += eventData;
  }

  console.log('[seed:comprehensive] seeding completed successfully!');
  console.log('[seed:comprehensive] summary', {
    totalSessions,
    totalEvents,
    totalEventData,
    dateRange: `${startDate} to ${endDate}`,
    paths: PATHS,
    businessEvents: BUSINESS_EVENTS,
    countries: COUNTRIES.length,
    devices: Object.keys(DEVICES).length,
    uniqueVisitors: TOTAL_UNIQUE_VISITORS,
    returningVisitorRate: `${(RETURNING_VISITOR_RATE * 100).toFixed(0)}%`,
  });

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
      console.error('[seed:comprehensive] error:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { main };
