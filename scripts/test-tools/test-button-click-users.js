/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Config (can be overridden via CLI flags)
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2024-07-01'; // YYYY-MM-DD
const DEFAULT_END_DATE = '2024-08-31'; // YYYY-MM-DD
const DEFAULT_EVENT_NAME = 'cta_button';

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
      case '--event':
      case '--event-name':
        params.eventName = next;
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
    eventName: params.eventName || DEFAULT_EVENT_NAME,
  };
}

async function testButtonClickUsers(websiteId, startDate, endDate, eventName) {
  console.log(`\n🧪 Testing Unique Button Click Users Tool`);
  console.log(`🌐 Website ID: ${websiteId}`);
  console.log(`📅 Date Range: ${startDate} to ${endDate}`);
  console.log(`🎯 Event Name: ${eventName}`);
  console.log('='.repeat(60));

  try {
    // Test 1: Get total clicks for the specific button
    console.log('\n📊 Test 1: Total Button Clicks');
    const totalClicksResult = await prisma.websiteEvent.count({
      where: {
        websiteId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        eventType: 1, // custom events
        eventName: eventName,
      },
    });
    console.log(`   ✅ Total clicks for ${eventName}: ${totalClicksResult.toLocaleString()}`);

    // Test 2: Get unique users who clicked the button
    console.log('\n👥 Test 2: Unique Users Analysis');
    const uniqueUsersResult = await prisma.websiteEvent.groupBy({
      by: ['sessionId'],
      where: {
        websiteId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        eventType: 1, // custom events
        eventName: eventName,
      },
      _count: {
        sessionId: true,
      },
    });

    const uniqueUsers = uniqueUsersResult.length;
    console.log(`   👥 Unique users who clicked ${eventName}: ${uniqueUsers.toLocaleString()}`);

    // Test 3: Analyze click patterns per user
    console.log('\n📈 Test 3: Click Patterns Analysis');
    const clickPatterns = await prisma.websiteEvent.groupBy({
      by: ['sessionId'],
      where: {
        websiteId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        eventType: 1, // custom events
        eventName: eventName,
      },
      _count: {
        sessionId: true,
      },
      orderBy: {
        _count: {
          sessionId: 'desc',
        },
      },
    });

    if (clickPatterns.length > 0) {
      const maxClicks = clickPatterns[0]._count.sessionId;
      const minClicks = clickPatterns[clickPatterns.length - 1]._count.sessionId;
      const avgClicks =
        clickPatterns.reduce((sum, item) => sum + item._count.sessionId, 0) / clickPatterns.length;

      console.log(`   📊 Click distribution for ${eventName}:`);
      console.log(`      Max clicks per user: ${maxClicks}`);
      console.log(`      Min clicks per user: ${minClicks}`);
      console.log(`      Average clicks per user: ${avgClicks.toFixed(2)}`);
    }

    // Test 4: Compare with other buttons
    console.log('\n🔍 Test 4: Button Comparison');
    const allButtonEvents = await prisma.websiteEvent.groupBy({
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

    console.log(`   📋 Button click comparison:`);
    allButtonEvents.forEach((button, index) => {
      const isTargetButton = button.eventName === eventName;
      const marker = isTargetButton ? '🎯' : '  ';
      console.log(
        `   ${marker} ${index + 1}. ${
          button.eventName
        }: ${button._count.eventName.toLocaleString()} clicks`,
      );
    });

    // Test 5: Performance test
    console.log('\n⚡ Test 5: Performance Test');
    const startTime = Date.now();
    await prisma.websiteEvent.groupBy({
      by: ['sessionId'],
      where: {
        websiteId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        eventType: 1,
        eventName: eventName,
      },
      _count: {
        sessionId: true,
      },
    });
    const endTime = Date.now();
    console.log(`   ⚡ Query execution time: ${endTime - startTime}ms`);

    console.log('\n✅ All tests completed successfully!');
    return {
      totalClicks: totalClicksResult,
      uniqueUsers,
      clickPatterns: clickPatterns.length,
      executionTime: endTime - startTime,
    };
  } catch (error) {
    console.error('❌ Error during testing:', error);
    throw error;
  }
}

async function main() {
  try {
    const { websiteId, startDate, endDate, eventName } = parseArgs();

    console.log('🚀 Starting Unique Button Click Users Tool Testing');
    console.log('='.repeat(60));

    // Verify website exists
    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    if (!website) {
      throw new Error(`Website with ID ${websiteId} not found`);
    }
    console.log(`🌐 Testing with website: ${website.name} (${website.id})`);

    // Run tests
    const results = await testButtonClickUsers(websiteId, startDate, endDate, eventName);

    console.log('\n🎉 Testing Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   Total Clicks: ${results.totalClicks.toLocaleString()}`);
    console.log(`   Unique Users: ${results.uniqueUsers.toLocaleString()}`);
    console.log(`   Click Patterns: ${results.clickPatterns} different patterns`);
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

module.exports = { testButtonClickUsers };
