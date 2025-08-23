/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Config (can be overridden via CLI flags)
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2025-07-01'; // YYYY-MM-DD
const DEFAULT_END_DATE = '2025-08-31'; // YYYY-MM-DD
const BASELINE_VISITS_PER_DAY = 150; // s
// essions/day
const AVG_PAGES_PER_VISIT = 4.5; // avg pageviews per session
const BASELINE_EVENT_RATE = 0.25; // 25% of sessions have business events

// Import enhanced constants for realistic data
const {
  BUSINESS_EVENTS,
  PATHS,
  UTM_SOURCES,
  // UTM_MEDIUMS,
  // UTM_CAMPAIGNS,
  // pickRandomDevice,
  // pickRandomBrowser,
  // pickRandomCountry,
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
    data: {
      id: websiteId,
      name: 'Event Frequency Distribution Test Website',
      domain: 'event-freq-test.local',
    },
  });
}

async function clearExistingData(websiteId, startDate, endDate) {
  console.log('Clearing existing analytics data for the date range...');

  const startDateTime = new Date(startDate + 'T00:00:00Z');
  const endDateTime = new Date(endDate + 'T23:59:59Z');

  // Order matters due to FKs: event_data -> website_event -> session_data -> session
  const eventDataDeleted = await prisma.eventData.deleteMany({
    where: {
      websiteId: websiteId,
      createdAt: {
        gte: startDateTime,
        lte: endDateTime,
      },
    },
  });

  const websiteEventsDeleted = await prisma.websiteEvent.deleteMany({
    where: {
      websiteId: websiteId,
      createdAt: {
        gte: startDateTime,
        lte: endDateTime,
      },
    },
  });

  console.log(
    `Deleted ${eventDataDeleted.count} event_data records and ${websiteEventsDeleted.count} website_event records`,
  );
}

async function seedEventFrequencyDistributionData(websiteId, startDate, endDate, eventRate) {
  console.log('Seeding event frequency distribution data...');

  const startDateTime = new Date(startDate + 'T00:00:00Z');
  const endDateTime = new Date(endDate + 'T23:59:59Z');
  const totalDays = Math.ceil((endDateTime - startDateTime) / (1000 * 60 * 60 * 24));

  console.log(`Seeding data for ${totalDays} days from ${startDate} to ${endDate}`);

  const events = [];

  // Generate sessions across the date range
  for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
    const currentDate = addDays(startDateTime, dayOffset);
    const visitsToday = pickInt(BASELINE_VISITS_PER_DAY * 0.8, BASELINE_VISITS_PER_DAY * 1.2);

    console.log(
      `Day ${dayOffset + 1}/${totalDays}: ${toDateOnlyString(currentDate)} - ${visitsToday} visits`,
    );

    for (let visit = 0; visit < visitsToday; visit++) {
      const sessionId = randomUUID();
      const visitTime = new Date(currentDate);
      visitTime.setUTCHours(pickInt(0, 23), pickInt(0, 59), pickInt(0, 59));

      // Generate pageviews for this session
      const pageCount = pickInt(1, Math.ceil(AVG_PAGES_PER_VISIT * 2));
      const pageEvents = [];

      for (let page = 0; page < pageCount; page++) {
        const pageTime = new Date(visitTime);
        pageTime.setUTCMinutes(pageTime.getUTCMinutes() + page * pickInt(1, 5));

        pageEvents.push({
          id: randomUUID(),
          websiteId: websiteId,
          sessionId: sessionId,
          visitId: sessionId,
          eventName: 'page_view',
          eventType: 1, // pageview
          urlPath: pickFrom(PATHS),
          createdAt: pageTime,
          pageTitle: `Page ${page + 1}`,
          referrerDomain:
            pickFrom(UTM_SOURCES) === 'direct' ? null : `${pickFrom(UTM_SOURCES)}.example.com`,
          utmSource: pickFrom(UTM_SOURCES) === 'direct' ? null : pickFrom(UTM_SOURCES),
        });
      }

      // Add business events based on event rate
      if (Math.random() < eventRate) {
        const businessEventCount = pickInt(1, 4); // 1-4 business events per session

        for (let event = 0; event < businessEventCount; event++) {
          const eventTime = new Date(visitTime);
          eventTime.setUTCMinutes(eventTime.getUTCMinutes() + pageCount * 2 + event * 3);

          const businessEvent = pickFrom(BUSINESS_EVENTS);
          pageEvents.push({
            id: randomUUID(),
            websiteId: websiteId,
            sessionId: sessionId,
            visitId: sessionId,
            eventName: businessEvent,
            eventType: 2, // custom event
            urlPath: pickFrom(PATHS),
            createdAt: eventTime,
            pageTitle: null,
            referrerDomain: null,
            utmSource: null,
          });
        }
      }

      events.push(...pageEvents);

      // Batch insert every 1000 events
      if (events.length >= 1000) {
        await prisma.websiteEvent.createMany({ data: events });
        console.log(`Inserted ${events.length} events`);
        events.length = 0;
      }
    }
  }

  // Insert remaining events
  if (events.length > 0) {
    await prisma.websiteEvent.createMany({ data: events });
    console.log(`Inserted final ${events.length} events`);
  }

  console.log(`Total events created: ${events.length > 0 ? events.length : 0}`);
}

async function main() {
  try {
    const { websiteId, startDate, endDate, resetRange, eventRate } = parseArgs();

    console.log('=== Event Frequency Distribution Data Seeder ===');
    console.log(`Website ID: ${websiteId}`);
    console.log(`Date Range: ${startDate} to ${endDate}`);
    console.log(`Event Rate: ${(eventRate * 100).toFixed(1)}%`);
    console.log(`Reset Range: ${resetRange ? 'Yes' : 'No'}`);
    console.log('');

    // Ensure website exists
    await ensureWebsite(websiteId);
    console.log('Website ensured');

    // Clear existing data if requested
    if (resetRange) {
      await clearExistingData(websiteId, startDate, endDate);
    }

    // Seed the data
    await seedEventFrequencyDistributionData(websiteId, startDate, endDate, eventRate);

    console.log('');
    console.log('✅ Event frequency distribution data seeding completed successfully!');
    console.log('');
    console.log('This data demonstrates:');
    console.log('- Users who perform events once vs multiple times');
    console.log('- Different event frequencies across sessions');
    console.log('- Realistic user behavior patterns');
    console.log('');
    console.log('You can now test the get-event-frequency-distribution tool with this data.');
  } catch (error) {
    console.error('❌ Error seeding event frequency distribution data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  seedEventFrequencyDistributionData,
  clearExistingData,
};
