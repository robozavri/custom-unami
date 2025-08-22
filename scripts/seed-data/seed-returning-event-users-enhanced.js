/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Configuration
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2024-07-01';
const DEFAULT_END_DATE = '2024-08-31';
// const MIN_ITERATIONS_PER_DAY = 20;
// const MAX_ITERATIONS_PER_DAY = 50;

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
} = require('./seed-constants');

// User behavior patterns for returning users analysis
const USER_BEHAVIOR_PATTERNS = {
  // User types with different return patterns
  userTypes: [
    {
      name: 'power_user',
      returnProbability: 0.8, // 80% chance to return
      avgSessionsPerUser: 8,
      sessionSpacing: { min: 1, max: 3 }, // days between sessions
      eventTypes: ['Page View', 'Button Click', 'Form Submit', 'File Download', 'Video Play'],
      eventFrequency: { min: 5, max: 12 }, // events per session
    },
    {
      name: 'regular_user',
      returnProbability: 0.6, // 60% chance to return
      avgSessionsPerUser: 4,
      sessionSpacing: { min: 2, max: 7 }, // days between sessions
      eventTypes: ['Page View', 'Button Click', 'Form Submit'],
      eventFrequency: { min: 3, max: 8 }, // events per session
    },
    {
      name: 'occasional_user',
      returnProbability: 0.3, // 30% chance to return
      avgSessionsPerUser: 2,
      sessionSpacing: { min: 5, max: 14 }, // days between sessions
      eventTypes: ['Page View', 'Button Click'],
      eventFrequency: { min: 2, max: 5 }, // events per session
    },
    {
      name: 'one_time_user',
      returnProbability: 0.1, // 10% chance to return
      avgSessionsPerUser: 1,
      sessionSpacing: { min: 10, max: 30 }, // days between sessions
      eventTypes: ['Page View'],
      eventFrequency: { min: 1, max: 3 }, // events per session
    },
  ],

  // Event types with different user engagement patterns
  eventTypes: [
    { name: 'Page View', type: 1, probability: 0.35 },
    { name: 'Button Click', type: 2, probability: 0.2 },
    { name: 'Form Submit', type: 2, probability: 0.15 },
    { name: 'File Download', type: 2, probability: 0.1 },
    { name: 'Video Play', type: 2, probability: 0.08 },
    { name: 'Search Query', type: 2, probability: 0.06 },
    { name: 'Add to Cart', type: 2, probability: 0.04 },
    { name: 'Purchase', type: 2, probability: 0.02 },
  ],

  // User properties that influence return behavior (using enhanced constants)
  userProperties: {
    countries: COUNTRIES.map(country => ({
      code: country.code,
      returnRate: 0.5 + Math.random() * 0.3, // Random return rate between 50-80%
      avgSessions: 2 + Math.random() * 4, // Random sessions between 2-6
    })),
    devices: Object.keys(DEVICES).map(deviceType => ({
      type: deviceType,
      returnRate: 0.5 + Math.random() * 0.3, // Random return rate between 50-80%
      avgSessions: 2 + Math.random() * 4, // Random sessions between 2-6
    })),
    browsers: ['chrome', 'firefox', 'safari', 'edge', 'samsung'].map(browser => ({
      name: browser,
      returnRate: 0.5 + Math.random() * 0.3, // Random return rate between 50-80%
      avgSessions: 2 + Math.random() * 4, // Random sessions between 2-6
    })),
  },
};

// Use enhanced page paths
const PAGE_PATHS = PATHS;

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
      case '--user-count':
        params.userCount = parseInt(next);
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
    userCount: params.userCount || 300,
  };
}

// function toDateOnlyString(date) {
//   const y = date.getUTCFullYear();
//   const m = String(date.getUTCMonth() + 1).padStart(2, '0');
//   const d = String(date.getUTCDate()).padStart(2, '0');
//   return `${y}-${m}-${d}`;
// }

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

function pickRandomUserType() {
  return pickFrom(USER_BEHAVIOR_PATTERNS.userTypes);
}

function pickRandomUserProperties() {
  return {
    country: pickFrom(USER_BEHAVIOR_PATTERNS.userProperties.countries),
    device: pickFrom(USER_BEHAVIOR_PATTERNS.userProperties.devices),
    browser: pickFrom(USER_BEHAVIOR_PATTERNS.userProperties.browsers),
  };
}

function selectEventType() {
  const rand = Math.random();
  let cumulative = 0;

  for (const event of USER_BEHAVIOR_PATTERNS.eventTypes) {
    cumulative += event.probability;
    if (rand <= cumulative) {
      return event;
    }
  }

  return USER_BEHAVIOR_PATTERNS.eventTypes[0]; // fallback
}

function generateUserSessions(userId, userType, userProps, startDate, endDate) {
  const sessions = [];
  const events = [];
  const eventDataEntries = [];

  let currentDate = new Date(startDate);
  let sessionCount = 0;
  const maxSessions = userType.avgSessionsPerUser;

  while (currentDate < endDate && sessionCount < maxSessions) {
    // Determine if user returns based on return probability
    if (sessionCount > 0 && Math.random() > userType.returnProbability) {
      break;
    }

    // Calculate session spacing
    if (sessionCount > 0) {
      const spacing = pickInt(userType.sessionSpacing.min, userType.sessionSpacing.max);
      currentDate = addDays(currentDate, spacing);
      if (currentDate >= endDate) break;
    }

    const sessionId = randomUUID();
    const visitId = randomUUID();
    const sessionTime = new Date(
      currentDate.getTime() + pickInt(0, 23) * 3600 * 1000 + pickInt(0, 59) * 60 * 1000,
    );

    // Create session with realistic device and country data
    const deviceInfo = pickRandomDevice();
    const countryInfo = pickRandomCountry();
    const browserInfo = pickRandomBrowser(deviceInfo.type);

    const session = {
      id: sessionId,
      websiteId: null, // Will be set later
      createdAt: sessionTime,
      device: deviceInfo.type,
      country: countryInfo.code,
      browser: browserInfo.browser,
      os: deviceInfo.os,
      screen: deviceInfo.screen,
      language: 'en-US',
      region: countryInfo.region,
      city: countryInfo.city,
      distinctId: userId,
    };

    sessions.push(session);

    // Generate events for this session
    const eventCount = pickInt(userType.eventFrequency.min, userType.eventFrequency.max);
    const visitedPaths = new Set();

    for (let eventIndex = 0; eventIndex < eventCount; eventIndex++) {
      let path;
      do {
        path = pickFrom(PAGE_PATHS);
      } while (visitedPaths.has(path) && visitedPaths.size < PAGE_PATHS.length);

      visitedPaths.add(path);

      const eventTime = new Date(sessionTime.getTime() + eventIndex * pickInt(30, 180) * 1000);
      const selectedEvent = selectEventType();

      if (selectedEvent.type === 1) {
        // Pageview event with UTM tracking
        const utmSource = pickFrom(UTM_SOURCES);
        const utmMedium = pickFrom(UTM_MEDIUMS);
        const utmCampaign = pickFrom(UTM_CAMPAIGNS);

        events.push({
          id: randomUUID(),
          websiteId: null, // Will be set later
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

        events.push({
          id: randomUUID(),
          websiteId: null, // Will be set later
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
      }
    }

    sessionCount++;
  }

  return { sessions, events, eventDataEntries };
}

async function ensureWebsite(websiteId) {
  const existing = await prisma.website.findUnique({ where: { id: websiteId } }).catch(() => null);
  if (existing) return existing;
  return prisma.website.create({
    data: {
      id: websiteId,
      name: 'Returning Event Users Test Website',
      domain: 'returning-users-test.local',
    },
  });
}

async function cleanupRange(websiteId, start, end) {
  const endPlus = new Date(end.getTime() + 24 * 3600 * 1000);

  console.log('[seed:returning-event-users] cleaning up existing data in range...');

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

  console.log(
    `[seed:returning-event-users] cleaned up ${sessionIds.length} sessions and related data`,
  );
}

async function main() {
  const { websiteId, startDate, endDate, resetRange, userCount } = parseArgs();
  console.log('[seed:returning-event-users] config', {
    websiteId,
    startDate,
    endDate,
    resetRange,
    userCount,
  });

  await ensureWebsite(websiteId);

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  if (resetRange) {
    await cleanupRange(websiteId, start, end);
  }

  console.log('[seed:returning-event-users] starting returning event users seeding...');

  let totalSessions = 0;
  let totalEvents = 0;
  let totalEventData = 0;
  let totalUsers = 0;

  // Generate users with realistic return patterns
  for (let userIndex = 0; userIndex < userCount; userIndex++) {
    const userId = `user_${userIndex + 1}_${randomUUID().slice(0, 8)}`;
    const userType = pickRandomUserType();
    const userProps = pickRandomUserProperties();

    // Generate sessions for this user
    const { sessions, events, eventDataEntries } = generateUserSessions(
      userId,
      userType,
      userProps,
      start,
      end,
    );

    if (sessions.length > 0) {
      totalUsers++;
      totalSessions += sessions.length;
      totalEvents += events.length;
      totalEventData += eventDataEntries.length;

      // Set websiteId for all sessions and events
      sessions.forEach(s => (s.websiteId = websiteId));
      events.forEach(e => (e.websiteId = websiteId));

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
    }

    if ((userIndex + 1) % 50 === 0) {
      console.log(`[seed:returning-event-users] processed ${userIndex + 1}/${userCount} users...`);
    }
  }

  console.log('[seed:returning-event-users] seeding completed successfully!');
  console.log('[seed:returning-event-users] summary', {
    totalUsers,
    totalSessions,
    totalEvents,
    totalEventData,
    dateRange: `${startDate} to ${endDate}`,
    userBehaviorPatterns: {
      userTypes: USER_BEHAVIOR_PATTERNS.userTypes.length,
      eventTypes: USER_BEHAVIOR_PATTERNS.eventTypes.length,
      countries: USER_BEHAVIOR_PATTERNS.userProperties.countries.length,
      devices: USER_BEHAVIOR_PATTERNS.userProperties.devices.length,
      browsers: USER_BEHAVIOR_PATTERNS.userProperties.browsers.length,
    },
    averageSessionsPerUser: totalUsers > 0 ? (totalSessions / totalUsers).toFixed(2) : 0,
    averageEventsPerUser: totalUsers > 0 ? (totalEvents / totalUsers).toFixed(2) : 0,
  });

  console.log('\nExample tool call params:');
  console.log('  name: get-returning-event-users');
  console.log('  params:', {
    granularity: 'day',
    event_name: 'Button Click',
    date_from: startDate,
    date_to: endDate,
  });
}

if (require.main === module) {
  main()
    .catch(err => {
      console.error('[seed:returning-event-users] error:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { main };
