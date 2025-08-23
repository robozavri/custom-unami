const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const { subDays } = require('date-fns');
/* eslint-disable no-console */

const prisma = new PrismaClient();

// Will be fetched from database
let WEBSITE_ID;
let USER_ID;

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

  for (let i = 0; i < 100; i++) {
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

  // Pageview events (visits) - more frequent
  for (let i = 0; i < 500; i++) {
    const sessionId = sessionIds[Math.floor(Math.random() * sessionIds.length)];
    const createdAt = subDays(new Date(), Math.floor(Math.random() * 30));

    const event = await prisma.websiteEvent.create({
      data: {
        id: randomUUID(),
        websiteId: WEBSITE_ID,
        sessionId: sessionId,
        visitId: sessionId,
        urlPath: '/home',
        eventType: 1, // Pageview
        createdAt: createdAt,
      },
    });
    events.push(event);
  }

  // Signup events (less frequent - conversion)
  for (let i = 0; i < 25; i++) {
    const sessionId = sessionIds[Math.floor(Math.random() * sessionIds.length)];
    const createdAt = subDays(new Date(), Math.floor(Math.random() * 30));

    const event = await prisma.websiteEvent.create({
      data: {
        id: randomUUID(),
        websiteId: WEBSITE_ID,
        sessionId: sessionId,
        visitId: sessionId,
        urlPath: '/signup',
        eventName: 'signup',
        eventType: 2, // Custom event
        createdAt: createdAt,
      },
    });
    events.push(event);
  }

  // Some additional pageviews for signup page
  for (let i = 0; i < 50; i++) {
    const sessionId = sessionIds[Math.floor(Math.random() * sessionIds.length)];
    const createdAt = subDays(new Date(), Math.floor(Math.random() * 30));

    const event = await prisma.websiteEvent.create({
      data: {
        id: randomUUID(),
        websiteId: WEBSITE_ID,
        sessionId: sessionId,
        visitId: sessionId,
        urlPath: '/signup',
        eventType: 1, // Pageview
        createdAt: createdAt,
      },
    });
    events.push(event);
  }

  console.log(`Created ${events.length} events`);
  console.log(`- ${events.filter(e => e.eventType === 1).length} pageview events (visits)`);
  console.log(
    `- ${events.filter(e => e.eventType === 2 && e.eventName === 'signup').length} signup events`,
  );

  return { user, website, sessions, events };
}

async function main() {
  try {
    console.log('Starting signup conversion rate seed data generation...');

    await createTestData();

    console.log('Signup conversion rate seed data generated successfully!');
    console.log('Expected conversion rate: ~4.55% (25/550 total pageviews)');
    console.log('Expected unique conversion rate: ~25% (25/100 unique visitors)');
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
