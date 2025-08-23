/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

const TEST_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const TEST_START_DATE = '2025-07-01';
const TEST_END_DATE = '2025-08-31';

const startDate = new Date(TEST_START_DATE);
const endDate = new Date(TEST_END_DATE);

async function main() {
  console.log('=== Testing Event Dropoffs ===\n');
  try {
    const rows = await prisma.$queryRaw`
      WITH last_events AS (
        SELECT we.session_id, MAX(we.created_at) AS last_time
        FROM website_event we
        WHERE we.website_id = ${TEST_WEBSITE_ID}::uuid
          AND we.created_at BETWEEN ${startDate} AND ${endDate}
        GROUP BY we.session_id
      )
      SELECT 
        we.event_name,
        COUNT(DISTINCT we.session_id) FILTER (WHERE we.event_name IS NOT NULL) AS sessions_with_event,
        COUNT(DISTINCT we.session_id) FILTER (
          WHERE we.event_name IS NOT NULL AND we.created_at = le.last_time
        ) AS dropoff_sessions
      FROM website_event we
      JOIN last_events le
        ON le.session_id = we.session_id
      WHERE we.website_id = ${TEST_WEBSITE_ID}::uuid
        AND we.created_at BETWEEN ${startDate} AND ${endDate}
      GROUP BY we.event_name
      HAVING we.event_name IS NOT NULL
      ORDER BY dropoff_sessions DESC
      LIMIT 10
    `;

    console.log('Top dropoff events:');
    rows.forEach((r, i) => {
      const sessionsWithEvent = Number(r.sessions_with_event || 0);
      const dropoffSessions = Number(r.dropoff_sessions || 0);
      const dropoffRate = sessionsWithEvent > 0 ? (dropoffSessions / sessionsWithEvent) * 100 : 0;
      console.log(
        `${i + 1}. ${
          r.event_name
        }: ${dropoffSessions} dropoffs / ${sessionsWithEvent} sessions (${dropoffRate.toFixed(
          2,
        )}%)`,
      );
    });

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Error testing event dropoffs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
