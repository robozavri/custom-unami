#!/usr/bin/env node

/* eslint-disable no-console */
/**
 * Test script for compare-by-segment-shift tool
 * Tests the API endpoint with various scenarios
 */

const BASE_URL = 'http://localhost:3000';

// Test scenarios
const testScenarios = [
  {
    name: 'Basic functionality test with device + country segments',
    params: {
      conversionEvent: 'purchase',
      segmentFields: ['device', 'country'],
      currentFrom: '2025-08-01',
      currentTo: '2025-08-31',
      previousFrom: '2025-07-01',
      previousTo: '2025-07-31',
      minVisitors: 5,
    },
  },
  {
    name: 'Browser + OS segments test with signup events',
    params: {
      conversionEvent: 'signup',
      segmentFields: ['browser', 'os'],
      currentFrom: '2025-08-15',
      currentTo: '2025-08-31',
      previousFrom: '2025-07-15',
      previousTo: '2025-07-31',
      minVisitors: 3,
    },
  },
  {
    name: 'Single field segment test (device only)',
    params: {
      conversionEvent: 'checkout',
      segmentFields: ['device'],
      currentFrom: '2025-08-01',
      currentTo: '2025-08-31',
      previousFrom: '2025-07-01',
      previousTo: '2025-07-31',
      minVisitors: 5,
    },
  },
];

async function testCompareBySegmentShift(params, scenarioName) {
  try {
    console.log(`\n🧪 Testing: ${scenarioName}`);
    console.log(`📊 Parameters:`, JSON.stringify(params, null, 2));

    const response = await fetch(`${BASE_URL}/api/tools/compare-by-segment-shift`, {
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
    console.log(`\n📈 Results Summary:`);
    console.log(`   Total segments: ${result.summary.totalSegments}`);
    console.log(`   Segments with increase: ${result.summary.segmentsWithIncrease}`);
    console.log(`   Segments with decrease: ${result.summary.segmentsWithDecrease}`);
    console.log(`   Segments with no change: ${result.summary.segmentsWithNoChange}`);

    if (result.summary.topPerformer) {
      const segmentStr = Object.entries(result.summary.topPerformer.segment)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ');
      console.log(
        `   Top performer: [${segmentStr}] (+${result.summary.topPerformer.change.percentChange.toFixed(
          2,
        )}%)`,
      );
    }

    if (result.summary.worstPerformer) {
      const segmentStr = Object.entries(result.summary.worstPerformer.segment)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ');
      console.log(
        `   Worst performer: [${segmentStr}] (${result.summary.worstPerformer.change.percentChange.toFixed(
          2,
        )}%)`,
      );
    }

    // Display detailed results
    if (result.data.length > 0) {
      console.log(`\n🔀 Segment Performance Details:`);
      result.data.forEach((segment, index) => {
        const { segment: segmentData, current, previous, change } = segment;
        const segmentStr = Object.entries(segmentData)
          .map(([k, v]) => `${k}:${v}`)
          .join(', ');
        console.log(`   ${index + 1}. [${segmentStr}]:`);
        console.log(
          `      Current: ${current.conversions} conversions, ${
            current.uniqueVisitors
          } visitors (${(current.conversionRate * 100).toFixed(2)}%)`,
        );
        console.log(
          `      Previous: ${previous.conversions} conversions, ${
            previous.uniqueVisitors
          } visitors (${(previous.conversionRate * 100).toFixed(2)}%)`,
        );
        console.log(
          `      Change: ${change.direction} (${
            change.percentChange > 0 ? '+' : ''
          }${change.percentChange.toFixed(2)}%)`,
        );
      });
    }

    // Performance analysis
    console.log(`\n🔍 Performance Analysis:`);

    const segmentsWithData = result.data.filter(
      d => d.current.uniqueVisitors > 0 && d.previous.uniqueVisitors > 0,
    );

    if (segmentsWithData.length > 0) {
      const avgCurrentRate =
        segmentsWithData.reduce((sum, d) => sum + d.current.conversionRate, 0) /
        segmentsWithData.length;
      const avgPreviousRate =
        segmentsWithData.reduce((sum, d) => sum + d.previous.conversionRate, 0) /
        segmentsWithData.length;
      const overallChange = ((avgCurrentRate - avgPreviousRate) / avgPreviousRate) * 100;

      console.log(`   Average current conversion rate: ${(avgCurrentRate * 100).toFixed(2)}%`);
      console.log(`   Average previous conversion rate: ${(avgPreviousRate * 100).toFixed(2)}%`);
      console.log(`   Overall change: ${overallChange > 0 ? '+' : ''}${overallChange.toFixed(2)}%`);

      // Identify trends
      const increasingSegments = segmentsWithData.filter(d => d.change.direction === 'increase');
      const decreasingSegments = segmentsWithData.filter(d => d.change.direction === 'decrease');

      if (increasingSegments.length > 0) {
        console.log(`   📈 Improving segments: ${increasingSegments.length}`);
      }

      if (decreasingSegments.length > 0) {
        console.log(`   📉 Declining segments: ${decreasingSegments.length}`);
      }

      // Traffic analysis
      const totalCurrentVisitors = segmentsWithData.reduce(
        (sum, d) => sum + d.current.uniqueVisitors,
        0,
      );
      const totalPreviousVisitors = segmentsWithData.reduce(
        (sum, d) => sum + d.previous.uniqueVisitors,
        0,
      );
      const visitorChange =
        ((totalCurrentVisitors - totalPreviousVisitors) / totalPreviousVisitors) * 100;

      console.log(`   Total current visitors: ${totalCurrentVisitors.toLocaleString()}`);
      console.log(`   Total previous visitors: ${totalPreviousVisitors.toLocaleString()}`);
      console.log(`   Visitor change: ${visitorChange > 0 ? '+' : ''}${visitorChange.toFixed(2)}%`);
    }

    return { success: true, result };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Starting compare-by-segment-shift tool tests...\n');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📅 Test scenarios: ${testScenarios.length}\n`);

  let passedTests = 0;
  let failedTests = 0;

  for (const scenario of testScenarios) {
    const testResult = await testCompareBySegmentShift(scenario.params, scenario.name);

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
  testCompareBySegmentShift,
  runAllTests,
  testScenarios,
};
