/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Config (can be overridden via CLI flags)
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2024-07-01'; // YYYY-MM-DD
const DEFAULT_END_DATE = '2024-08-31'; // YYYY-MM-DD
const BASELINE_VISITS_PER_DAY = 150; // sessions/day
const BASELINE_EVENT_RATE = 0.3; // 30% of sessions have button clicks

// Button types with different click patterns to test unique user analysis
const BUTTON_TYPES = [
  {
    name: 'cta_button',
    description: 'Call-to-action button - high engagement',
    clickRate: 0.25, // 25% of sessions click this
    repeatClickRate: 0.4, // 40% of users click multiple times
  },
  {
    name: 'navigation_menu',
    description: 'Navigation menu - medium engagement',
    clickRate: 0.15, // 15% of sessions click this
    repeatClickRate: 0.6, // 60% of users click multiple times
  },
  {
    name: 'search_button',
    description: 'Search button - low engagement',
    clickRate: 0.08, // 8% of sessions click this
    repeatClickRate: 0.2, // 20% of users click multiple times
  },
  {
    name: 'social_share',
    description: 'Social share button - very low engagement',
    clickRate: 0.03, // 3% of sessions click this
    repeatClickRate: 0.1, // 10% of users click multiple times
  },
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

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function pickInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// function pickFrom(array) {
//   return array[Math.floor(Math.random() * array.length)];
// }

async function ensureWebsite(websiteId) {
  const existing = await prisma.website.findUnique({ where: { id: websiteId } }).catch(() => null);
  if (existing) return existing;
  return prisma.website.create({
    data: {
      id: websiteId,
      name: 'Button Click Users Test Website',
      domain: 'button-click-users-test.local',
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

async function generateButtonClicks(websiteId, startDate, endDate) {
  console.log(`\n🌱 Generating button click events for website ${websiteId}`);
  console.log(`📅 Date range: ${startDate} to ${endDate}`);

  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

  let totalEvents = 0;
  let totalSessions = 0;
  const userClickCounts = new Map(); // Track clicks per user per button

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

      // Generate button clicks for this session
      for (const buttonType of BUTTON_TYPES) {
        const willClick = Math.random() < buttonType.clickRate;
        if (willClick) {
          // Determine how many times this user will click this button
          const clickCount = Math.random() < buttonType.repeatClickRate ? pickInt(1, 3) : 1;

          for (let clickIndex = 0; clickIndex < clickCount; clickIndex++) {
            const eventTime = new Date(sessionTime);
            eventTime.setUTCMinutes(eventTime.getUTCMinutes() + pickInt(1, 30));

            const eventId = randomUUID();

            // Create the website event
            await prisma.websiteEvent.create({
              data: {
                id: eventId,
                websiteId,
                sessionId,
                visitId,
                urlPath: '/test-page',
                eventName: buttonType.name,
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
                stringValue: buttonType.description,
                dataType: 1, // string type
                createdAt: eventTime,
              },
            });

            await prisma.eventData.create({
              data: {
                id: randomUUID(),
                websiteId,
                websiteEventId: eventId,
                dataKey: 'click_index',
                numberValue: clickIndex + 1,
                dataType: 2, // number type
                createdAt: eventTime,
              },
            });

            await prisma.eventData.create({
              data: {
                id: randomUUID(),
                websiteId,
                websiteEventId: eventId,
                dataKey: 'user_id',
                stringValue: userId,
                dataType: 1, // string type
                createdAt: eventTime,
              },
            });

            totalEvents++;

            // Track user click counts for analysis
            const key = `${userId}_${buttonType.name}`;
            userClickCounts.set(key, (userClickCounts.get(key) || 0) + 1);
          }
        }
      }
    }

    if ((day + 1) % 10 === 0 || day === daysDiff - 1) {
      console.log(
        `   ✅ Generated ${totalEvents} button clicks from ${totalSessions} sessions so far`,
      );
    }
  }

  return { totalEvents, totalSessions, userClickCounts };
}

async function main() {
  try {
    const { websiteId, startDate, endDate, resetRange } = parseArgs();

    console.log('🚀 Starting Button Click Users Seed Data Generation');
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

    // Generate button clicks
    const { totalEvents, totalSessions, userClickCounts } = await generateButtonClicks(
      websiteId,
      startDate,
      endDate,
    );

    console.log('\n🎉 Seed Data Generation Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Total Sessions: ${totalSessions.toLocaleString()}`);
    console.log(`🎯 Total Button Clicks: ${totalEvents.toLocaleString()}`);
    console.log(`📈 Click Rate: ${((totalEvents / totalSessions) * 100).toFixed(1)}%`);

    // Show button click distribution
    console.log('\n📋 Button Click Distribution:');
    BUTTON_TYPES.forEach(buttonType => {
      const buttonClicks = Array.from(userClickCounts.entries()).filter(([key]) =>
        key.includes(buttonType.name),
      );
      const totalClicks = buttonClicks.reduce((sum, [, count]) => sum + count, 0);
      const uniqueUsers = new Set(buttonClicks.map(([key]) => key.split('_')[0])).size;
      const avgClicksPerUser = uniqueUsers > 0 ? (totalClicks / uniqueUsers).toFixed(2) : '0.00';

      console.log(
        `   ${
          buttonType.name
        }: ${totalClicks.toLocaleString()} clicks, ${uniqueUsers.toLocaleString()} unique users, ${avgClicksPerUser} clicks/user`,
      );
    });

    console.log('\n✨ Ready to test get-unique-button-click-users tool!');
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

module.exports = { generateButtonClicks, BUTTON_TYPES };
