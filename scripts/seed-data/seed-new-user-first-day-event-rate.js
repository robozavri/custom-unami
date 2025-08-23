/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2025-07-01';
const DEFAULT_END_DATE = '2025-08-31';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const n = args[i + 1];
    switch (a) {
      case '--websiteId':
        out.websiteId = n;
        i++;
        break;
      case '--from':
        out.startDate = n;
        i++;
        break;
      case '--to':
        out.endDate = n;
        i++;
        break;
      case '--reset-range':
        out.resetRange = true;
        break;
      case '--event-name':
        out.eventName = n;
        i++;
        break;
      default:
        break;
    }
  }
  return {
    websiteId: out.websiteId || DEFAULT_WEBSITE_ID,
    startDate: out.startDate || DEFAULT_START_DATE,
    endDate: out.endDate || DEFAULT_END_DATE,
    resetRange: !!out.resetRange,
    eventName: out.eventName || 'Start Free Trial',
  };
}

function addDays(d, days) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function pickInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function clearRange(websiteId, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T23:59:59Z');
  await prisma.eventData.deleteMany({ where: { websiteId, createdAt: { gte: start, lte: end } } });
  await prisma.websiteEvent.deleteMany({
    where: { websiteId, createdAt: { gte: start, lte: end } },
  });
}

async function seed(websiteId, startDate, endDate, eventName) {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

  console.log(`Seeding new-user first-day event rate for ${days} days`);

  const batch = [];
  for (let d = 0; d < days; d++) {
    const day = addDays(start, d);
    const sessions = 200;

    for (let s = 0; s < sessions; s++) {
      const sessionId = randomUUID();
      const base = new Date(day);
      base.setUTCHours(pickInt(0, 23), pickInt(0, 59), pickInt(0, 59));

      // first event for session
      batch.push({
        id: randomUUID(),
        websiteId,
        sessionId,
        visitId: sessionId,
        eventType: 1,
        eventName: 'page_view',
        urlPath: '/',
        createdAt: base,
        pageTitle: 'Home',
        referrerDomain: null,
        utmSource: null,
      });

      // 60% sessions perform a specific custom event on the same day
      if (Math.random() < 0.6) {
        const t = new Date(base.getTime() + pickInt(1, 30) * 60 * 1000);
        batch.push({
          id: randomUUID(),
          websiteId,
          sessionId,
          visitId: sessionId,
          eventType: 2,
          eventName,
          urlPath: '/action',
          createdAt: t,
          pageTitle: null,
          referrerDomain: null,
          utmSource: null,
        });
      } else {
        // some sessions do a custom event next day (should NOT count)
        const t = new Date(base.getTime() + 24 * 60 * 60 * 1000 + pickInt(1, 60) * 60 * 1000);
        batch.push({
          id: randomUUID(),
          websiteId,
          sessionId,
          visitId: sessionId,
          eventType: 2,
          eventName,
          urlPath: '/action-late',
          createdAt: t,
          pageTitle: null,
          referrerDomain: null,
          utmSource: null,
        });
      }

      if (batch.length >= 2000) {
        await prisma.websiteEvent.createMany({ data: batch });
        batch.length = 0;
      }
    }
  }

  if (batch.length) {
    await prisma.websiteEvent.createMany({ data: batch });
  }
}

async function main() {
  const { websiteId, startDate, endDate, resetRange, eventName } = parseArgs();
  console.log('=== Seed: New User First-Day Event Rate ===');
  console.log({ websiteId, startDate, endDate, resetRange, eventName });

  if (resetRange) {
    await clearRange(websiteId, startDate, endDate);
  }

  await seed(websiteId, startDate, endDate, eventName);
  console.log('✅ Seeding complete');
}

if (require.main === module) {
  main().finally(() => prisma.$disconnect());
}

module.exports = { seed };
