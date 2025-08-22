#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Seed data generator for compare-by-country tool
 * Generates realistic test data with different conversion patterns across various countries
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
let websiteId = '5801af32-ebe2-4273-9e58-89de8971a2fd'; // Default website ID
let startDate = '2025-07-01';
let endDate = '2025-08-31';
let reset = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--website':
    case '--websiteId':
      websiteId = args[++i];
      break;
    case '--from':
    case '--start':
      startDate = args[++i];
      break;
    case '--to':
    case '--end':
      endDate = args[++i];
      break;
    case '--reset':
      reset = true;
      break;
    case '--help':
      console.log(`
Usage: node scripts/seed-data/seed-compare-by-country.js [options]

Options:
  --website, --websiteId <id>  Website ID to use (default: ${websiteId})
  --from, --start <date>       Start date in YYYY-MM-DD format (default: ${startDate})
  --to, --end <date>           End date in YYYY-MM-DD format (default: ${endDate})
  --reset                      Clear existing data in the date range before seeding
  --help                       Show this help message

Examples:
  node scripts/seed-data/seed-compare-by-country.js
  node scripts/seed-data/seed-compare-by-country.js --from 2025-06-01 --to 2025-09-30
  node scripts/seed-data/seed-compare-by-country.js --website YOUR_WEBSITE_ID --reset
`);
      process.exit(0);
  }
}

async function main() {
  try {
    console.log(
      '[seed-compare-by-country] Starting data generation for compare-by-country tool...',
    );
    console.log('[seed-compare-by-country] Config:', {
      websiteId,
      startDate,
      endDate,
      reset,
    });

    // Verify website exists
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { id: true, name: true },
    });

    if (!website) {
      console.error(`[seed-compare-by-country] Website with ID ${websiteId} not found`);
      process.exit(1);
    }

    console.log(`[seed-compare-by-country] Using website: ${website.name} (${websiteId})`);

    // Clear existing data if reset flag is set
    if (reset) {
      console.log('[seed-compare-by-country] Clearing existing data...');
      await clearExistingData(websiteId, startDate, endDate);
    }

    // Generate country data
    await generateCountryData(websiteId, startDate, endDate);

    console.log('\n' + '='.repeat(80));
    console.log('[seed-compare-by-country] SEEDING COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log(`Website ID: ${websiteId}`);
    console.log(`Date Range: ${startDate} to ${endDate}`);
    console.log('🎉 Your database is now ready for compare-by-country tool testing!');
    console.log('\n📊 Expected Results:');
    console.log('  - Each country will have different conversion rates');
    console.log('  - US and major European countries will have higher traffic');
    console.log('  - Some countries will show conversion drops or improvements');
    console.log('  - July and August 2025 will have comparable data');
    console.log('  - You can now test with: currentFrom: 2025-08-01, currentTo: 2025-08-31');
    console.log('  - And compare with: previousFrom: 2025-07-01, previousTo: 2025-07-31');
  } catch (error) {
    console.error('[seed-compare-by-country] Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function clearExistingData(websiteId, startDate, endDate) {
  const startDateTime = new Date(startDate);
  const endDateTime = new Date(endDate);

  // Clear website events in the date range
  const deletedEvents = await prisma.websiteEvent.deleteMany({
    where: {
      websiteId,
      createdAt: {
        gte: startDateTime,
        lte: endDateTime,
      },
    },
  });

  // Clear sessions in the date range
  const deletedSessions = await prisma.session.deleteMany({
    where: {
      websiteId,
      createdAt: {
        gte: startDateTime,
        lte: endDateTime,
      },
    },
  });

  console.log(
    `[seed-compare-by-country] Cleared ${deletedEvents.count} events and ${deletedSessions.count} sessions`,
  );
}

async function generateCountryData(websiteId, startDate, endDate) {
  console.log(
    `[seed-compare-by-country] Generating country data from ${startDate} to ${endDate}...`,
  );

  const startDateTime = new Date(startDate);
  const endDateTime = new Date(endDate);
  const totalDays = Math.ceil((endDateTime - startDateTime) / (1000 * 60 * 60 * 24));

  // Define countries with different traffic patterns and conversion rates
  const COUNTRIES = [
    { code: 'US', name: 'United States', baseVisitors: 200, conversionRate: 0.15 },
    { code: 'GB', name: 'United Kingdom', baseVisitors: 80, conversionRate: 0.12 },
    { code: 'DE', name: 'Germany', baseVisitors: 70, conversionRate: 0.1 },
    { code: 'FR', name: 'France', baseVisitors: 60, conversionRate: 0.11 },
    { code: 'CA', name: 'Canada', baseVisitors: 50, conversionRate: 0.13 },
    { code: 'AU', name: 'Australia', baseVisitors: 40, conversionRate: 0.14 },
    { code: 'NL', name: 'Netherlands', baseVisitors: 35, conversionRate: 0.09 },
    { code: 'SE', name: 'Sweden', baseVisitors: 30, conversionRate: 0.08 },
    { code: 'NO', name: 'Norway', baseVisitors: 25, conversionRate: 0.07 },
    { code: 'DK', name: 'Denmark', baseVisitors: 20, conversionRate: 0.06 },
    { code: 'IT', name: 'Italy', baseVisitors: 45, conversionRate: 0.1 },
    { code: 'ES', name: 'Spain', baseVisitors: 40, conversionRate: 0.09 },
    { code: 'JP', name: 'Japan', baseVisitors: 35, conversionRate: 0.11 },
    { code: 'KR', name: 'South Korea', baseVisitors: 30, conversionRate: 0.1 },
    { code: 'BR', name: 'Brazil', baseVisitors: 25, conversionRate: 0.08 },
    { code: 'MX', name: 'Mexico', baseVisitors: 20, conversionRate: 0.07 },
    { code: 'IN', name: 'India', baseVisitors: 30, conversionRate: 0.06 },
    { code: 'SG', name: 'Singapore', baseVisitors: 15, conversionRate: 0.12 },
    { code: 'AE', name: 'United Arab Emirates', baseVisitors: 10, conversionRate: 0.09 },
    { code: 'ZA', name: 'South Africa', baseVisitors: 15, conversionRate: 0.05 },
  ];

  const conversionEvents = ['purchase', 'signup', 'checkout', 'subscription'];
  let totalSessions = 0;
  let totalEvents = 0;

  for (let day = 0; day < totalDays; day++) {
    const currentDate = new Date(startDateTime);
    currentDate.setDate(currentDate.getDate() + day);

    if (day > 0 && day % 7 === 0) {
      console.log(`[seed-compare-by-country] Generated data for ${day}/${totalDays} days...`);
    }

    for (const country of COUNTRIES) {
      // Add some variation to visitor count and conversion rate
      const visitorVariation = 0.3; // ±30% variation
      const conversionVariation = 0.2; // ±20% variation

      const dailyVisitors = Math.floor(
        country.baseVisitors * (1 + (Math.random() - 0.5) * visitorVariation),
      );

      const dailyConversionRate =
        country.conversionRate * (1 + (Math.random() - 0.5) * conversionVariation);

      // Create sessions for this country on this day
      for (let i = 0; i < dailyVisitors; i++) {
        const sessionId = uuidv4();
        const visitId = uuidv4();
        const distinctId = `visitor-${country.code}-${
          currentDate.toISOString().split('T')[0]
        }-${i}`;

        // Create session
        await prisma.session.create({
          data: {
            id: sessionId,
            websiteId,
            distinctId,
            country: country.code,
            browser: ['Chrome', 'Firefox', 'Safari', 'Edge'][Math.floor(Math.random() * 4)],
            os: ['Windows', 'macOS', 'Linux', 'iOS', 'Android'][Math.floor(Math.random() * 5)],
            device: ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)],
            createdAt: currentDate,
          },
        });

        // Create pageview event
        await prisma.websiteEvent.create({
          data: {
            id: uuidv4(),
            websiteId,
            sessionId,
            visitId,
            urlPath: '/',
            eventName: 'pageview',
            referrerDomain: ['google.com', 'facebook.com', 'direct'][Math.floor(Math.random() * 3)],
            utmSource: ['organic', 'social', 'email', 'paid'][Math.floor(Math.random() * 4)],
            utmMedium: ['search', 'social', 'email', 'cpc'][Math.floor(Math.random() * 4)],
            createdAt: currentDate,
          },
        });

        // Create conversion event based on conversion rate
        if (Math.random() < dailyConversionRate) {
          const conversionEvent =
            conversionEvents[Math.floor(Math.random() * conversionEvents.length)];

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
              createdAt: currentDate,
            },
          });
        }

        totalSessions++;
        totalEvents += 2; // pageview + potential conversion
      }
    }
  }

  console.log(`[seed-compare-by-country] Generated data for ${totalDays} days`);
  console.log(`[seed-compare-by-country] Total sessions created: ${totalSessions}`);
  console.log(`[seed-compare-by-country] Total events created: ${totalEvents}`);
  console.log(
    `[seed-compare-by-country] Countries: ${COUNTRIES.length} (${COUNTRIES.map(c => c.code).join(
      ', ',
    )})`,
  );
  console.log(
    `[seed-compare-by-country] Conversion events: ${
      conversionEvents.length
    } (${conversionEvents.join(', ')})`,
  );
}

// Run the main function
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
