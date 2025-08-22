/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Config (can be overridden via CLI flags)
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2024-07-01'; // YYYY-MM-DD
const DEFAULT_END_DATE = '2024-08-31'; // YYYY-MM-DD
const BASELINE_VISITS_PER_DAY = 200; // sessions/day
// const AVG_PAGES_PER_VISIT = 5.0; // avg pageviews per session
const BASELINE_EVENT_RATE = 0.25; // 25% of sessions have business events

// Event types with different frequencies to test ranking
const EVENT_TYPES = [
  { name: 'button_click', frequency: 0.4, description: 'Most frequent - button clicks' },
  { name: 'form_submit', frequency: 0.25, description: 'Second most frequent - form submissions' },
  { name: 'add_to_cart', frequency: 0.15, description: 'Third most frequent - cart additions' },
  { name: 'checkout_start', frequency: 0.1, description: 'Fourth most frequent - checkout starts' },
  {
    name: 'purchase_complete',
    frequency: 0.05,
    description: 'Least frequent - completed purchases',
  },
  { name: 'newsletter_signup', frequency: 0.03, description: 'Rare - newsletter signups' },
  { name: 'download_file', frequency: 0.02, description: 'Very rare - file downloads' },
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

async function ensureWebsite(websiteId) {
  const existing = await prisma.website.findUnique({ where: { id: websiteId } }).catch(() => null);
  if (existing) return existing;
  return prisma.website.create({
    data: {
      id: websiteId,
      name: 'Most Frequent Events Test Website',
      domain: 'most-frequent-events-test.local',
    },
  });
}

async function ensureSession(websiteId, sessionId, visitId, userId, date) {
  const existing = await prisma.session.findUnique({ where: { id: sessionId } }).catch(() => null);
  if (existing) return existing;

  return prisma.session.create({
    data: {
      id: sessionId,
      websiteId,
      browser: 'Chrome',
      os: 'Windows',
      device: 'desktop',
      country: 'US',
      createdAt: date,
    },
  });
}

async function generateEvents(websiteId, startDate, endDate) {
  console.log(`\n🌱 Generating events for website ${websiteId}`);
  console.log(`📅 Date range: ${startDate} to ${endDate}`);

  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

  let totalEvents = 0;
  let totalSessions = 0;

  for (let day = 0; day < daysDiff; day++) {
    const currentDate = addDays(start, day);
    const visitsToday = pickInt(BASELINE_VISITS_PER_DAY * 0.8, BASELINE_VISITS_PER_DAY * 1.2);

    console.log(`📊 Day ${day + 1}/${daysDiff}: ${visitsToday} visits`);

    for (let visit = 0; visit < visitsToday; visit++) {
      const sessionId = randomUUID();
      const visitId = randomUUID();
      const userId = randomUUID();
      const sessionTime = new Date(currentDate);
      sessionTime.setUTCHours(pickInt(0, 23), pickInt(0, 59), pickInt(0, 59));

      // Ensure session exists
      await ensureSession(websiteId, sessionId, visitId, userId, sessionTime);
      totalSessions++;

      // Generate events for this session
      const hasEvents = Math.random() < BASELINE_EVENT_RATE;
      if (hasEvents) {
        const eventCount = pickInt(1, 5); // 1-5 events per session

        for (let eventIndex = 0; eventIndex < eventCount; eventIndex++) {
          const eventType = pickFrom(EVENT_TYPES);
          const eventTime = new Date(sessionTime);
          eventTime.setUTCMinutes(eventTime.getUTCMinutes() + pickInt(1, 30));

          // Create event with weighted frequency
          if (Math.random() < eventType.frequency) {
            const eventId = randomUUID();

            // Create the website event
            await prisma.websiteEvent.create({
              data: {
                id: eventId,
                websiteId,
                sessionId,
                visitId,
                urlPath: '/test-page',
                eventName: eventType.name,
                eventType: 1, // custom event
                createdAt: eventTime,
              },
            });

            // Create related event data
            await prisma.eventData.create({
              data: {
                id: randomUUID(),
                websiteId,
                websiteEventId: eventId,
                dataKey: 'description',
                stringValue: eventType.description,
                dataType: 1, // string type
                createdAt: eventTime,
              },
            });

            await prisma.eventData.create({
              data: {
                id: randomUUID(),
                websiteId,
                websiteEventId: eventId,
                dataKey: 'timestamp',
                stringValue: eventTime.toISOString(),
                dataType: 1, // string type
                createdAt: eventTime,
              },
            });

            await prisma.eventData.create({
              data: {
                id: randomUUID(),
                websiteId,
                websiteEventId: eventId,
                dataKey: 'session_event_index',
                numberValue: eventIndex,
                dataType: 2, // number type
                createdAt: eventTime,
              },
            });

            totalEvents++;
          }
        }
      }
    }

    if ((day + 1) % 10 === 0 || day === daysDiff - 1) {
      console.log(`   ✅ Generated ${totalEvents} events from ${totalSessions} sessions so far`);
    }
  }

  return { totalEvents, totalSessions };
}

async function main() {
  try {
    const { websiteId, startDate, endDate, resetRange } = parseArgs();

    console.log('🚀 Starting Most Frequent Events Seed Data Generation');
    console.log('='.repeat(60));

    // Ensure website exists
    const website = await ensureWebsite(websiteId);
    console.log(`🌐 Using website: ${website.name} (${website.id})`);

    if (resetRange) {
      console.log('🗑️  Clearing existing events in date range...');

      // First delete related EventData records
      const deleteEventDataResult = await prisma.eventData.deleteMany({
        where: {
          websiteId,
          websiteEvent: {
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
        },
      });
      console.log(`   ✅ Deleted ${deleteEventDataResult.count} related event data records`);

      // Then delete WebsiteEvent records
      const deleteEventsResult = await prisma.websiteEvent.deleteMany({
        where: {
          websiteId,
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      });
      console.log(`   ✅ Deleted ${deleteEventsResult.count} existing events`);
    }

    // Generate events
    const { totalEvents, totalSessions } = await generateEvents(websiteId, startDate, endDate);

    console.log('\n🎉 Seed Data Generation Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Total Sessions: ${totalSessions.toLocaleString()}`);
    console.log(`🎯 Total Events: ${totalEvents.toLocaleString()}`);
    console.log(`📈 Event Rate: ${((totalEvents / totalSessions) * 100).toFixed(1)}%`);

    // Show expected event distribution
    console.log('\n📋 Expected Event Distribution:');
    EVENT_TYPES.forEach(eventType => {
      const expectedCount = Math.floor(totalEvents * eventType.frequency);
      console.log(
        `   ${eventType.name}: ~${expectedCount.toLocaleString()} (${(
          eventType.frequency * 100
        ).toFixed(1)}%)`,
      );
    });

    console.log('\n✨ Ready to test get-most-frequent-events tool!');
  } catch (error) {
    console.error('❌ Error during seed data generation:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateEvents, EVENT_TYPES };
