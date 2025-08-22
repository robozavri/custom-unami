#!/usr/bin/env node

/**
 * Seed data for check-event-drop-chain tool
 * Generates test data for funnel analysis with sequential events
 */
/* eslint-disable no-console */
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
Usage: node seed-check-event-drop-chain.js [options]

Options:
  --websiteId <id>    Website ID to seed data for (default: 00000000-0000-0000-0000-000000000000)
  --from <date>       Start date in YYYY-MM-DD format (default: 2025-07-01)
  --to <date>         End date in YYYY-MM-DD format (default: 2025-08-31)
  --reset             Clear existing data before seeding
  --help              Show this help message

Examples:
  node seed-check-event-drop-chain.js
  node seed-check-event-drop-chain.js --websiteId 123e4567-e89b-12d3-a456-426614174000
  node seed-check-event-drop-chain.js --from 2025-06-01 --to 2025-09-30
  node seed-check-event-drop-chain.js --reset
`);
      process.exit(0);
  }
}

// Funnel definitions with different conversion rates
const funnels = [
  {
    name: 'E-commerce Checkout',
    steps: ['view_product', 'add_to_cart', 'start_checkout', 'payment_info', 'purchase_complete'],
    baseConversionRates: [1.0, 0.15, 0.08, 0.06, 0.04], // Each step's conversion rate
    baseVisitors: 1000,
  },
  {
    name: 'User Onboarding',
    steps: [
      'signup_started',
      'email_verified',
      'profile_created',
      'first_action',
      'feature_adopted',
    ],
    baseConversionRates: [1.0, 0.85, 0.7, 0.55, 0.4],
    baseVisitors: 800,
  },
  {
    name: 'Lead Generation',
    steps: [
      'landing_page_view',
      'form_started',
      'form_completed',
      'lead_qualified',
      'contact_made',
    ],
    baseConversionRates: [1.0, 0.25, 0.18, 0.12, 0.08],
    baseVisitors: 600,
  },
  {
    name: 'Subscription Flow',
    steps: [
      'trial_started',
      'trial_used',
      'plan_selected',
      'payment_entered',
      'subscription_active',
    ],
    baseConversionRates: [1.0, 0.75, 0.45, 0.35, 0.25],
    baseVisitors: 500,
  },
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
    console.log('Starting seed data generation for check-event-drop-chain tool...');
    console.log(`Website ID: ${websiteId}`);
    console.log(`Date range: ${fromDate} to ${toDate}`);

    await clearExistingData();

    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);
    const daysDiff = Math.ceil((toDateObj - fromDateObj) / (1000 * 60 * 60 * 24));

    console.log(`Generating data for ${daysDiff} days...`);

    let totalSessions = 0;
    let totalEvents = 0;

    // Generate data for each funnel
    for (const funnel of funnels) {
      console.log(`\n📊 Generating data for funnel: ${funnel.name}`);
      console.log(`   Steps: ${funnel.steps.join(' → ')}`);

      // Generate data for each day
      for (let day = 0; day < daysDiff; day++) {
        const currentDate = new Date(fromDateObj);
        currentDate.setDate(currentDate.getDate() + day);

        // Add some variation to make data more realistic
        const dailyVariation = 0.3; // ±30% variation
        const dailyVisitors = Math.floor(
          (funnel.baseVisitors / daysDiff) * (1 + (Math.random() - 0.5) * dailyVariation),
        );

        // Generate sessions and events for this funnel
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

          // Generate funnel events based on conversion rates
          let currentStep = 0;
          let currentTime = new Date(sessionTime);

          while (currentStep < funnel.steps.length) {
            const step = funnel.steps[currentStep];
            const baseRate = funnel.baseConversionRates[currentStep];

            // Add some variation to conversion rates
            const rateVariation = 0.2; // ±20% variation
            const actualRate = baseRate * (1 + (Math.random() - 0.5) * rateVariation);

            // Determine if user progresses to this step
            if (Math.random() <= actualRate) {
              // User completed this step
              const eventTime = new Date(currentTime);
              eventTime.setMinutes(eventTime.getMinutes() + Math.floor(Math.random() * 30) + 5);

              await prisma.websiteEvent.create({
                data: {
                  id: uuidv4(),
                  websiteId,
                  sessionId,
                  visitId,
                  urlPath: `/${step.replace(/_/g, '-')}`,
                  eventName: step,
                  referrerDomain: ['google.com', 'facebook.com', 'direct'][
                    Math.floor(Math.random() * 3)
                  ],
                  utmSource: ['organic', 'social', 'email', 'paid'][Math.floor(Math.random() * 4)],
                  utmMedium: ['search', 'social', 'email', 'cpc'][Math.floor(Math.random() * 4)],
                  createdAt: eventTime,
                },
              });

              totalEvents++;
              currentTime = eventTime;
              currentStep++;
            } else {
              // User dropped off at this step
              break;
            }
          }
        }

        if (day % 7 === 0) {
          console.log(`   Progress: ${Math.round((day / daysDiff) * 100)}% complete`);
        }
      }
    }

    console.log('\n✅ Seed data generation completed successfully!');
    console.log(`📊 Total sessions created: ${totalSessions.toLocaleString()}`);
    console.log(`📊 Total events created: ${totalEvents.toLocaleString()}`);
    console.log(`🔀 Funnels created: ${funnels.length}`);
    console.log(`📅 Date range: ${fromDate} to ${toDate}`);
    console.log(`🌐 Website ID: ${websiteId}`);

    console.log('\n📋 Funnel Details:');
    funnels.forEach(funnel => {
      console.log(`   ${funnel.name}: ${funnel.steps.join(' → ')}`);
    });

    console.log('\n💡 You can now test the check-event-drop-chain tool with:');
    console.log(`   node scripts/test-tools/test-check-event-drop-chain.js`);
  } catch (error) {
    console.error('❌ Error generating seed data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedData();
