/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

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
      case '--all-websites':
        params.allWebsites = true;
        break;
      case '--confirm':
        params.confirm = true;
        break;
      default:
        break;
    }
  }

  return {
    websiteId: params.websiteId,
    allWebsites: !!params.allWebsites,
    confirm: !!params.confirm,
  };
}

async function countAnalyticsTables(where = undefined) {
  const [eventData, websiteEvents, sessionData, sessions] = await Promise.all([
    prisma.eventData.count({ where }),
    prisma.websiteEvent.count({ where }),
    prisma.sessionData.count({ where }),
    prisma.session.count({ where }),
  ]);

  return { eventData, websiteEvents, sessionData, sessions };
}

function printCounts(label, counts) {
  console.log(`\n[clear:analytics] ${label}`);
  console.log(`  event_data:     ${counts.eventData}`);
  console.log(`  website_event:  ${counts.websiteEvents}`);
  console.log(`  session_data:   ${counts.sessionData}`);
  console.log(`  session:        ${counts.sessions}`);
}

async function clearAnalyticsForWebsite(websiteId) {
  console.log(`[clear:analytics] clearing analytics for website: ${websiteId}`);

  // Order matters due to FKs: event_data -> website_event -> session_data -> session
  const deleted = { eventData: 0, websiteEvents: 0, sessionData: 0, sessions: 0 };

  const eventDataDeleted = await prisma.eventData.deleteMany({ where: { websiteId } });
  deleted.eventData += eventDataDeleted.count;

  const websiteEventsDeleted = await prisma.websiteEvent.deleteMany({ where: { websiteId } });
  deleted.websiteEvents += websiteEventsDeleted.count;

  const sessionDataDeleted = await prisma.sessionData.deleteMany({ where: { websiteId } });
  deleted.sessionData += sessionDataDeleted.count;

  const sessionsDeleted = await prisma.session.deleteMany({ where: { websiteId } });
  deleted.sessions += sessionsDeleted.count;

  return deleted;
}

async function clearAnalyticsForAllWebsites() {
  console.log('[clear:analytics] clearing analytics for ALL websites');

  const deleted = { eventData: 0, websiteEvents: 0, sessionData: 0, sessions: 0 };

  const eventDataDeleted = await prisma.eventData.deleteMany({});
  deleted.eventData += eventDataDeleted.count;

  const websiteEventsDeleted = await prisma.websiteEvent.deleteMany({});
  deleted.websiteEvents += websiteEventsDeleted.count;

  const sessionDataDeleted = await prisma.sessionData.deleteMany({});
  deleted.sessionData += sessionDataDeleted.count;

  const sessionsDeleted = await prisma.session.deleteMany({});
  deleted.sessions += sessionsDeleted.count;

  return deleted;
}

async function main() {
  const { websiteId, allWebsites, confirm } = parseArgs();

  console.log('[clear:analytics] configuration:', { websiteId, allWebsites, confirm });

  if (!confirm) {
    console.log('\nWARNING: This will DELETE analytics data from the following tables:');
    console.log('  - event_data');
    console.log('  - website_event');
    console.log('  - session_data');
    console.log('  - session');
    console.log('\nIt will NOT touch:');
    console.log('  - revenue (Revenue tracking)');
    console.log('  - segment (User segments)');
    console.log('  - report (Saved reports)');
    console.log('\nTo proceed, add --confirm. Examples:');
    console.log('  node scripts/test-data/clear-analytics-tables.js --all-websites --confirm');
    console.log(
      '  node scripts/test-data/clear-analytics-tables.js --website YOUR_WEBSITE_ID --confirm',
    );
    return;
  }

  if (!allWebsites && !websiteId) {
    console.log('\nPlease specify one of:');
    console.log('  --all-websites    Clear analytics for all websites');
    console.log('  --website ID      Clear analytics for a single website ID');
    return;
  }

  try {
    const beforeCounts = await countAnalyticsTables(allWebsites ? undefined : { websiteId });
    printCounts('before', beforeCounts);

    let deleted;
    if (allWebsites) {
      deleted = await clearAnalyticsForAllWebsites();
    } else {
      deleted = await clearAnalyticsForWebsite(websiteId);
    }

    console.log('\n[clear:analytics] deleted records:', deleted);

    const afterCounts = await countAnalyticsTables(allWebsites ? undefined : { websiteId });
    printCounts('after', afterCounts);

    console.log('\n✅ Analytics tables are now empty. (Revenue/Segment/Report left untouched)');
  } catch (error) {
    console.error('[clear:analytics] error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
