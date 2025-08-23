/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Test configuration
const TEST_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const TEST_START_DATE = '2025-07-01';
const TEST_END_DATE = '2025-08-31';

// Global date variables for helper functions
const startDate = new Date(TEST_START_DATE);
const endDate = new Date(TEST_END_DATE);

async function testAverageEventsPerSession() {
  console.log('=== Testing Average Events Per Session Tool ===\n');

  try {
    // Test 1: Get average events per session for ALL events
    console.log('Test 1: Average events per session for ALL events');
    console.log('------------------------------------------------');

    const allEventsResult = await getAverageEventsPerSessionAllEvents();
    console.log('Results:');
    console.log(
      `- Average events per session: ${allEventsResult.averageEventsPerSession.toFixed(2)}`,
    );
    console.log(`- Total sessions: ${allEventsResult.totalSessions}`);
    console.log(`- Total events: ${allEventsResult.totalEvents}`);
    console.log('');

    // Test 2: Get average events per session for specific event
    console.log('Test 2: Average events per session for "Start Free Trial"');
    console.log('--------------------------------------------------------');

    const specificEventResult = await getAverageEventsPerSessionSpecificEvent('Start Free Trial');
    console.log('Results:');
    console.log(
      `- Average "Start Free Trial" events per session: ${specificEventResult.averageEventsPerSession.toFixed(
        2,
      )}`,
    );
    console.log(`- Total sessions with "Start Free Trial": ${specificEventResult.totalSessions}`);
    console.log(`- Total "Start Free Trial" events: ${specificEventResult.totalEvents}`);
    console.log('');

    // Test 3: Get average events per session for another event
    console.log('Test 3: Average events per session for "Purchase"');
    console.log('------------------------------------------------');

    const purchaseResult = await getAverageEventsPerSessionSpecificEvent('Purchase');
    console.log('Results:');
    console.log(
      `- Average "Purchase" events per session: ${purchaseResult.averageEventsPerSession.toFixed(
        2,
      )}`,
    );
    console.log(`- Total sessions with "Purchase": ${specificEventResult.totalSessions}`);
    console.log(`- Total "Purchase" events: ${purchaseResult.totalEvents}`);
    console.log('');

    // Test 4: Detailed breakdown
    console.log('Test 4: Detailed breakdown for all events');
    console.log('------------------------------------------');

    const breakdown = await getDetailedBreakdown();
    console.log('Events per session breakdown:');
    breakdown.forEach(item => {
      console.log(
        `- ${item.eventCount} events: ${item.sessionCount} sessions (${item.percentage.toFixed(
          1,
        )}%)`,
      );
    });

    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Error testing average events per session:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function getAverageEventsPerSessionAllEvents() {
  // Get total events and sessions
  const totalResult = await prisma.$queryRaw`
    SELECT 
      COUNT(*) as total_events,
      COUNT(DISTINCT session_id) as total_sessions
    FROM website_event
    WHERE website_id = ${TEST_WEBSITE_ID}::uuid
      AND created_at BETWEEN ${startDate} AND ${endDate}
  `;

  const totalEvents = Number(totalResult[0]?.total_events || 0);
  const totalSessions = Number(totalResult[0]?.total_sessions || 0);
  const averageEventsPerSession = totalSessions > 0 ? totalEvents / totalSessions : 0;

  return {
    averageEventsPerSession,
    totalSessions,
    totalEvents,
  };
}

async function getAverageEventsPerSessionSpecificEvent(eventName) {
  // Get total events and sessions for specific event
  const totalResult = await prisma.$queryRaw`
    SELECT 
      COUNT(*) as total_events,
      COUNT(DISTINCT session_id) as total_sessions
    FROM website_event
    WHERE website_id = ${TEST_WEBSITE_ID}::uuid
      AND created_at BETWEEN ${startDate} AND ${endDate}
      AND event_name = ${eventName}
  `;

  const totalEvents = Number(totalResult[0]?.total_events || 0);
  const totalSessions = Number(totalResult[0]?.total_sessions || 0);
  const averageEventsPerSession = totalSessions > 0 ? totalEvents / totalSessions : 0;

  return {
    averageEventsPerSession,
    totalSessions,
    totalEvents,
  };
}

async function getDetailedBreakdown() {
  // Get breakdown of events per session
  const breakdownResult = await prisma.$queryRaw`
    SELECT 
      event_count,
      COUNT(DISTINCT session_id) as session_count
    FROM (
      SELECT 
        session_id,
        COUNT(*) as event_count
      FROM website_event
      WHERE website_id = ${TEST_WEBSITE_ID}::uuid
        AND created_at BETWEEN ${startDate} AND ${endDate}
      GROUP BY session_id
    ) session_event_counts
    GROUP BY event_count
    ORDER BY event_count
  `;

  const totalSessions = breakdownResult.reduce((sum, row) => sum + Number(row.session_count), 0);

  return breakdownResult.map(row => ({
    eventCount: Number(row.event_count),
    sessionCount: Number(row.session_count),
    percentage: totalSessions > 0 ? (Number(row.session_count) / totalSessions) * 100 : 0,
  }));
}

// Run the test
testAverageEventsPerSession();
