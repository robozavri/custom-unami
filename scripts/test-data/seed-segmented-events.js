/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Configuration
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2024-07-01';
const DEFAULT_END_DATE = '2024-08-31';
const MIN_ITERATIONS_PER_DAY = 15;
const MAX_ITERATIONS_PER_DAY = 40;

// Import enhanced constants for realistic data
const {
  COUNTRIES,
  DEVICES,
  PATHS,
  UTM_SOURCES,
  UTM_MEDIUMS,
  UTM_CAMPAIGNS,
  pickRandomDevice,
  pickRandomBrowser,
  pickRandomCountry,
  pickFrom,
} = require('./seed-constants');

// Enhanced segmentation data for better testing
const SEGMENTATION_DATA = {
  countries: COUNTRIES,
  devices: Object.keys(DEVICES).map(deviceType => {
    const deviceConfig = DEVICES[deviceType];
    return {
      type: deviceType,
      screen: deviceConfig.screen[Math.floor(Math.random() * deviceConfig.screen.length)],
      os: deviceConfig.os[Math.floor(Math.random() * deviceConfig.os.length)],
    };
  }),
  browsers: ['chrome', 'firefox', 'safari', 'edge', 'samsung'].map(browser => ({
    name: browser,
    version: '124.0.0.0',
  })),
  plans: [
    { name: 'free', tier: 'basic', features: ['analytics', 'basic_reports'] },
    { name: 'starter', tier: 'pro', features: ['analytics', 'advanced_reports', 'export'] },
    {
      name: 'professional',
      tier: 'enterprise',
      features: ['analytics', 'advanced_reports', 'export', 'api'],
    },
    {
      name: 'enterprise',
      tier: 'enterprise',
      features: ['analytics', 'advanced_reports', 'export', 'api', 'custom_integrations'],
    },
  ],
};

// Diverse event types for better segmentation analysis
const EVENT_TYPES = [
  // User engagement events
  { name: 'Page View', type: 1, probability: 0.4 },
  { name: 'Button Click', type: 2, probability: 0.15 },
  { name: 'Form Submit', type: 2, probability: 0.1 },
  { name: 'File Download', type: 2, probability: 0.08 },
  { name: 'Video Play', type: 2, probability: 0.07 },
  { name: 'Scroll Depth', type: 2, probability: 0.06 },
  { name: 'Search Query', type: 2, probability: 0.05 },
  { name: 'Add to Cart', type: 2, probability: 0.04 },
  { name: 'Purchase', type: 2, probability: 0.03 },
  { name: 'User Registration', type: 2, probability: 0.02 },
];

// Event properties for different event types
const EVENT_PROPERTIES = {
  'Button Click': [
    { key: 'button_text', value: 'Get Started', type: 1 },
    { key: 'button_location', value: 'header', type: 1 },
    { key: 'page_section', value: 'hero', type: 1 },
  ],
  'Form Submit': [
    { key: 'form_type', value: 'contact', type: 1 },
    { key: 'form_fields', value: 5, type: 2 },
    { key: 'completion_time', value: 45, type: 2 },
  ],
  'File Download': [
    { key: 'file_type', value: 'pdf', type: 1 },
    { key: 'file_size', value: 2.5, type: 2 },
    { key: 'download_source', value: 'resources_page', type: 1 },
  ],
  'Video Play': [
    { key: 'video_title', value: 'Product Demo', type: 1 },
    { key: 'play_duration', value: 120, type: 2 },
    { key: 'video_category', value: 'tutorial', type: 1 },
  ],
  'Scroll Depth': [
    { key: 'scroll_percentage', value: 75, type: 2 },
    { key: 'page_height', value: 1200, type: 2 },
    { key: 'time_on_page', value: 180, type: 2 },
  ],
  'Search Query': [
    { key: 'query_length', value: 8, type: 2 },
    { key: 'search_results', value: 15, type: 2 },
    { key: 'search_category', value: 'help', type: 1 },
  ],
  'Add to Cart': [
    { key: 'product_id', value: 'prod_123', type: 1 },
    { key: 'product_price', value: 99.99, type: 2 },
    { key: 'cart_total', value: 199.98, type: 2 },
  ],
  Purchase: [
    { key: 'order_id', value: 'ord_456', type: 1 },
    { key: 'total_amount', value: 299.97, type: 2 },
    { key: 'payment_method', value: 'credit_card', type: 1 },
  ],
  'User Registration': [
    { key: 'registration_source', value: 'landing_page', type: 1 },
    { key: 'referral_code', value: 'WELCOME10', type: 1 },
    { key: 'newsletter_optin', value: true, type: 3 },
  ],
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

// function pickRandomSegment() {
//   return {
//     country: pickFrom(SEGMENTATION_DATA.countries),
//     device: pickFrom(SEGMENTATION_DATA.devices),
//     browser: pickFrom(SEGMENTATION_DATA.browsers),
//     plan: pickFrom(SEGMENTATION_DATA.plans),
//   };
// }

function generateEventData(eventName) {
  const properties = EVENT_PROPERTIES[eventName] || [];
  return properties.map(prop => ({
    key: prop.key,
    stringValue: prop.type === 1 ? prop.value : null,
    numberValue: prop.type === 2 ? prop.value : null,
    dateValue: prop.type === 3 ? new Date() : null,
    dataType: prop.type,
  }));
}

function selectEventType() {
  const rand = Math.random();
  let cumulative = 0;

  for (const event of EVENT_TYPES) {
    cumulative += event.probability;
    if (rand <= cumulative) {
      return event;
    }
  }

  return EVENT_TYPES[0]; // fallback
}

async function ensureWebsite(websiteId) {
  const existing = await prisma.website.findUnique({ where: { id: websiteId } }).catch(() => null);
  if (existing) return existing;
  return prisma.website.create({
    data: {
      id: websiteId,
      name: 'Segmented Events Test Website',
      domain: 'segmented-events-test.local',
    },
  });
}

async function cleanupRange(websiteId, start, end) {
  const endPlus = new Date(end.getTime() + 24 * 3600 * 1000);

  console.log('[seed:segmented-events] cleaning up existing data in range...');

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

  console.log(`[seed:segmented-events] cleaned up ${sessionIds.length} sessions and related data`);
}

async function seedDay({ websiteId, dayStartUtc }) {
  // Random number of iterations for this day
  const iterations = pickInt(MIN_ITERATIONS_PER_DAY, MAX_ITERATIONS_PER_DAY);

  console.log(
    `[seed:segmented-events] ${toDateOnlyString(
      dayStartUtc,
    )} - generating ${iterations} iterations`,
  );

  const sessions = [];
  const events = [];
  const eventDataEntries = [];

  for (let i = 0; i < iterations; i++) {
    // Generate unique session data
    const sessionId = randomUUID();
    const visitId = randomUUID();

    // Generate unique session data

    // Random time within the day
    const sessionTime = new Date(
      dayStartUtc.getTime() + pickInt(0, 23) * 3600 * 1000 + pickInt(0, 59) * 60 * 1000,
    );

    // Create session with enhanced segmentation data
    const deviceInfo = pickRandomDevice();
    const countryInfo = pickRandomCountry();
    const browserInfo = pickRandomBrowser(deviceInfo.type);

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
      distinctId: `user_${randomUUID().slice(0, 8)}`,
    };

    sessions.push(session);

    // Generate multiple events per session (3-8 events)
    const eventCount = pickInt(3, 8);
    const visitedPaths = new Set();

    for (let eventIndex = 0; eventIndex < eventCount; eventIndex++) {
      let path;
      do {
        path = pickFrom(PATHS);
      } while (visitedPaths.has(path) && visitedPaths.size < PATHS.length);

      visitedPaths.add(path);

      const eventTime = new Date(sessionTime.getTime() + eventIndex * pickInt(30, 180) * 1000);

      // Select event type based on probability
      const selectedEvent = selectEventType();

      if (selectedEvent.type === 1) {
        // Pageview event with UTM tracking
        const utmSource = pickFrom(UTM_SOURCES);
        const utmMedium = pickFrom(UTM_MEDIUMS);
        const utmCampaign = pickFrom(UTM_CAMPAIGNS);

        events.push({
          id: randomUUID(),
          websiteId,
          sessionId: session.id,
          visitId: visitId,
          createdAt: eventTime,
          urlPath: path,
          eventType: 1, // pageview
          eventName: null,
          referrerDomain: utmSource === 'direct' ? null : `${utmSource}.example.com`,
          utmSource: utmSource === 'direct' ? null : utmSource,
          utmMedium: utmSource === 'direct' ? null : utmMedium,
          utmCampaign: utmSource === 'direct' ? null : utmCampaign,
          pageTitle: path === '/home' ? 'Home' : path.slice(1).toUpperCase(),
        });
      } else {
        // Custom event with UTM tracking
        const utmSource = pickFrom(UTM_SOURCES);
        const utmMedium = pickFrom(UTM_MEDIUMS);
        const utmCampaign = pickFrom(UTM_CAMPAIGNS);

        const eventId = randomUUID();
        events.push({
          id: eventId,
          websiteId,
          sessionId: session.id,
          visitId: visitId,
          createdAt: eventTime,
          urlPath: path,
          eventType: 2, // custom event
          eventName: selectedEvent.name,
          referrerDomain: utmSource === 'direct' ? null : `${utmSource}.example.com`,
          utmSource: utmSource === 'direct' ? null : utmSource,
          utmMedium: utmSource === 'direct' ? null : utmMedium,
          utmCampaign: utmSource === 'direct' ? null : utmCampaign,
          pageTitle: null,
        });

        // Generate event data for this custom event
        const dataEntries = generateEventData(selectedEvent.name);
        dataEntries.forEach(entry => {
          eventDataEntries.push({
            id: randomUUID(),
            websiteId,
            websiteEventId: eventId,
            dataKey: entry.key,
            stringValue: entry.stringValue,
            numberValue: entry.numberValue,
            dateValue: entry.dateValue,
            dataType: entry.dataType,
            createdAt: eventTime,
          });
        });
      }
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
  console.log('[seed:segmented-events] config', { websiteId, startDate, endDate, resetRange });

  await ensureWebsite(websiteId);

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  if (resetRange) {
    await cleanupRange(websiteId, start, end);
  }

  console.log('[seed:segmented-events] starting segmented events seeding...');

  let totalSessions = 0;
  let totalEvents = 0;
  let totalEventData = 0;

  for (let dt = new Date(start); dt < end; dt = addDays(dt, 1)) {
    const { sessions, events, eventData } = await seedDay({ websiteId, dayStartUtc: dt });
    totalSessions += sessions;
    totalEvents += events;
    totalEventData += eventData;
  }

  console.log('[seed:segmented-events] seeding completed successfully!');
  console.log('[seed:segmented-events] summary', {
    totalSessions,
    totalEvents,
    totalEventData,
    dateRange: `${startDate} to ${endDate}`,
    segmentationOptions: {
      countries: SEGMENTATION_DATA.countries.length,
      devices: SEGMENTATION_DATA.devices.length,
      browsers: SEGMENTATION_DATA.browsers.length,
      plans: SEGMENTATION_DATA.plans.length,
    },
    eventTypes: EVENT_TYPES.length,
    eventProperties: Object.keys(EVENT_PROPERTIES).length,
  });

  console.log('\nExample tool call params:');
  console.log('  name: get-segmented-events');
  console.log('  params:', {
    segment_by: 'country',
    event_name: 'Button Click',
    date_from: startDate,
    date_to: endDate,
  });
}

if (require.main === module) {
  main()
    .catch(err => {
      console.error('[seed:segmented-events] error:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { main };
