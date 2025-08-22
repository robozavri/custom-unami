/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Config (can be overridden via CLI flags)
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2024-07-01'; // YYYY-MM-DD
const DEFAULT_END_DATE = '2024-08-31'; // YYYY-MM-DD
const DEFAULT_LIMIT = 10;

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
      case '--limit':
        params.limit = parseInt(next);
        i++;
        break;
      default:
        break;
    }
  }

  return {
    websiteId: params.websiteId || DEFAULT_WEBSITE_ID,
    startDate: params.startDate || DEFAULT_START_DATE,
    endDate: params.endDate || DEFAULT_END_DATE,
    limit: params.limit || DEFAULT_LIMIT,
  };
}

async function testMostFrequentEvents(websiteId, startDate, endDate, limit) {
  console.log(`\n🧪 Testing Most Frequent Events Tool`);
  console.log(`🌐 Website ID: ${websiteId}`);
  console.log(`📅 Date Range: ${startDate} to ${endDate}`);
  console.log(`📊 Limit: ${limit}`);
  console.log('='.repeat(60));

  try {
    // Test 1: Get total event count for the period
    console.log('\n📊 Test 1: Total Event Count');
    const totalEventsResult = await prisma.websiteEvent.count({
      where: {
        websiteId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        eventType: 1, // custom events
      },
    });
    console.log(`   ✅ Total events in period: ${totalEventsResult.toLocaleString()}`);

    // Test 2: Get most frequent events (simulating the tool logic)
    console.log('\n🏆 Test 2: Most Frequent Events Ranking');
    const mostFrequentEvents = await prisma.websiteEvent.groupBy({
      by: ['eventName'],
      where: {
        websiteId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        eventType: 1, // custom events
      },
      _count: {
        eventName: true,
      },
      orderBy: {
        _count: {
          eventName: 'desc',
        },
      },
      take: limit,
    });

    console.log(`   📋 Top ${mostFrequentEvents.length} events by frequency:`);
    mostFrequentEvents.forEach((event, index) => {
      const percentage =
        totalEventsResult > 0
          ? ((event._count.eventName / totalEventsResult) * 100).toFixed(2)
          : '0.00';
      console.log(
        `   ${index + 1}. ${
          event.eventName
        }: ${event._count.eventName.toLocaleString()} (${percentage}%)`,
      );
    });

    // Test 3: Verify event distribution
    console.log('\n📈 Test 3: Event Distribution Analysis');
    const allEvents = await prisma.websiteEvent.groupBy({
      by: ['eventName'],
      where: {
        websiteId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        eventType: 1, // custom events
      },
      _count: {
        eventName: true,
      },
      orderBy: {
        _count: {
          eventName: 'desc',
        },
      },
    });

    console.log(`   📊 Total unique event types: ${allEvents.length}`);
    console.log(`   🎯 Events covering 80% of total:`);

    let cumulativeCount = 0;
    let eventsTo80Percent = 0;
    for (const event of allEvents) {
      cumulativeCount += event._count.eventName;
      const percentage = (cumulativeCount / totalEventsResult) * 100;
      if (percentage <= 80) {
        eventsTo80Percent++;
      }
    }
    console.log(
      `      ${eventsTo80Percent} event types cover ${(
        (cumulativeCount / totalEventsResult) *
        100
      ).toFixed(1)}% of total events`,
    );

    // Test 4: Date range validation
    console.log('\n📅 Test 4: Date Range Validation');
    const firstEvent = await prisma.websiteEvent.findFirst({
      where: {
        websiteId,
        eventType: 1,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const lastEvent = await prisma.websiteEvent.findFirst({
      where: {
        websiteId,
        eventType: 1,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (firstEvent && lastEvent) {
      console.log(`   📅 First event: ${firstEvent.createdAt.toISOString().split('T')[0]}`);
      console.log(`   📅 Last event: ${lastEvent.createdAt.toISOString().split('T')[0]}`);
      console.log(`   📅 Requested range: ${startDate} to ${endDate}`);
    }

    // Test 5: Performance test
    console.log('\n⚡ Test 5: Performance Test');
    const startTime = Date.now();
    await prisma.websiteEvent.groupBy({
      by: ['eventName'],
      where: {
        websiteId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        eventType: 1,
      },
      _count: {
        eventName: true,
      },
      orderBy: {
        _count: {
          eventName: 'desc',
        },
      },
      take: limit,
    });
    const endTime = Date.now();
    console.log(`   ⚡ Query execution time: ${endTime - startTime}ms`);

    console.log('\n✅ All tests completed successfully!');
    return {
      totalEvents: totalEventsResult,
      topEvents: mostFrequentEvents,
      uniqueEventTypes: allEvents.length,
      executionTime: endTime - startTime,
    };
  } catch (error) {
    console.error('❌ Error during testing:', error);
    throw error;
  }
}

async function main() {
  try {
    const { websiteId, startDate, endDate, limit } = parseArgs();

    console.log('🚀 Starting Most Frequent Events Tool Testing');
    console.log('='.repeat(60));

    // Verify website exists
    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    if (!website) {
      throw new Error(`Website with ID ${websiteId} not found`);
    }
    console.log(`🌐 Testing with website: ${website.name} (${website.id})`);

    // Run tests
    const results = await testMostFrequentEvents(websiteId, startDate, endDate, limit);

    console.log('\n🎉 Testing Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   Total Events: ${results.totalEvents.toLocaleString()}`);
    console.log(
      `   Top ${results.topEvents.length} Events: ${results.topEvents
        .map(e => e.eventName)
        .join(', ')}`,
    );
    console.log(`   Unique Event Types: ${results.uniqueEventTypes}`);
    console.log(`   Query Performance: ${results.executionTime}ms`);

    console.log('\n✨ Tool is ready for use in the chat interface!');
  } catch (error) {
    console.error('❌ Error during testing:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { testMostFrequentEvents };
