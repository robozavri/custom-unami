#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Test script for check-drop-correlated-pages tool
 * Tests the API endpoint with various scenarios to analyze drop-off patterns
 */

const BASE_URL = 'http://localhost:3000';

// Test scenarios
const testScenarios = [
  {
    name: 'Purchase completion drop-off analysis',
    params: {
      targetEvent: 'purchase_complete',
      from: '2025-07-01',
      to: '2025-08-31',
      lastPagesLimit: 1,
    },
  },
  {
    name: 'Signup completion drop-off analysis',
    params: {
      targetEvent: 'signup_complete',
      from: '2025-07-15',
      to: '2025-08-31',
      lastPagesLimit: 2,
    },
  },
  {
    name: 'Trial start drop-off analysis',
    params: {
      targetEvent: 'trial_started',
      from: '2025-08-01',
      to: '2025-08-31',
      lastPagesLimit: 3,
    },
  },
  {
    name: 'Subscription activation drop-off analysis',
    params: {
      targetEvent: 'subscription_active',
      from: '2025-07-01',
      to: '2025-08-31',
      lastPagesLimit: 1,
    },
  },
];

async function testCheckDropCorrelatedPages(params, scenarioName) {
  try {
    console.log(`\n🧪 Testing: ${scenarioName}`);
    console.log(`📊 Parameters:`, JSON.stringify(params, null, 2));

    const response = await fetch(`${BASE_URL}/api/tools/check-drop-correlated-pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    console.log(`✅ Response received successfully`);
    console.log(`📊 Response structure:`, {
      hasData: !!result.data,
      dataLength: result.data?.length || 0,
      hasSummary: !!result.summary,
      hasMetadata: !!result.metadata,
    });

    // Validate response structure
    if (!result.data || !Array.isArray(result.data)) {
      throw new Error('Response missing or invalid data array');
    }

    if (!result.summary) {
      throw new Error('Response missing summary');
    }

    if (!result.metadata) {
      throw new Error('Response missing metadata');
    }

    // Display results
    console.log(`\n📈 Drop Correlation Analysis Summary:`);
    console.log(`   Total pages analyzed: ${result.summary.totalPagesAnalyzed}`);
    console.log(`   Total drop sessions: ${result.summary.totalDropSessions.toLocaleString()}`);
    console.log(
      `   Average percentage of drop sessions: ${result.summary.averagePercentageOfDropSessions.toFixed(
        2,
      )}%`,
    );
    console.log(
      `   Average position from end: ${result.summary.averagePositionFromEnd.toFixed(2)}`,
    );
    console.log(`   Page with highest correlation: ${result.summary.pageWithHighestCorrelation}`);
    console.log(
      `   Highest correlation percentage: ${result.summary.highestCorrelationPercentage.toFixed(
        2,
      )}%`,
    );

    // Display detailed page analysis
    if (result.data.length > 0) {
      console.log(`\n🔍 Page Drop Correlation Details:`);
      result.data.slice(0, 10).forEach((page, index) => {
        const { path, dropSessions, percentageOfDropSessions, avgPositionFromEnd } = page;
        console.log(`   ${index + 1}. ${path}:`);
        console.log(`      Drop sessions: ${dropSessions.toLocaleString()}`);
        console.log(`      Percentage of drop sessions: ${percentageOfDropSessions.toFixed(2)}%`);
        console.log(`      Average position from end: ${avgPositionFromEnd.toFixed(2)}`);
      });

      if (result.data.length > 10) {
        console.log(`   ... and ${result.data.length - 10} more pages`);
      }
    }

    // Performance analysis
    console.log(`\n🔍 Performance Analysis:`);

    if (result.data.length > 0) {
      // Analyze high correlation pages
      const highCorrelationPages = result.data
        .filter(page => page.percentageOfDropSessions > 20)
        .sort((a, b) => b.percentageOfDropSessions - a.percentageOfDropSessions);

      if (highCorrelationPages.length > 0) {
        console.log(`   🚨 High correlation pages (>20% drop sessions):`);
        highCorrelationPages.forEach(page => {
          console.log(
            `      ${page.path}: ${page.percentageOfDropSessions.toFixed(2)}% drop sessions`,
          );
        });
      }

      // Analyze low correlation pages
      const lowCorrelationPages = result.data
        .filter(page => page.percentageOfDropSessions < 5)
        .sort((a, b) => a.percentageOfDropSessions - b.percentageOfDropSessions);

      if (lowCorrelationPages.length > 0) {
        console.log(`   ✅ Low correlation pages (<5% drop sessions):`);
        lowCorrelationPages.forEach(page => {
          console.log(
            `      ${page.path}: ${page.percentageOfDropSessions.toFixed(2)}% drop sessions`,
          );
        });
      }

      // Position analysis
      const avgPosition =
        result.data.reduce((sum, page) => sum + page.avgPositionFromEnd, 0) / result.data.length;
      console.log(`   📍 Position analysis:`);
      console.log(`      Average position from end: ${avgPosition.toFixed(2)}`);
      console.log(
        `      Pages appearing at end (position 1): ${
          result.data.filter(p => p.avgPositionFromEnd <= 1.5).length
        }`,
      );
      console.log(
        `      Pages appearing mid-session: ${
          result.data.filter(p => p.avgPositionFromEnd > 1.5 && p.avgPositionFromEnd <= 3).length
        }`,
      );
      console.log(
        `      Pages appearing early: ${result.data.filter(p => p.avgPositionFromEnd > 3).length}`,
      );
    }

    // Insights and recommendations
    console.log(`\n💡 Insights and Recommendations:`);

    if (result.data.length > 0) {
      const topCorrelatedPage = result.data[0];
      console.log(`   🎯 Most problematic page: ${topCorrelatedPage.path}`);
      console.log(
        `      - Appears in ${topCorrelatedPage.percentageOfDropSessions.toFixed(
          1,
        )}% of drop sessions`,
      );
      console.log(
        `      - Average position: ${topCorrelatedPage.avgPositionFromEnd.toFixed(1)} from end`,
      );

      if (topCorrelatedPage.avgPositionFromEnd <= 1.5) {
        console.log(
          `      - This page is frequently the LAST page users visit before dropping off`,
        );
        console.log(`      - Consider: page redesign, content optimization, or removal`);
      } else if (topCorrelatedPage.avgPositionFromEnd <= 3) {
        console.log(`      - This page appears mid-session and causes significant drop-offs`);
        console.log(`      - Consider: improving user flow, reducing friction, or better CTAs`);
      } else {
        console.log(`      - This page appears early in sessions but still causes drop-offs`);
        console.log(`      - Consider: improving first impressions or navigation`);
      }

      // Overall conversion health
      const avgCorrelation =
        result.data.reduce((sum, page) => sum + page.percentageOfDropSessions, 0) /
        result.data.length;
      if (avgCorrelation > 30) {
        console.log(`   ⚠️  Overall high drop correlation (${avgCorrelation.toFixed(1)}% average)`);
        console.log(`      - Multiple pages are causing significant user abandonment`);
        console.log(`      - Consider: comprehensive user experience audit`);
      } else if (avgCorrelation > 15) {
        console.log(`   🔶 Moderate drop correlation (${avgCorrelation.toFixed(1)}% average)`);
        console.log(`      - Some pages need attention but overall flow is reasonable`);
        console.log(`      - Focus on the highest correlation pages first`);
      } else {
        console.log(`   ✅ Low drop correlation (${avgCorrelation.toFixed(1)}% average)`);
        console.log(`      - Most pages are performing well`);
        console.log(`      - Minor optimizations may still be beneficial`);
      }
    }

    return { success: true, result };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Starting check-drop-correlated-pages tool tests...\n');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📅 Test scenarios: ${testScenarios.length}\n`);

  let passedTests = 0;
  let failedTests = 0;

  for (const scenario of testScenarios) {
    const testResult = await testCheckDropCorrelatedPages(scenario.params, scenario.name);

    if (testResult.success) {
      passedTests++;
      console.log(`✅ Test passed: ${scenario.name}`);
    } else {
      failedTests++;
      console.log(`❌ Test failed: ${scenario.name}`);
    }

    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log(`\n📊 Test Results Summary:`);
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log(`   📊 Total: ${testScenarios.length}`);

  if (failedTests === 0) {
    console.log(`\n🎉 All tests passed successfully!`);
  } else {
    console.log(`\n⚠️  ${failedTests} test(s) failed. Please check the errors above.`);
  }

  return { passedTests, failedTests, totalTests: testScenarios.length };
}

// Check if running as standalone script
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n✨ Test execution completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testCheckDropCorrelatedPages,
  runAllTests,
  testScenarios,
};
