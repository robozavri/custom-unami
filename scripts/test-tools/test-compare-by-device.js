#!/usr/bin/env node

/**
 * Test script for compare-by-device tool
 * Tests the API endpoint with various scenarios
 */
/* eslint-disable no-console */

const BASE_URL = 'http://localhost:3000';

// Test scenarios
const testScenarios = [
  {
    name: 'Basic functionality test with purchase events',
    params: {
      conversionEvent: 'purchase',
      currentFrom: '2025-08-01',
      currentTo: '2025-08-31',
      previousFrom: '2025-07-01',
      previousTo: '2025-07-31',
      minVisitors: 5,
    },
  },
  {
    name: 'Custom date range test with signup events',
    params: {
      conversionEvent: 'signup',
      currentFrom: '2025-08-15',
      currentTo: '2025-08-31',
      previousFrom: '2025-07-15',
      previousTo: '2025-07-31',
      minVisitors: 3,
    },
  },
  {
    name: 'Different conversion events test',
    params: {
      conversionEvent: 'checkout',
      currentFrom: '2025-08-01',
      currentTo: '2025-08-31',
      previousFrom: '2025-07-01',
      previousTo: '2025-07-31',
      minVisitors: 5,
    },
  },
];

async function testCompareByDevice(params, scenarioName) {
  try {
    console.log(`\n🧪 Testing: ${scenarioName}`);
    console.log(`📊 Parameters:`, JSON.stringify(params, null, 2));

    const response = await fetch(`${BASE_URL}/api/tools/compare-by-device`, {
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
    console.log(`   Total devices: ${result.summary.totalDevices}`);
    console.log(`   Devices with increase: ${result.summary.devicesWithIncrease}`);
    console.log(`   Devices with decrease: ${result.summary.devicesWithDecrease}`);
    console.log(`   Devices with no change: ${result.summary.devicesWithNoChange}`);

    if (result.summary.topPerformer) {
      console.log(
        `   Top performer: ${
          result.summary.topPerformer.device
        } (+${result.summary.topPerformer.change.percentChange.toFixed(2)}%)`,
      );
    }

    if (result.summary.worstPerformer) {
      console.log(
        `   Worst performer: ${
          result.summary.worstPerformer.device
        } (${result.summary.worstPerformer.change.percentChange.toFixed(2)}%)`,
      );
    }

    // Display detailed results
    if (result.data.length > 0) {
      console.log(`\n📱 Device Performance Details:`);
      result.data.forEach((device, index) => {
        const { device: deviceType, current, previous, change } = device;
        console.log(`   ${index + 1}. ${deviceType}:`);
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

    const devicesWithData = result.data.filter(
      d => d.current.uniqueVisitors > 0 && d.previous.uniqueVisitors > 0,
    );

    if (devicesWithData.length > 0) {
      const avgCurrentRate =
        devicesWithData.reduce((sum, d) => sum + d.current.conversionRate, 0) /
        devicesWithData.length;
      const avgPreviousRate =
        devicesWithData.reduce((sum, d) => sum + d.previous.conversionRate, 0) /
        devicesWithData.length;
      const overallChange = ((avgCurrentRate - avgPreviousRate) / avgPreviousRate) * 100;

      console.log(`   Average current conversion rate: ${(avgCurrentRate * 100).toFixed(2)}%`);
      console.log(`   Average previous conversion rate: ${(avgPreviousRate * 100).toFixed(2)}%`);
      console.log(`   Overall change: ${overallChange > 0 ? '+' : ''}${overallChange.toFixed(2)}%`);

      // Identify trends
      const increasingDevices = devicesWithData.filter(d => d.change.direction === 'increase');
      const decreasingDevices = devicesWithData.filter(d => d.change.direction === 'decrease');

      if (increasingDevices.length > 0) {
        console.log(`   📈 Improving devices: ${increasingDevices.map(d => d.device).join(', ')}`);
      }

      if (decreasingDevices.length > 0) {
        console.log(`   📉 Declining devices: ${decreasingDevices.map(d => d.device).join(', ')}`);
      }

      // Traffic analysis
      const totalCurrentVisitors = devicesWithData.reduce(
        (sum, d) => sum + d.current.uniqueVisitors,
        0,
      );
      const totalPreviousVisitors = devicesWithData.reduce(
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
  console.log('🚀 Starting compare-by-device tool tests...\n');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📅 Test scenarios: ${testScenarios.length}\n`);

  let passedTests = 0;
  let failedTests = 0;

  for (const scenario of testScenarios) {
    const testResult = await testCompareByDevice(scenario.params, scenario.name);

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
  testCompareByDevice,
  runAllTests,
  testScenarios,
};
