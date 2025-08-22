#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Seed data for compare-by-segment-shift tool
 * Generates test data for segment shift analysis
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
let websiteId = '00000000-0000-0000-0000-000000000000';
let fromDate = '2025-07-01';
let toDate = '2025-08-31';
let reset = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--websiteId':
      websiteId = args[++i];
      break;
    case '--from':
      fromDate = args[++i];
      break;
    case '--to':
      toDate = args[++i];
      break;
    case '--reset':
      reset = true;
      break;
    case '--help':
      console.log(`
Usage: node seed-compare-by-segment-shift.js [options]

Options:
  --websiteId <id>    Website ID to seed data for (default: 00000000-0000-0000-0000-000000000000)
  --from <date>       Start date in YYYY-MM-DD format (default: 2025-07-01)
  --to <date>         End date in YYYY-MM-DD format (default: 2025-08-31)
  --reset             Clear existing data before seeding
  --help              Show this help message

Examples:
  node seed-compare-by-segment-shift.js
  node seed-compare-by-segment-shift.js --websiteId 123e4567-e89b-12d3-a456-426614174000
  node seed-compare-by-segment-shift.js --from 2025-06-01 --to 2025-09-30
  node seed-compare-by-segment-shift.js --reset
`);
      process.exit(0);
  }
}

// Segment combinations with different performance characteristics
const segmentCombinations = [
  // Device + Country combinations
  { device: 'desktop', country: 'US', baseVisitors: 80, baseConversionRate: 0.1 },
  { device: 'desktop', country: 'CA', baseVisitors: 40, baseConversionRate: 0.12 },
  { device: 'desktop', country: 'GB', baseVisitors: 35, baseConversionRate: 0.08 },
  { device: 'mobile', country: 'US', baseVisitors: 120, baseConversionRate: 0.06 },
  { device: 'mobile', country: 'CA', baseVisitors: 60, baseConversionRate: 0.07 },
  { device: 'mobile', country: 'GB', baseVisitors: 50, baseConversionRate: 0.05 },
  { device: 'tablet', country: 'US', baseVisitors: 25, baseConversionRate: 0.15 },
  { device: 'tablet', country: 'CA', baseVisitors: 15, baseConversionRate: 0.18 },
  { device: 'tablet', country: 'GB', baseVisitors: 12, baseConversionRate: 0.12 },

  // Browser + OS combinations
  { browser: 'Chrome', os: 'Windows', baseVisitors: 100, baseConversionRate: 0.09 },
  { browser: 'Chrome', os: 'macOS', baseVisitors: 60, baseConversionRate: 0.11 },
  { browser: 'Firefox', os: 'Windows', baseVisitors: 30, baseConversionRate: 0.08 },
  { browser: 'Firefox', os: 'Linux', baseVisitors: 20, baseConversionRate: 0.1 },
  { browser: 'Safari', os: 'macOS', baseVisitors: 40, baseConversionRate: 0.12 },
  { browser: 'Safari', os: 'iOS', baseVisitors: 80, baseConversionRate: 0.06 },
  { browser: 'Edge', os: 'Windows', baseVisitors: 25, baseConversionRate: 0.07 },
];

// Conversion events
const conversionEvents = ['purchase', 'signup', 'checkout', 'subscription'];

async function clearExistingData() {
  if (!reset) return;

  console.log('Clearing existing data...');

  // Clear website events for the date range
  const fromDateObj = new Date(fromDate);
  const toDateObj = new Date(toDate);

  await prisma.websiteEvent.deleteMany({
    where: {
      websiteId,
      createdAt: {
        gte: fromDateObj,
        lte: toDateObj,
      },
    },
  });

  // Clear sessions for the date range
  await prisma.session.deleteMany({
    where: {
      websiteId,
      createdAt: {
        gte: fromDateObj,
        lte: toDateObj,
      },
    },
  });

  console.log('Existing data cleared.');
}

async function seedData() {
  try {
    console.log('Starting seed data generation for compare-by-segment-shift tool...');
    console.log(`Website ID: ${websiteId}`);
    console.log(`Date range: ${fromDate} to ${toDate}`);

    await clearExistingData();

    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);
    const daysDiff = Math.ceil((toDateObj - fromDateObj) / (1000 * 60 * 60 * 24));

    console.log(`Generating data for ${daysDiff} days...`);

    let totalSessions = 0;
    let totalEvents = 0;

    // Generate data for each day
    for (let day = 0; day < daysDiff; day++) {
      const currentDate = new Date(fromDateObj);
      currentDate.setDate(currentDate.getDate() + day);

      // Generate sessions and events for each segment combination
      for (const segmentCombo of segmentCombinations) {
        // Add some variation to make data more realistic
        const visitorVariation = 0.3; // ±30% variation
        const conversionVariation = 0.4; // ±40% variation

        const dailyVisitors = Math.floor(
          (segmentCombo.baseVisitors / daysDiff) * (1 + (Math.random() - 0.5) * visitorVariation),
        );

        const dailyConversionRate =
          segmentCombo.baseConversionRate * (1 + (Math.random() - 0.5) * conversionVariation);
        const dailyConversions = Math.floor(dailyVisitors * dailyConversionRate);

        // Create sessions
        for (let i = 0; i < dailyVisitors; i++) {
          const sessionId = uuidv4();
          const distinctId = uuidv4();

          // Random time within the day
          const sessionTime = new Date(currentDate);
          sessionTime.setHours(
            Math.floor(Math.random() * 24),
            Math.floor(Math.random() * 60),
            Math.floor(Math.random() * 60),
          );

          // Build session data object dynamically
          const sessionData = {
            id: sessionId,
            websiteId,
            distinctId,
            createdAt: sessionTime,
          };

          // Add segment fields
          if (segmentCombo.device) sessionData.device = segmentCombo.device;
          if (segmentCombo.country) sessionData.country = segmentCombo.country;
          if (segmentCombo.browser) sessionData.browser = segmentCombo.browser;
          if (segmentCombo.os) sessionData.os = segmentCombo.os;

          // Add random values for missing fields
          if (!sessionData.device) {
            sessionData.device = ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)];
          }
          if (!sessionData.country) {
            sessionData.country = ['US', 'CA', 'GB', 'DE', 'FR', 'JP', 'AU'][
              Math.floor(Math.random() * 7)
            ];
          }
          if (!sessionData.browser) {
            sessionData.browser = ['Chrome', 'Firefox', 'Safari', 'Edge'][
              Math.floor(Math.random() * 4)
            ];
          }
          if (!sessionData.os) {
            sessionData.os = ['Windows', 'macOS', 'Linux', 'iOS', 'Android'][
              Math.floor(Math.random() * 5)
            ];
          }

          await prisma.session.create({
            data: sessionData,
          });

          totalSessions++;

          // Create pageview event
          const visitId = uuidv4();
          await prisma.websiteEvent.create({
            data: {
              id: uuidv4(),
              websiteId,
              sessionId,
              visitId,
              urlPath: '/',
              eventName: 'pageview',
              referrerDomain: ['google.com', 'facebook.com', 'direct'][
                Math.floor(Math.random() * 3)
              ],
              utmSource: ['organic', 'social', 'email', 'paid'][Math.floor(Math.random() * 4)],
              utmMedium: ['search', 'social', 'email', 'cpc'][Math.floor(Math.random() * 4)],
              createdAt: sessionTime,
            },
          });

          totalEvents++;

          // Create conversion event (if this session should convert)
          if (i < dailyConversions) {
            const conversionEvent =
              conversionEvents[Math.floor(Math.random() * conversionEvents.length)];
            const conversionTime = new Date(sessionTime);
            conversionTime.setMinutes(
              conversionTime.getMinutes() + Math.floor(Math.random() * 30) + 5,
            ); // 5-35 minutes later

            await prisma.websiteEvent.create({
              data: {
                id: uuidv4(),
                websiteId,
                sessionId,
                visitId,
                urlPath: '/checkout',
                eventName: conversionEvent,
                referrerDomain: ['google.com', 'facebook.com', 'direct'][
                  Math.floor(Math.random() * 3)
                ],
                utmSource: ['organic', 'social', 'email', 'paid'][Math.floor(Math.random() * 4)],
                utmMedium: ['search', 'social', 'email', 'cpc'][Math.floor(Math.random() * 4)],
                createdAt: conversionTime,
              },
            });

            totalEvents++;
          }
        }
      }

      if (day % 7 === 0) {
        console.log(`Progress: ${Math.round((day / daysDiff) * 100)}% complete`);
      }
    }

    console.log('\n✅ Seed data generation completed successfully!');
    console.log(`📊 Total sessions created: ${totalSessions.toLocaleString()}`);
    console.log(`📊 Total events created: ${totalEvents.toLocaleString()}`);
    console.log(`🔀 Segment combinations: ${segmentCombinations.length}`);
    console.log(`🎯 Conversion events: ${conversionEvents.join(', ')}`);
    console.log(`📅 Date range: ${fromDate} to ${toDate}`);
    console.log(`🌐 Website ID: ${websiteId}`);

    console.log('\n💡 You can now test the compare-by-segment-shift tool with:');
    console.log(`   node scripts/test-tools/test-compare-by-segment-shift.js`);
  } catch (error) {
    console.error('❌ Error generating seed data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedData();
