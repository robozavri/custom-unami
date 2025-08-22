#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Seed data for check-drop-correlated-events tool
 * Generates test data for analyzing which events are correlated with user drop-offs
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
Usage: node seed-check-drop-correlated-events.js [options]

Options:
  --websiteId <id>    Website ID to seed data for (default: 5801af32-ebe2-4273-9e58-89de8971a2fd)
  --from <date>       Start date in YYYY-MM-DD format (default: 2025-07-01)
  --to <date>         End date in YYYY-MM-DD format (default: 2025-08-31)
  --reset             Clear existing data before seeding
  --help              Show this help message

Examples:
  node seed-check-drop-correlated-events.js
  node seed-check-drop-correlated-events.js --websiteId 123e4567-e89b-12d3-a456-426614174000
  node seed-check-drop-correlated-events.js --from 2025-06-01 --to 2025-09-30
  node seed-check-drop-correlated-events.js --reset
`);
      process.exit(0);
  }
}

// Event definitions with different drop-off probabilities
const events = [
  { name: 'pageview', dropOffRate: 0.05, displayName: 'Page View' },
  { name: 'clicked_button', dropOffRate: 0.15, displayName: 'Button Click' },
  { name: 'scrolled_page', dropOffRate: 0.2, displayName: 'Page Scroll' },
  { name: 'opened_menu', dropOffRate: 0.25, displayName: 'Menu Open' },
  { name: 'clicked_help', dropOffRate: 0.35, displayName: 'Help Click' },
  { name: 'opened_settings', dropOffRate: 0.4, displayName: 'Settings Open' },
  { name: 'viewed_pricing', dropOffRate: 0.45, displayName: 'Pricing View' },
  { name: 'added_to_cart', dropOffRate: 0.5, displayName: 'Add to Cart' },
  { name: 'started_checkout', dropOffRate: 0.55, displayName: 'Checkout Start' },
  { name: 'entered_email', dropOffRate: 0.6, displayName: 'Email Entry' },
  { name: 'clicked_social', dropOffRate: 0.65, displayName: 'Social Click' },
  { name: 'viewed_faq', dropOffRate: 0.7, displayName: 'FAQ View' },
  { name: 'contacted_support', dropOffRate: 0.75, displayName: 'Support Contact' },
  { name: 'downloaded_file', dropOffRate: 0.8, displayName: 'File Download' },
  { name: 'shared_content', dropOffRate: 0.85, displayName: 'Content Share' },
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
    console.log('Starting seed data generation for check-drop-correlated-events tool...');
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

        // Generate events for this session
        const numEvents = Math.floor(3 + Math.random() * 12); // 3-15 events per session
        let currentTime = new Date(sessionTime);

        for (let j = 0; j < numEvents; j++) {
          // Select an event based on drop-off probability
          const event = events[Math.floor(Math.random() * events.length)];

          // Create event
          await prisma.websiteEvent.create({
            data: {
              id: uuidv4(),
              websiteId,
              sessionId,
              visitId,
              urlPath: `/${event.name.replace(/_/g, '-')}`,
              eventName: event.name,
              referrerDomain: ['google.com', 'facebook.com', 'direct'][
                Math.floor(Math.random() * 3)
              ],
              utmSource: ['organic', 'social', 'email', 'paid'][Math.floor(Math.random() * 3)],
              utmMedium: ['search', 'social', 'email', 'cpc'][Math.floor(Math.random() * 3)],
              createdAt: currentTime,
            },
          });

          totalEvents++;

          // If this is a converting session and we're at the last event, add conversion event
          if (willConvert && j === numEvents - 1) {
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

          // Move time forward for next event
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

    console.log('\n📋 Events created:');
    events.forEach(event => {
      console.log(
        `   ${event.name} (${event.name}) - Drop-off rate: ${(event.dropOffRate * 100).toFixed(
          0,
        )}%`,
      );
    });

    console.log('\n🎯 Conversion events:');
    conversionEvents.forEach(event => {
      console.log(`   - ${event}`);
    });

    console.log('\n💡 You can now test the check-drop-correlated-events tool with:');
    console.log(`   node scripts/test-tools/test-check-drop-correlated-events.js`);
  } catch (error) {
    console.error('❌ Error generating seed data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedData();
