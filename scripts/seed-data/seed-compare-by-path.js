/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Configuration for compare-by-path tool testing
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const START_DATE = '2025-07-01';
const END_DATE = '2025-08-31';

// Page paths for comparison
const PAGE_PATHS = [
  '/',
  '/home',
  '/products',
  '/products/featured',
  '/products/new',
  '/about',
  '/contact',
  '/pricing',
  '/blog',
  '/blog/tech',
  '/blog/business',
  '/checkout',
  '/signup',
  '/login',
  '/dashboard',
  '/profile',
  '/help',
  '/faq',
  '/terms',
  '/privacy',
];

// Conversion events
const CONVERSION_EVENTS = ['purchase', 'signup', 'checkout', 'subscription'];

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
      case '--reset':
        params.reset = true;
        break;
      default:
        break;
    }
  }

  return {
    websiteId: params.websiteId || DEFAULT_WEBSITE_ID,
    startDate: params.startDate || START_DATE,
    endDate: params.endDate || END_DATE,
    reset: !!params.reset,
  };
}

async function ensureWebsite(websiteId) {
  const existing = await prisma.website.findUnique({ where: { id: websiteId } }).catch(() => null);
  if (existing) return existing;

  return prisma.website.create({
    data: {
      id: websiteId,
      name: 'Compare-by-Path Test Website',
      domain: 'compare-path-test.local',
    },
  });
}

async function clearExistingData(websiteId, startDate, endDate) {
  console.log(
    `[seed-compare-by-path] Clearing existing data for website ${websiteId} from ${startDate} to ${endDate}...`,
  );

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

  console.log(`[seed-compare-by-path] Deleted ${deletedEvents.count} existing website events`);
}

async function generatePathData(websiteId, startDate, endDate) {
  console.log(`[seed-compare-by-path] Generating path data from ${startDate} to ${endDate}...`);

  const startDateTime = new Date(startDate);
  const endDateTime = new Date(endDate);
  const daysDiff = Math.ceil((endDateTime - startDateTime) / (1000 * 60 * 60 * 24));

  let totalEvents = 0;
  let totalSessions = 0;

  // Generate data for each day
  for (let day = 0; day < daysDiff; day++) {
    const currentDate = new Date(startDateTime);
    currentDate.setDate(currentDate.getDate() + day);

    // Generate different traffic patterns for each path
    for (const path of PAGE_PATHS) {
      // Different paths have different visitor volumes and conversion rates
      let baseVisitors;
      let conversionRate;

      if (path === '/' || path === '/home') {
        // Homepage gets most traffic
        baseVisitors = Math.floor(Math.random() * 100) + 50; // 50-150 visitors per day
        conversionRate = Math.random() * 0.08 + 0.02; // 2-10% conversion rate
      } else if (path === '/checkout' || path === '/signup') {
        // Conversion pages get moderate traffic but high conversion rates
        baseVisitors = Math.floor(Math.random() * 30) + 10; // 10-40 visitors per day
        conversionRate = Math.random() * 0.25 + 0.15; // 15-40% conversion rate
      } else if (path === '/products' || path === '/pricing') {
        // Product pages get good traffic and moderate conversion rates
        baseVisitors = Math.floor(Math.random() * 60) + 20; // 20-80 visitors per day
        conversionRate = Math.random() * 0.12 + 0.08; // 8-20% conversion rate
      } else if (path === '/blog' || path === '/about') {
        // Content pages get moderate traffic but lower conversion rates
        baseVisitors = Math.floor(Math.random() * 40) + 15; // 15-55 visitors per day
        conversionRate = Math.random() * 0.06 + 0.02; // 2-8% conversion rate
      } else {
        // Other pages get lower traffic and conversion rates
        baseVisitors = Math.floor(Math.random() * 25) + 5; // 5-30 visitors per day
        conversionRate = Math.random() * 0.04 + 0.01; // 1-5% conversion rate
      }

      const conversions = Math.floor(baseVisitors * conversionRate);

      // Create sessions for this path
      for (let i = 0; i < baseVisitors; i++) {
        const sessionId = uuidv4();
        const visitId = uuidv4();
        const distinctId = `visitor-${path.replace(/\//g, '-')}-${
          currentDate.toISOString().split('T')[0]
        }-${i}`;

        // Create session
        await prisma.session.create({
          data: {
            id: sessionId,
            websiteId,
            browser: ['chrome', 'firefox', 'safari', 'edge'][Math.floor(Math.random() * 4)],
            os: ['windows', 'macos', 'linux', 'android', 'ios'][Math.floor(Math.random() * 5)],
            device: ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)],
            country: ['US', 'CA', 'GB', 'DE', 'FR', 'JP', 'AU'][Math.floor(Math.random() * 7)],
            distinctId,
            createdAt: new Date(currentDate.getTime() + Math.random() * 24 * 60 * 60 * 1000),
          },
        });

        totalSessions++;

        // Create pageview event
        await prisma.websiteEvent.create({
          data: {
            id: uuidv4(),
            websiteId,
            sessionId,
            visitId,
            urlPath: path,
            eventName: 'pageview',
            referrerDomain: ['google.com', 'facebook.com', 'direct'][Math.floor(Math.random() * 3)],
            utmSource: ['organic', 'social', 'email', 'paid'][Math.floor(Math.random() * 4)],
            utmMedium: ['search', 'social', 'email', 'cpc'][Math.floor(Math.random() * 4)],
            createdAt: new Date(currentDate.getTime() + Math.random() * 24 * 60 * 60 * 1000),
          },
        });

        totalEvents++;

        // Create conversion event for some visitors
        if (i < conversions) {
          const conversionEvent =
            CONVERSION_EVENTS[Math.floor(Math.random() * CONVERSION_EVENTS.length)];

          await prisma.websiteEvent.create({
            data: {
              id: uuidv4(),
              websiteId,
              sessionId,
              visitId,
              urlPath: path,
              eventName: conversionEvent,
              referrerDomain: ['google.com', 'facebook.com', 'direct'][
                Math.floor(Math.random() * 3)
              ],
              utmSource: ['organic', 'social', 'email', 'paid'][Math.floor(Math.random() * 4)],
              utmMedium: ['search', 'social', 'email', 'cpc'][Math.floor(Math.random() * 4)],
              createdAt: new Date(currentDate.getTime() + Math.random() * 24 * 60 * 60 * 1000),
            },
          });

          totalEvents++;
        }
      }
    }

    if ((day + 1) % 7 === 0) {
      console.log(`[seed-compare-by-path] Generated data for ${day + 1}/${daysDiff} days...`);
    }
  }

  return { totalEvents, totalSessions };
}

async function main() {
  const config = parseArgs();
  console.log('[seed-compare-by-path] Starting data generation for compare-by-path tool...');
  console.log('[seed-compare-by-path] Config:', config);

  try {
    // Ensure website exists
    const website = await ensureWebsite(config.websiteId);
    console.log(`[seed-compare-by-path] Using website: ${website.name} (${website.id})`);

    // Clear existing data if requested
    if (config.reset) {
      await clearExistingData(config.websiteId, config.startDate, config.endDate);
    }

    // Generate path data
    const startTime = Date.now();
    const { totalEvents, totalSessions } = await generatePathData(
      config.websiteId,
      config.startDate,
      config.endDate,
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(80));
    console.log('[seed-compare-by-path] SEEDING COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log(`Website ID: ${config.websiteId}`);
    console.log(`Date Range: ${config.startDate} to ${config.endDate}`);
    console.log(`Total Sessions Created: ${totalSessions}`);
    console.log(`Total Events Created: ${totalEvents}`);
    console.log(`Page Paths: ${PAGE_PATHS.length} (${PAGE_PATHS.slice(0, 5).join(', ')}...)`);
    console.log(`Conversion Events: ${CONVERSION_EVENTS.length} (${CONVERSION_EVENTS.join(', ')})`);
    console.log(`Duration: ${duration}s`);
    console.log('\n🎉 Your database is now ready for compare-by-path tool testing!');
    console.log('\n📊 Expected Results:');
    console.log('  - Each page path will have different conversion rates');
    console.log('  - Homepage and product pages will have higher traffic');
    console.log('  - Checkout and signup pages will have higher conversion rates');
    console.log('  - July and August 2025 will have comparable data');
    console.log('  - You can now test with: currentFrom: 2025-08-01, currentTo: 2025-08-31');
    console.log('  - And compare with: previousFrom: 2025-07-01, previousTo: 2025-07-31');
  } catch (error) {
    console.error('[seed-compare-by-path] Fatal error:', error);
    throw error;
  }
}

if (require.main === module) {
  main()
    .catch(err => {
      console.error('[seed-compare-by-path] Fatal error:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { main };
