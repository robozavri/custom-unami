const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const { subDays } = require('date-fns');
/* eslint-disable no-console */
const prisma = new PrismaClient();

// Will be fetched from database
let WEBSITE_ID;
let USER_ID;

// async function clearExistingData() {
//   console.log('Clearing existing data...');

//   // Clear in correct order to avoid foreign key constraints
//   await prisma.eventData.deleteMany({
//     where: { websiteId: WEBSITE_ID },
//   });

//   await prisma.websiteEvent.deleteMany({
//     where: { websiteId: WEBSITE_ID },
//   });

//   await prisma.session.deleteMany({
//     where: { websiteId: WEBSITE_ID },
//   });

//   await prisma.website.deleteMany({
//     where: { id: WEBSITE_ID },
//   });

//   await prisma.user.deleteMany({
//     where: { id: USER_ID },
//   });

//   console.log('Existing data cleared');
// }

async function fetchExistingIds() {
  console.log('Fetching existing IDs from database...');

  // Get first available user
  const user = await prisma.user.findFirst();
  if (!user) {
    throw new Error('No users found in database');
  }
  USER_ID = user.id;
  console.log(`Using user ID: ${USER_ID}`);

  // Get first available website
  const website = await prisma.website.findFirst();
  if (!website) {
    throw new Error('No websites found in database');
  }
  WEBSITE_ID = website.id;
  console.log(`Using website ID: ${WEBSITE_ID}`);

  return { user, website };
}

async function createTestData() {
  console.log('Creating test data...');

  // Fetch existing IDs first
  const { user, website } = await fetchExistingIds();

  // Create sessions
  const sessions = [];
  const sessionIds = [];

  for (let i = 0; i < 50; i++) {
    const sessionId = randomUUID();
    sessionIds.push(sessionId);

    const session = await prisma.session.create({
      data: {
        id: sessionId,
        websiteId: WEBSITE_ID,
        browser: 'Chrome',
        os: 'Windows',
        device: 'desktop',
        country: 'US',
        createdAt: subDays(new Date(), Math.floor(Math.random() * 30)),
      },
    });
    sessions.push(session);
  }

  // Create events
  const events = [];

  // Add to cart events (more frequent)
  for (let i = 0; i < 80; i++) {
    const sessionId = sessionIds[Math.floor(Math.random() * sessionIds.length)];
    const createdAt = subDays(new Date(), Math.floor(Math.random() * 30));

    const event = await prisma.websiteEvent.create({
      data: {
        id: randomUUID(),
        websiteId: WEBSITE_ID,
        sessionId: sessionId,
        visitId: sessionId,
        urlPath: '/product',
        eventName: 'add_to_cart',
        eventType: 2, // Custom event
        createdAt: createdAt,
      },
    });
    events.push(event);
  }

  // Checkout success events (less frequent - conversion)
  for (let i = 0; i < 35; i++) {
    const sessionId = sessionIds[Math.floor(Math.random() * sessionIds.length)];
    const createdAt = subDays(new Date(), Math.floor(Math.random() * 30));

    const event = await prisma.websiteEvent.create({
      data: {
        id: randomUUID(),
        websiteId: WEBSITE_ID,
        sessionId: sessionId,
        visitId: sessionId,
        urlPath: '/checkout',
        eventName: 'checkout_success',
        eventType: 2, // Custom event
        createdAt: createdAt,
      },
    });
    events.push(event);
  }

  // Some failed checkouts
  for (let i = 0; i < 15; i++) {
    const sessionId = sessionIds[Math.floor(Math.random() * sessionIds.length)];
    const createdAt = subDays(new Date(), Math.floor(Math.random() * 30));

    const event = await prisma.websiteEvent.create({
      data: {
        id: randomUUID(),
        websiteId: WEBSITE_ID,
        sessionId: sessionId,
        visitId: sessionId,
        urlPath: '/checkout',
        eventName: 'checkout_failed',
        eventType: 2, // Custom event
        createdAt: createdAt,
      },
    });
    events.push(event);
  }

  console.log(`Created ${events.length} events`);
  console.log(`- ${events.filter(e => e.eventName === 'add_to_cart').length} add_to_cart events`);
  console.log(
    `- ${events.filter(e => e.eventName === 'checkout_success').length} checkout_success events`,
  );
  console.log(
    `- ${events.filter(e => e.eventName === 'checkout_failed').length} checkout_failed events`,
  );

  return { user, website, sessions, events };
}

async function main() {
  try {
    console.log('Starting event comparison seed data generation...');

    // Skip clearing since database is already clean
    // await clearExistingData();
    await createTestData();

    console.log('Event comparison seed data generated successfully!');
    console.log('Expected conversion rate: ~43.75% (35/80)');
  } catch (error) {
    console.error('Error generating seed data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
