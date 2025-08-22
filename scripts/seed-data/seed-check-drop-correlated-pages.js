#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Seed data for check-drop-correlated-pages tool
 * Generates test data for analyzing which pages are most associated with user drop-offs
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
let websiteId = '5801af32-ebe2-4273-9e58-89de8971a2fd';
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
Usage: node seed-check-drop-correlated-pages.js [options]

Options:
  --websiteId <id>    Website ID to seed data for (default: 5801af32-ebe2-4273-9e58-89de8971a2fd)
  --from <date>       Start date in YYYY-MM-DD format (default: 2025-07-01)
  --to <date>         End date in YYYY-MM-DD format (default: 2025-08-31)
  --reset             Clear existing data before seeding
  --help              Show this help message

Examples:
  node seed-check-drop-correlated-pages.js
  node seed-check-drop-correlated-pages.js --websiteId 123e4567-e89b-12d3-a456-426614174000
  node seed-check-drop-correlated-pages.js --from 2025-06-01 --to 2025-09-30
  node seed-check-drop-correlated-pages.js --reset
`);
      process.exit(0);
  }
}

// Page definitions with different drop-off probabilities
const pages = [
  { path: '/', dropOffRate: 0.05, name: 'Homepage' },
  { path: '/products', dropOffRate: 0.15, name: 'Products' },
  { path: '/pricing', dropOffRate: 0.25, name: 'Pricing' },
  { path: '/features', dropOffRate: 0.2, name: 'Features' },
  { path: '/about', dropOffRate: 0.3, name: 'About' },
  { path: '/contact', dropOffRate: 0.35, name: 'Contact' },
  { path: '/blog', dropOffRate: 0.4, name: 'Blog' },
  { path: '/help', dropOffRate: 0.45, name: 'Help' },
  { path: '/terms', dropOffRate: 0.5, name: 'Terms' },
  { path: '/privacy', dropOffRate: 0.55, name: 'Privacy' },
  { path: '/checkout', dropOffRate: 0.6, name: 'Checkout' },
  { path: '/cart', dropOffRate: 0.65, name: 'Cart' },
  { path: '/login', dropOffRate: 0.7, name: 'Login' },
  { path: '/signup', dropOffRate: 0.75, name: 'Signup' },
  { path: '/onboarding', dropOffRate: 0.8, name: 'Onboarding' },
  { path: '/trial', dropOffRate: 0.85, name: 'Trial' },
];

// Conversion events to test against
const conversionEvents = [
  'purchase_complete',
  'signup_complete',
  'trial_started',
  'subscription_active',
];

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
    console.log('Starting seed data generation for check-drop-correlated-pages tool...');
    console.log(`Website ID: ${websiteId}`);
    console.log(`Date range: ${fromDate} to ${toDate}`);

    await clearExistingData();

    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);
    const daysDiff = Math.ceil((toDateObj - fromDateObj) / (1000 * 60 * 60 * 24));

    console.log(`Generating data for ${daysDiff} days...`);

    let totalSessions = 0;
    let totalEvents = 0;
    let convertingSessions = 0;
    let nonConvertingSessions = 0;

    // Generate data for each day
    for (let day = 0; day < daysDiff; day++) {
      const currentDate = new Date(fromDateObj);
      currentDate.setDate(currentDate.getDate() + day);

      // Generate 50-100 sessions per day
      const dailySessions = Math.floor(50 + Math.random() * 50);

      for (let i = 0; i < dailySessions; i++) {
        const sessionId = uuidv4();
        const distinctId = uuidv4();
        const visitId = uuidv4();

        // Random time within the day
        const sessionTime = new Date(currentDate);
        sessionTime.setHours(
          Math.floor(Math.random() * 24),
          Math.floor(Math.random() * 60),
          Math.floor(Math.random() * 60),
        );

        // Create session
        await prisma.session.create({
          data: {
            id: sessionId,
            websiteId,
            distinctId,
            device: ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)],
            browser: ['Chrome', 'Firefox', 'Safari', 'Edge'][Math.floor(Math.random() * 4)],
            os: ['Windows', 'macOS', 'Linux', 'iOS', 'Android'][Math.floor(Math.random() * 5)],
            country: ['US', 'CA', 'GB', 'DE', 'FR', 'JP', 'AU'][Math.floor(Math.random() * 7)],
            createdAt: sessionTime,
          },
        });

        totalSessions++;

        // Determine if this session will convert
        const willConvert = Math.random() < 0.3; // 30% conversion rate
        if (willConvert) {
          convertingSessions++;
        } else {
          nonConvertingSessions++;
        }

        // Generate pageview events for this session
        const numPageviews = Math.floor(2 + Math.random() * 8); // 2-10 pageviews per session
        let currentTime = new Date(sessionTime);

        for (let j = 0; j < numPageviews; j++) {
          // Select a page based on drop-off probability
          const page = pages[Math.floor(Math.random() * pages.length)];

          // Create pageview event
          await prisma.websiteEvent.create({
            data: {
              id: uuidv4(),
              websiteId,
              sessionId,
              visitId,
              urlPath: page.path,
              eventName: 'pageview',
              referrerDomain: ['google.com', 'facebook.com', 'direct'][
                Math.floor(Math.random() * 3)
              ],
              utmSource: ['organic', 'social', 'email', 'paid'][Math.floor(Math.random() * 3)],
              utmMedium: ['search', 'social', 'email', 'cpc'][Math.floor(Math.random() * 3)],
              createdAt: currentTime,
            },
          });

          totalEvents++;

          // If this is a converting session and we're at the last pageview, add conversion event
          if (willConvert && j === numPageviews - 1) {
            const conversionEvent =
              conversionEvents[Math.floor(Math.random() * conversionEvents.length)];
            const conversionTime = new Date(currentTime);
            conversionTime.setMinutes(
              conversionTime.getMinutes() + Math.floor(Math.random() * 30) + 5,
            );

            await prisma.websiteEvent.create({
              data: {
                id: uuidv4(),
                websiteId,
                sessionId,
                visitId,
                urlPath: `/${conversionEvent.replace(/_/g, '-')}`,
                eventName: conversionEvent,
                referrerDomain: ['google.com', 'facebook.com', 'direct'][
                  Math.floor(Math.random() * 3)
                ],
                utmSource: ['organic', 'social', 'email', 'paid'][Math.floor(Math.random() * 3)],
                utmMedium: ['search', 'social', 'email', 'cpc'][Math.floor(Math.random() * 3)],
                createdAt: conversionTime,
              },
            });

            totalEvents++;
          }

          // Move time forward for next pageview
          currentTime.setMinutes(currentTime.getMinutes() + Math.floor(Math.random() * 20) + 5);
        }
      }

      if (day % 7 === 0) {
        console.log(`   Progress: ${Math.round((day / daysDiff) * 100)}% complete`);
      }
    }

    console.log('\n✅ Seed data generation completed successfully!');
    console.log(`📊 Total sessions created: ${totalSessions.toLocaleString()}`);
    console.log(`📊 Total events created: ${totalEvents.toLocaleString()}`);
    console.log(`✅ Converting sessions: ${convertingSessions.toLocaleString()}`);
    console.log(`❌ Non-converting sessions: ${nonConvertingSessions.toLocaleString()}`);
    console.log(`📅 Date range: ${fromDate} to ${toDate}`);
    console.log(`🌐 Website ID: ${websiteId}`);

    console.log('\n📋 Pages created:');
    pages.forEach(page => {
      console.log(
        `   ${page.path} (${page.name}) - Drop-off rate: ${(page.dropOffRate * 100).toFixed(0)}%`,
      );
    });

    console.log('\n🎯 Conversion events:');
    conversionEvents.forEach(event => {
      console.log(`   - ${event}`);
    });

    console.log('\n💡 You can now test the check-drop-correlated-pages tool with:');
    console.log(`   node scripts/test-tools/test-check-drop-correlated-pages.js`);
  } catch (error) {
    console.error('❌ Error generating seed data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedData();
