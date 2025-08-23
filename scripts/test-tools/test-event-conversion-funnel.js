/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

const TEST_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const TEST_START_DATE = '2025-07-01';
const TEST_END_DATE = '2025-08-31';
const EVENT_X = 'Start Free Trial';
const EVENT_Y = 'Purchase';

const startDate = new Date(TEST_START_DATE);
const endDate = new Date(TEST_END_DATE);

async function main() {
  console.log('=== Testing Event Conversion Funnel (X -> Y) ===\n');

  try {
    const started = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT we1.session_id) as started
      FROM website_event we1
      WHERE we1.website_id = ${TEST_WEBSITE_ID}::uuid
        AND we1.created_at BETWEEN ${startDate} AND ${endDate}
        AND we1.event_name = ${EVENT_X}
    `;

    const converted = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT we1.session_id) as converted
      FROM website_event we1
      JOIN website_event we2
        ON we2.website_id = we1.website_id
       AND we2.session_id = we1.session_id
       AND we2.created_at > we1.created_at
      WHERE we1.website_id = ${TEST_WEBSITE_ID}::uuid
        AND we1.created_at BETWEEN ${startDate} AND ${endDate}
        AND we1.event_name = ${EVENT_X}
        AND we2.event_name = ${EVENT_Y}
    `;

    const startedSessions = Number(started[0]?.started || 0);
    const convertedSessions = Number(converted[0]?.converted || 0);
    const conversionRate = startedSessions > 0 ? (convertedSessions / startedSessions) * 100 : 0;

    console.log('Results:');
    console.log(`- Started sessions (X): ${startedSessions}`);
    console.log(`- Converted sessions (X -> Y): ${convertedSessions}`);
    console.log(`- Conversion rate: ${conversionRate.toFixed(2)}%`);

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Error testing event conversion funnel:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
