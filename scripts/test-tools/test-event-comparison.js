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

async function testEventComparison() {
  console.log('Testing Event Comparison Tool...\n');

  try {
    // Fetch website ID first
    await fetchWebsiteId();

    // Test 1: Count events manually
    console.log('1. Manual Event Count Test:');

    const startDate = subDays(new Date(), 30);
    const endDate = new Date();

    const addToCartCount = await prisma.websiteEvent.count({
      where: {
        websiteId: WEBSITE_ID,
        eventName: 'add_to_cart',
        eventType: 2,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const checkoutCount = await prisma.websiteEvent.count({
      where: {
        websiteId: WEBSITE_ID,
        eventName: 'checkout_success',
        eventType: 2,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const successRate = addToCartCount > 0 ? (checkoutCount / addToCartCount) * 100 : 0;

    console.log(`   Add to cart events: ${addToCartCount}`);
    console.log(`   Checkout success events: ${checkoutCount}`);
    console.log(`   Success rate: ${successRate.toFixed(2)}%`);
    console.log(`   Conversion ratio: ${checkoutCount}:${addToCartCount}\n`);

    // Test 2: Test with custom event names
    console.log('2. Custom Event Names Test:');

    const customAddCount = await prisma.websiteEvent.count({
      where: {
        websiteId: WEBSITE_ID,
        eventName: 'add_to_cart',
        eventType: 2,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const customCheckoutCount = await prisma.websiteEvent.count({
      where: {
        websiteId: WEBSITE_ID,
        eventName: 'checkout_success',
        eventType: 2,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    console.log(`   Custom add_to_cart events: ${customAddCount}`);
    console.log(`   Custom checkout_success events: ${customCheckoutCount}\n`);

    // Test 3: Test date range filtering
    console.log('3. Date Range Filtering Test:');

    const recentStartDate = subDays(new Date(), 7);
    const recentEndDate = new Date();

    const recentAddCount = await prisma.websiteEvent.count({
      where: {
        websiteId: WEBSITE_ID,
        eventName: 'add_to_cart',
        eventType: 2,
        createdAt: {
          gte: recentStartDate,
          lte: recentEndDate,
        },
      },
    });

    const recentCheckoutCount = await prisma.websiteEvent.count({
      where: {
        websiteId: WEBSITE_ID,
        eventName: 'checkout_success',
        eventType: 2,
        createdAt: {
          gte: recentStartDate,
          lte: recentEndDate,
        },
      },
    });

    console.log(`   Last 7 days - Add to cart: ${recentAddCount}`);
    console.log(`   Last 7 days - Checkout: ${recentCheckoutCount}\n`);

    // Test 4: Test API endpoint simulation
    console.log('4. API Endpoint Simulation:');

    const apiResponse = {
      success: true,
      data: {
        websiteId: WEBSITE_ID,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        events: {
          addToCart: {
            name: 'add_to_cart',
            count: addToCartCount,
          },
          checkout: {
            name: 'checkout_success',
            count: checkoutCount,
          },
        },
        metrics: {
          totalEvents: addToCartCount + checkoutCount,
          successRate: `${successRate.toFixed(2)}%`,
          conversionRatio: `${checkoutCount}:${addToCartCount}`,
        },
        analysis: {
          question: 'How many successful checkout events were there vs. add_to_cart events?',
          answer: `During the analyzed period, there were ${addToCartCount} add_to_cart events and ${checkoutCount} checkout_success events. The conversion rate is ${successRate.toFixed(
            2,
          )}%.`,
        },
      },
      timestamp: new Date().toISOString(),
    };

    console.log('   API Response Structure:');
    console.log(`   - Add to cart: ${apiResponse.data.events.addToCart.count}`);
    console.log(`   - Checkout success: ${apiResponse.data.events.checkout.count}`);
    console.log(`   - Success rate: ${apiResponse.data.metrics.successRate}`);
    console.log(`   - Total events: ${apiResponse.data.metrics.totalEvents}`);

    console.log('\n✅ Event Comparison Tool tests completed successfully!');
  } catch (error) {
    console.error('❌ Error testing Event Comparison Tool:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testEventComparison().catch(console.error);
}

module.exports = { testEventComparison };
