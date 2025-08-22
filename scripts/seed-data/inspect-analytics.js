/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const n = args[i + 1];
    switch (a) {
      case '--from':
        params.from = n;
        i++;
        break;
      case '--to':
        params.to = n;
        i++;
        break;
      default:
        break;
    }
  }
  return {
    from: params.from || '2024-07-01',
    to: params.to || '2024-09-01',
  };
}

async function main() {
  const { from, to } = parseArgs();
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);

  const websites = await prisma.website.findMany({
    select: { id: true, name: true, domain: true, userId: true, teamId: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`[inspect] websites (${websites.length})`);
  for (const w of websites) {
    const [sessions, events, pageviews, customEvents] = await Promise.all([
      prisma.session.count({ where: { websiteId: w.id, createdAt: { gte: start, lt: end } } }),
      prisma.websiteEvent.count({ where: { websiteId: w.id, createdAt: { gte: start, lt: end } } }),
      prisma.websiteEvent.count({
        where: { websiteId: w.id, eventType: 1, createdAt: { gte: start, lt: end } },
      }),
      prisma.websiteEvent.count({
        where: { websiteId: w.id, eventType: 2, createdAt: { gte: start, lt: end } },
      }),
    ]);
    console.log({
      id: w.id,
      name: w.name,
      domain: w.domain,
      userId: w.userId,
      teamId: w.teamId,
      sessions,
      events,
      pageviews,
      customEvents,
    });
  }

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
