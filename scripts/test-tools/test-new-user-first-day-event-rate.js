/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

const TEST_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const TEST_START_DATE = '2025-07-01';
const TEST_END_DATE = '2025-08-31';
const EVENT_NAME = 'Start Free Trial';

const startDate = new Date(TEST_START_DATE);
const endDate = new Date(TEST_END_DATE);

async function main() {
  console.log('=== Testing New User First-Day Event Rate ===\n');

  try {
    const totalRows = await prisma.$queryRaw`
      WITH firsts AS (
        SELECT session_id, MIN(created_at) AS first_time
        FROM website_event
        WHERE website_id = ${TEST_WEBSITE_ID}::uuid
          AND created_at BETWEEN ${startDate} AND ${endDate}
        GROUP BY session_id
      )
      SELECT COUNT(*) AS total_sessions FROM firsts
    `;

    const totalSessions = Number(totalRows[0]?.total_sessions || 0);

    const sessionsWithRows = await prisma.$queryRaw`
      WITH firsts AS (
        SELECT session_id, MIN(created_at) AS first_time
        FROM website_event
        WHERE website_id = ${TEST_WEBSITE_ID}::uuid
          AND created_at BETWEEN ${startDate} AND ${endDate}
        GROUP BY session_id
      )
      SELECT COUNT(DISTINCT we.session_id) AS sessions_with_event
      FROM website_event we
      JOIN firsts f ON f.session_id = we.session_id
      WHERE we.website_id = ${TEST_WEBSITE_ID}::uuid
        AND DATE_TRUNC('day', we.created_at) = DATE_TRUNC('day', f.first_time)
        AND we.event_name = ${EVENT_NAME}
    `;

    const sessionsWithEventOnFirstDay = Number(sessionsWithRows[0]?.sessions_with_event || 0);
    const percentage = totalSessions > 0 ? (sessionsWithEventOnFirstDay / totalSessions) * 100 : 0;

    console.log('Results:');
    console.log(`- Total new sessions: ${totalSessions}`);
    console.log(
      `- Sessions with "${EVENT_NAME}" on first day: ${sessionsWithEventOnFirstDay} (${percentage.toFixed(
        2,
      )}%)`,
    );

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Error testing new user first-day event rate:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
