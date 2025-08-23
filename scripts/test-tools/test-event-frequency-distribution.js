/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Test configuration
const TEST_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const TEST_START_DATE = '2024-07-01';
const TEST_END_DATE = '2024-08-31';

async function testEventFrequencyDistribution() {
  console.log('=== Testing Event Frequency Distribution Tool ===\n');

  try {
    // Test 1: Get distribution for all events
    console.log('Test 1: Event frequency distribution for ALL events');
    console.log('------------------------------------------------');

    const allEventsResult = await getEventFrequencyDistributionAllEvents();
    console.log('Results:');
    console.log(`- Users with one event: ${allEventsResult.usersWithOneEvent}`);
    console.log(`- Users with multiple events: ${allEventsResult.usersWithMultipleEvents}`);
    console.log(`- Total unique users: ${allEventsResult.totalUniqueUsers}`);
    console.log(
      `- Percentage one event: ${(
        (allEventsResult.usersWithOneEvent / allEventsResult.totalUniqueUsers) *
        100
      ).toFixed(1)}%`,
    );
    console.log(
      `- Percentage multiple events: ${(
        (allEventsResult.usersWithMultipleEvents / allEventsResult.totalUniqueUsers) *
        100
      ).toFixed(1)}%`,
    );
    console.log('');

    // Test 2: Get distribution for specific event
    console.log('Test 2: Event frequency distribution for specific event (button_click)');
    console.log('-------------------------------------------------------------------');

    const buttonClickResult = await getEventFrequencyDistributionForEvent('button_click');
    console.log('Results:');
    console.log(`- Users with one button_click: ${buttonClickResult.usersWithOneEvent}`);
    console.log(
      `- Users with multiple button_clicks: ${buttonClickResult.usersWithMultipleEvents}`,
    );
    console.log(`- Total unique users: ${buttonClickResult.totalUniqueUsers}`);
    if (buttonClickResult.totalUniqueUsers > 0) {
      console.log(
        `- Percentage one event: ${(
          (buttonClickResult.usersWithOneEvent / buttonClickResult.totalUniqueUsers) *
          100
        ).toFixed(1)}%`,
      );
      console.log(
        `- Percentage multiple events: ${(
          (buttonClickResult.usersWithMultipleEvents / buttonClickResult.totalUniqueUsers) *
          100
        ).toFixed(1)}%`,
      );
    }
    console.log('');

    // Test 3: Get distribution for another specific event
    console.log('Test 3: Event frequency distribution for specific event (form_submit)');
    console.log('-------------------------------------------------------------------');

    const formSubmitResult = await getEventFrequencyDistributionForEvent('form_submit');
    console.log('Results:');
    console.log(`- Users with one form_submit: ${formSubmitResult.usersWithOneEvent}`);
    console.log(`- Users with multiple form_submits: ${formSubmitResult.usersWithMultipleEvents}`);
    console.log(`- Total unique users: ${formSubmitResult.totalUniqueUsers}`);
    if (formSubmitResult.totalUniqueUsers > 0) {
      console.log(
        `- Percentage one event: ${(
          (formSubmitResult.usersWithOneEvent / formSubmitResult.totalUniqueUsers) *
          100
        ).toFixed(1)}%`,
      );
      console.log(
        `- Percentage multiple events: ${(
          (formSubmitResult.usersWithMultipleEvents / formSubmitResult.totalUniqueUsers) *
          100
        ).toFixed(1)}%`,
      );
    }
    console.log('');

    // Test 4: Get detailed breakdown
    console.log('Test 4: Detailed event frequency breakdown');
    console.log('------------------------------------------');

    const detailedResult = await getDetailedEventFrequencyBreakdown();
    console.log('Detailed breakdown:');
    detailedResult.forEach(row => {
      console.log(`- ${row.event_count} event(s): ${row.user_count} users`);
    });
    console.log('');

    // Test 5: Compare different time periods
    console.log('Test 5: Compare different time periods');
    console.log('--------------------------------------');

    const period1Result = await getEventFrequencyDistributionForPeriod('2024-07-01', '2024-07-15');
    const period2Result = await getEventFrequencyDistributionForPeriod('2024-08-01', '2024-08-15');

    console.log('Period 1 (July 1-15):');
    console.log(`- Users with one event: ${period1Result.usersWithOneEvent}`);
    console.log(`- Users with multiple events: ${period1Result.usersWithMultipleEvents}`);
    console.log(`- Total: ${period1Result.totalUniqueUsers}`);

    console.log('Period 2 (August 1-15):');
    console.log(`- Users with one event: ${period2Result.usersWithOneEvent}`);
    console.log(`- Users with multiple events: ${period2Result.usersWithMultipleEvents}`);
    console.log(`- Total: ${period2Result.totalUniqueUsers}`);
    console.log('');

    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function getEventFrequencyDistributionAllEvents() {
  const startDate = new Date(TEST_START_DATE + 'T00:00:00Z');
  const endDate = new Date(TEST_END_DATE + 'T23:59:59Z');

  // Get event frequency distribution per user for all events
  const distributionResult = await prisma.$queryRaw`
    SELECT 
      event_count,
      COUNT(DISTINCT session_id) as user_count
    FROM (
      SELECT 
        session_id,
        COUNT(*) as event_count
      FROM website_event
      WHERE website_id = ${TEST_WEBSITE_ID}::uuid
        AND created_at BETWEEN ${startDate} AND ${endDate}
      GROUP BY session_id
    ) user_event_counts
    GROUP BY event_count
    ORDER BY event_count
  `;

  // Get total unique users
  const totalUsersResult = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT session_id) as total_users
    FROM website_event
    WHERE website_id = ${TEST_WEBSITE_ID}::uuid
      AND created_at BETWEEN ${startDate} AND ${endDate}
  `;

  const totalUniqueUsers = Number(totalUsersResult[0]?.total_users || 0);

  // Process distribution results
  let usersWithOneEvent = 0;
  let usersWithMultipleEvents = 0;

  for (const row of distributionResult) {
    const eventCount = Number(row.event_count);
    const userCount = Number(row.user_count);

    if (eventCount === 1) {
      usersWithOneEvent = userCount;
    } else {
      usersWithMultipleEvents += userCount;
    }
  }

  return {
    usersWithOneEvent,
    usersWithMultipleEvents,
    totalUniqueUsers,
  };
}

async function getEventFrequencyDistributionForEvent(eventName) {
  const startDate = new Date(TEST_START_DATE + 'T00:00:00Z');
  const endDate = new Date(TEST_END_DATE + 'T23:59:59Z');

  // Get event frequency distribution per user for specific event
  const distributionResult = await prisma.$queryRaw`
    SELECT 
      event_count,
      COUNT(DISTINCT session_id) as user_count
    FROM (
      SELECT 
        session_id,
        COUNT(*) as event_count
      FROM website_event
      WHERE website_id = ${TEST_WEBSITE_ID}::uuid
        AND created_at BETWEEN ${startDate} AND ${endDate}
        AND event_type = 2
        AND event_name = ${eventName}
      GROUP BY session_id
    ) user_event_counts
    GROUP BY event_count
    ORDER BY event_count
  `;

  // Get total unique users for this event
  const totalUsersResult = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT session_id) as total_users
    FROM website_event
    WHERE website_id = ${TEST_WEBSITE_ID}::uuid
      AND created_at BETWEEN ${startDate} AND ${endDate}
      AND event_type = 2
      AND event_name = ${eventName}
  `;

  const totalUniqueUsers = Number(totalUsersResult[0]?.total_users || 0);

  // Process distribution results
  let usersWithOneEvent = 0;
  let usersWithMultipleEvents = 0;

  for (const row of distributionResult) {
    const eventCount = Number(row.event_count);
    const userCount = Number(row.user_count);

    if (eventCount === 1) {
      usersWithOneEvent = userCount;
    } else {
      usersWithMultipleEvents += userCount;
    }
  }

  return {
    usersWithOneEvent,
    usersWithMultipleEvents,
    totalUniqueUsers,
  };
}

async function getDetailedEventFrequencyBreakdown() {
  const startDate = new Date(TEST_START_DATE + 'T00:00:00Z');
  const endDate = new Date(TEST_END_DATE + 'T23:59:59Z');

  const result = await prisma.$queryRaw`
    SELECT 
      event_count,
      COUNT(DISTINCT session_id) as user_count
    FROM (
      SELECT 
        session_id,
        COUNT(*) as event_count
      FROM website_event
      WHERE website_id = ${TEST_WEBSITE_ID}::uuid
        AND created_at BETWEEN ${startDate} AND ${endDate}
        AND event_type = 2
      GROUP BY session_id
    ) user_event_counts
    GROUP BY event_count
    ORDER BY event_count
  `;

  return result.map(row => ({
    event_count: Number(row.event_count),
    user_count: Number(row.user_count),
  }));
}

async function getEventFrequencyDistributionForPeriod(startDateStr, endDateStr) {
  const startDate = new Date(startDateStr + 'T00:00:00Z');
  const endDate = new Date(endDateStr + 'T23:59:59Z');

  // Get event frequency distribution per user for the period
  const distributionResult = await prisma.$queryRaw`
    SELECT 
      event_count,
      COUNT(DISTINCT session_id) as user_count
    FROM (
      SELECT 
        session_id,
        COUNT(*) as event_count
      FROM website_event
      WHERE website_id = ${TEST_WEBSITE_ID}::uuid
        AND created_at BETWEEN ${startDate} AND ${endDate}
        AND event_type = 2
      GROUP BY session_id
    ) user_event_counts
    GROUP BY event_count
    ORDER BY event_count
  `;

  // Get total unique users for the period
  const totalUsersResult = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT session_id) as total_users
    FROM website_event
    WHERE website_id = ${TEST_WEBSITE_ID}::uuid
      AND created_at BETWEEN ${startDate} AND ${endDate}
      AND event_type = 2
  `;

  const totalUniqueUsers = Number(totalUsersResult[0]?.total_users || 0);

  // Process distribution results
  let usersWithOneEvent = 0;
  let usersWithMultipleEvents = 0;

  for (const row of distributionResult) {
    const eventCount = Number(row.event_count);
    const userCount = Number(row.user_count);

    if (eventCount === 1) {
      usersWithOneEvent = userCount;
    } else {
      usersWithMultipleEvents += userCount;
    }
  }

  return {
    usersWithOneEvent,
    usersWithMultipleEvents,
    totalUniqueUsers,
  };
}

if (require.main === module) {
  testEventFrequencyDistribution();
}

module.exports = {
  testEventFrequencyDistribution,
  getEventFrequencyDistributionAllEvents,
  getEventFrequencyDistributionForEvent,
  getDetailedEventFrequencyBreakdown,
  getEventFrequencyDistributionForPeriod,
};
