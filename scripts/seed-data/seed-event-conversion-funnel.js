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
      case '--website':
      case '--websiteId':
        out.websiteId = n;
        i++;
        break;
      case '--from':
      case '--start':
        out.startDate = n;
        i++;
        break;
      case '--to':
      case '--end':
        out.endDate = n;
        i++;
        break;
      case '--event-x':
        out.eventX = n;
        i++;
        break;
      case '--event-y':
        out.eventY = n;
        i++;
        break;
      case '--sessions-per-day':
        out.sessionsPerDay = Number(n);
        i++;
        break;
      case '--start-rate':
        out.startRate = Number(n);
        i++;
        break;
      case '--conv-rate':
        out.convRate = Number(n);
        i++;
        break;
      case '--reset-range':
        out.resetRange = true;
        break;
      default:
        break;
    }
  }
  return {
    websiteId: out.websiteId || DEFAULT_WEBSITE_ID,
    startDate: out.startDate || DEFAULT_START_DATE,
    endDate: out.endDate || DEFAULT_END_DATE,
    eventX: out.eventX || 'Start Free Trial',
    eventY: out.eventY || 'Purchase',
    sessionsPerDay: out.sessionsPerDay || 200,
    startRate: out.startRate ?? 0.5,
    convRate: out.convRate ?? 0.4,
    resetRange: !!out.resetRange,
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

  await prisma.eventData.deleteMany({
    where: {
      websiteId,
      createdAt: { gte: start, lte: end },
    },
  });
  await prisma.websiteEvent.deleteMany({
    where: {
      websiteId,
      createdAt: { gte: start, lte: end },
    },
  });
}

async function seed(
  websiteId,
  startDate,
  endDate,
  eventX,
  eventY,
  sessionsPerDay,
  startRate,
  convRate,
) {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

  console.log(
    `Seeding conversion funnel for ${days} days, ${sessionsPerDay}/day, startRate=${startRate}, convRate=${convRate}`,
  );

  const batch = [];
  for (let d = 0; d < days; d++) {
    const day = addDays(start, d);

    for (let s = 0; s < sessionsPerDay; s++) {
      const sessionId = randomUUID();
      const base = new Date(day);
      base.setUTCHours(pickInt(0, 23), pickInt(0, 59), pickInt(0, 59));

      // Always at least 1 page_view
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

      if (Math.random() < startRate) {
        const xTime = new Date(base.getTime() + pickInt(1, 5) * 60 * 1000);
        batch.push({
          id: randomUUID(),
          websiteId,
          sessionId,
          visitId: sessionId,
          eventType: 2,
          eventName: eventX,
          urlPath: '/action',
          createdAt: xTime,
          pageTitle: null,
          referrerDomain: null,
          utmSource: null,
        });

        if (Math.random() < convRate) {
          const yTime = new Date(xTime.getTime() + pickInt(1, 10) * 60 * 1000);
          batch.push({
            id: randomUUID(),
            websiteId,
            sessionId,
            visitId: sessionId,
            eventType: 2,
            eventName: eventY,
            urlPath: '/complete',
            createdAt: yTime,
            pageTitle: null,
            referrerDomain: null,
            utmSource: null,
          });
        }
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
  const {
    websiteId,
    startDate,
    endDate,
    eventX,
    eventY,
    sessionsPerDay,
    startRate,
    convRate,
    resetRange,
  } = parseArgs();

  console.log('=== Seed: Event Conversion Funnel ===');
  console.log({
    websiteId,
    startDate,
    endDate,
    eventX,
    eventY,
    sessionsPerDay,
    startRate,
    convRate,
    resetRange,
  });

  if (resetRange) {
    await clearRange(websiteId, startDate, endDate);
  }

  await seed(websiteId, startDate, endDate, eventX, eventY, sessionsPerDay, startRate, convRate);

  console.log('✅ Seeding complete');
}

if (require.main === module) {
  main().finally(() => prisma.$disconnect());
}

module.exports = { seed };
