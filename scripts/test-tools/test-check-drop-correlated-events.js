#!/usr/bin/env node

/* eslint-disable no-console */
/**
 * Test script for check-drop-correlated-events tool
 * Tests the API endpoint with various scenarios to analyze event drop-off patterns
 */

const BASE_URL = 'http://localhost:3000';

// Test scenarios
const testScenarios = [
  {
    name: 'Purchase completion event correlation analysis',
    params: {
      targetEvent: 'purchase_complete',
      from: '2025-07-01',
      to: '2025-08-31',
      compareWithConverters: false,
    },
  },
  {
    name: 'Signup completion event correlation analysis',
    params: {
      targetEvent: 'signup_complete',
      from: '2025-07-15',
      to: '2025-08-31',
      compareWithConverters: true,
    },
  },
  {
    name: 'Trial start event correlation analysis',
    params: {
      targetEvent: 'trial_started',
      from: '2025-08-01',
      to: '2025-08-31',
      compareWithConverters: true,
    },
  },
  {
    name: 'Subscription activation event correlation analysis',
    params: {
      targetEvent: 'subscription_active',
      from: '2025-07-01',
      to: '2025-08-31',
      compareWithConverters: false,
    },
  },
];

async function testCheckDropCorrelatedEvents(params, scenarioName) {
  try {
    console.log(`\n🧪 Testing: ${scenarioName}`);
    console.log(`📊 Parameters:`, JSON.stringify(params, null, 2));

    const response = await fetch(`${BASE_URL}/api/tools/check-drop-correlated-events`, {
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
    console.log(`\n📈 Event Correlation Analysis Summary:`);
    console.log(`   Total events analyzed: ${result.summary.totalEventsAnalyzed}`);
    console.log(`   Total drop sessions: ${result.summary.totalDropSessions.toLocaleString()}`);
    console.log(
      `   Average drop session percent: ${result.summary.averageDropSessionPercent.toFixed(2)}%`,
    );
    console.log(`   Event with highest correlation: ${result.summary.eventWithHighestCorrelation}`);
    console.log(
      `   Highest correlation percent: ${result.summary.highestCorrelationPercent.toFixed(2)}%`,
    );
    console.log(`   Comparison enabled: ${result.summary.comparisonEnabled}`);

    // Display detailed event analysis
    if (result.data.length > 0) {
      console.log(`\n🔍 Event Drop Correlation Details:`);
      result.data.slice(0, 10).forEach((event, index) => {
        const {
          event: eventName,
          dropSessionCount,
          dropSessionPercent,
          converterSessionPercent,
          delta,
          direction,
        } = event;
        console.log(`   ${index + 1}. ${eventName}:`);
        console.log(`      Drop sessions: ${dropSessionCount.toLocaleString()}`);
        console.log(`      Drop session percent: ${dropSessionPercent.toFixed(2)}%`);

        if (converterSessionPercent !== undefined) {
          console.log(`      Converter session percent: ${converterSessionPercent.toFixed(2)}%`);
          console.log(`      Delta: ${delta?.toFixed(2)}%`);
          console.log(`      Direction: ${direction}`);
        }
      });

      if (result.data.length > 10) {
        console.log(`   ... and ${result.data.length - 10} more events`);
      }
    }

    // Performance analysis
    console.log(`\n🔍 Performance Analysis:`);

    if (result.data.length > 0) {
      // Analyze high correlation events
      const highCorrelationEvents = result.data
        .filter(event => event.dropSessionPercent > 20)
        .sort((a, b) => b.dropSessionPercent - a.dropSessionPercent);

      if (highCorrelationEvents.length > 0) {
        console.log(`   🚨 High correlation events (>20% drop sessions):`);
        highCorrelationEvents.forEach(event => {
          console.log(
            `      ${event.event}: ${event.dropSessionPercent.toFixed(2)}% drop sessions`,
          );
        });
      }

      // Analyze low correlation events
      const lowCorrelationEvents = result.data
        .filter(event => event.dropSessionPercent < 5)
        .sort((a, b) => a.dropSessionPercent - b.dropSessionPercent);

      if (lowCorrelationEvents.length > 0) {
        console.log(`   ✅ Low correlation events (<5% drop sessions):`);
        lowCorrelationEvents.forEach(event => {
          console.log(
            `      ${event.event}: ${event.dropSessionPercent.toFixed(2)}% drop sessions`,
          );
        });
      }

      // Direction analysis (if comparison enabled)
      if (params.compareWithConverters) {
        const higherInDrops = result.data.filter(e => e.direction === 'higher_in_drops').length;
        const higherInConverters = result.data.filter(
          e => e.direction === 'higher_in_converters',
        ).length;
        const neutral = result.data.filter(e => e.direction === 'neutral').length;

        console.log(`   📊 Direction analysis:`);
        console.log(`      Higher in drop sessions: ${higherInDrops}`);
        console.log(`      Higher in converting sessions: ${higherInConverters}`);
        console.log(`      Neutral: ${neutral}`);
      }
    }

    // Insights and recommendations
    console.log(`\n💡 Insights and Recommendations:`);

    if (result.data.length > 0) {
      const topCorrelatedEvent = result.data[0];
      console.log(`   🎯 Most problematic event: ${topCorrelatedEvent.event}`);
      console.log(
        `      - Appears in ${topCorrelatedEvent.dropSessionPercent.toFixed(1)}% of drop sessions`,
      );

      if (topCorrelatedEvent.direction) {
        console.log(`      - Direction: ${topCorrelatedEvent.direction}`);
        if (topCorrelatedEvent.direction === 'higher_in_drops') {
          console.log(`      - This event is disproportionately common in drop sessions`);
          console.log(`      - Consider: removing distraction, improving flow, or better guidance`);
        } else if (topCorrelatedEvent.direction === 'higher_in_converters') {
          console.log(`      - This event is more common in converting sessions`);
          console.log(`      - Consider: encouraging this behavior in drop sessions`);
        }
      }

      // Overall conversion health
      const avgCorrelation =
        result.data.reduce((sum, event) => sum + event.dropSessionPercent, 0) / result.data.length;
      if (avgCorrelation > 30) {
        console.log(`   ⚠️  Overall high drop correlation (${avgCorrelation.toFixed(1)}% average)`);
        console.log(`      - Multiple events are causing significant user abandonment`);
        console.log(`      - Consider: comprehensive user experience audit`);
      } else if (avgCorrelation > 15) {
        console.log(`   🔶 Moderate drop correlation (${avgCorrelation.toFixed(1)}% average)`);
        console.log(`      - Some events need attention but overall flow is reasonable`);
        console.log(`      - Focus on the highest correlation events first`);
      } else {
        console.log(`   ✅ Low drop correlation (${avgCorrelation.toFixed(1)}% average)`);
        console.log(`      - Most events are performing well`);
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
  console.log('🚀 Starting check-drop-correlated-events tool tests...\n');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📅 Test scenarios: ${testScenarios.length}\n`);

  let passedTests = 0;
  let failedTests = 0;

  for (const scenario of testScenarios) {
    const testResult = await testCheckDropCorrelatedEvents(scenario.params, scenario.name);

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
  testCheckDropCorrelatedEvents,
  runAllTests,
  testScenarios,
};
