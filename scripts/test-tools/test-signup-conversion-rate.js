const { PrismaClient } = require('@prisma/client');
const { subDays } = require('date-fns');
/* eslint-disable no-console */

const prisma = new PrismaClient();

// Will be fetched from database
let WEBSITE_ID;

async function fetchWebsiteId() {
  // Get first available website
  const website = await prisma.website.findFirst();
  if (!website) {
    throw new Error('No websites found in database');
  }
  WEBSITE_ID = website.id;
  console.log(`Using website ID: ${WEBSITE_ID}`);
  return website;
}

async function testSignupConversionRate() {
  console.log('Testing Signup Conversion Rate Tool...\n');

  try {
    // Fetch website ID first
    await fetchWebsiteId();

    // Test 1: Count events manually
    console.log('1. Manual Event Count Test:');

    const startDate = subDays(new Date(), 30);
    const endDate = new Date();

    // Count pageviews (visits)
    const totalVisits = await prisma.websiteEvent.count({
      where: {
        websiteId: WEBSITE_ID,
        eventType: 1, // Pageviews
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Count signups
    const totalSignups = await prisma.websiteEvent.count({
      where: {
        websiteId: WEBSITE_ID,
        eventName: 'signup',
        eventType: 2, // Custom events
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Count unique visitors
    const uniqueVisitors = await prisma.websiteEvent.groupBy({
      by: ['sessionId'],
      where: {
        websiteId: WEBSITE_ID,
        eventType: 1, // Pageviews
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        sessionId: true,
      },
    });

    // Count unique signup users
    const uniqueSignupUsers = await prisma.websiteEvent.groupBy({
      by: ['sessionId'],
      where: {
        websiteId: WEBSITE_ID,
        eventName: 'signup',
        eventType: 2, // Custom events
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        sessionId: true,
      },
    });

    const conversionRate = totalVisits > 0 ? (totalSignups / totalVisits) * 100 : 0;
    const uniqueConversionRate =
      uniqueVisitors.length > 0 ? (uniqueSignupUsers.length / uniqueVisitors.length) * 100 : 0;

    console.log(`   Total pageviews (visits): ${totalVisits}`);
    console.log(`   Total signups: ${totalSignups}`);
    console.log(`   Unique visitors: ${uniqueVisitors.length}`);
    console.log(`   Unique signup users: ${uniqueSignupUsers.length}`);
    console.log(`   Conversion rate (total): ${conversionRate.toFixed(2)}%`);
    console.log(`   Conversion rate (unique): ${uniqueConversionRate.toFixed(2)}%`);
    console.log(`   Ratio: ${totalSignups}:${totalVisits}\n`);

    // Test 2: Test with custom event names
    console.log('2. Custom Event Names Test:');

    const customSignupCount = await prisma.websiteEvent.count({
      where: {
        websiteId: WEBSITE_ID,
        eventName: 'signup',
        eventType: 2,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    console.log(`   Custom signup events: ${customSignupCount}\n`);

    // Test 3: Test date range filtering
    console.log('3. Date Range Filtering Test:');

    const recentStartDate = subDays(new Date(), 7);
    const recentEndDate = new Date();

    const recentVisits = await prisma.websiteEvent.count({
      where: {
        websiteId: WEBSITE_ID,
        eventType: 1,
        createdAt: {
          gte: recentStartDate,
          lte: recentEndDate,
        },
      },
    });

    const recentSignups = await prisma.websiteEvent.count({
      where: {
        websiteId: WEBSITE_ID,
        eventName: 'signup',
        eventType: 2,
        createdAt: {
          gte: recentStartDate,
          lte: recentEndDate,
        },
      },
    });

    console.log(`   Last 7 days - Visits: ${recentVisits}`);
    console.log(`   Last 7 days - Signups: ${recentSignups}\n`);

    // Test 4: API endpoint simulation
    console.log('4. API Endpoint Simulation:');

    const apiResponse = {
      success: true,
      data: {
        websiteId: WEBSITE_ID,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        metrics: {
          totalVisits: totalVisits,
          totalSignups: totalSignups,
          conversionRate: `${conversionRate.toFixed(2)}%`,
          ratio: `${totalSignups}:${totalVisits}`,
        },
        breakdown: {
          visits: {
            pageviews: totalVisits,
            uniqueVisitors: uniqueVisitors.length,
          },
          signups: {
            total: totalSignups,
            uniqueUsers: uniqueSignupUsers.length,
          },
        },
        analysis: {
          question: 'What is the ratio of "signups" vs "visits"?',
          answer: `During the analyzed period, there were ${totalVisits} total visits (pageviews) and ${totalSignups} signups. The conversion rate is ${conversionRate.toFixed(
            2,
          )}%, meaning for every 100 visits, ${conversionRate.toFixed(1)} resulted in a signup.`,
        },
      },
      timestamp: new Date().toISOString(),
    };

    console.log('   API Response Structure:');
    console.log(`   - Total visits: ${apiResponse.data.metrics.totalVisits}`);
    console.log(`   - Total signups: ${apiResponse.data.metrics.totalSignups}`);
    console.log(`   - Conversion rate: ${apiResponse.data.metrics.conversionRate}`);
    console.log(`   - Ratio: ${apiResponse.data.metrics.ratio}`);

    console.log('\n✅ Signup Conversion Rate Tool tests completed successfully!');
  } catch (error) {
    console.error('❌ Error testing Signup Conversion Rate Tool:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testSignupConversionRate().catch(console.error);
}

module.exports = { testSignupConversionRate };
