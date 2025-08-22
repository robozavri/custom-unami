#!/usr/bin/env node

/**
 * Test script for check-event-drop-chain tool
 * Tests the API endpoint with various funnel scenarios
 */
/* eslint-disable no-console */
const BASE_URL = 'http://localhost:3000';

// Test scenarios
const testScenarios = [
  {
    name: 'E-commerce checkout funnel test',
    params: {
      steps: ['view_product', 'add_to_cart', 'start_checkout', 'payment_info', 'purchase_complete'],
      from: '2025-07-01',
      to: '2025-08-31',
      distinctBy: 'session_id',
    },
  },
  {
    name: 'User onboarding funnel test',
    params: {
      steps: [
        'signup_started',
        'email_verified',
        'profile_created',
        'first_action',
        'feature_adopted',
      ],
      from: '2025-07-15',
      to: '2025-08-31',
      distinctBy: 'session_id',
    },
  },
  {
    name: 'Lead generation funnel test',
    params: {
      steps: [
        'landing_page_view',
        'form_started',
        'form_completed',
        'lead_qualified',
        'contact_made',
      ],
      from: '2025-08-01',
      to: '2025-08-31',
      distinctBy: 'visitor_id',
    },
  },
  {
    name: 'Short funnel test (3 steps)',
    params: {
      steps: ['trial_started', 'trial_used', 'subscription_active'],
      from: '2025-07-01',
      to: '2025-08-31',
      distinctBy: 'session_id',
    },
  },
];

async function testCheckEventDropChain(params, scenarioName) {
  try {
    console.log(`\n🧪 Testing: ${scenarioName}`);
    console.log(`📊 Parameters:`, JSON.stringify(params, null, 2));

    const response = await fetch(`${BASE_URL}/api/tools/check-event-drop-chain`, {
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
    console.log(`\n📈 Funnel Analysis Summary:`);
    console.log(`   Total steps: ${result.summary.totalSteps}`);
    console.log(`   Users started: ${result.summary.totalUsersStarted.toLocaleString()}`);
    console.log(`   Users completed: ${result.summary.totalUsersCompleted.toLocaleString()}`);
    console.log(`   Overall conversion rate: ${result.summary.overallConversionRate.toFixed(2)}%`);
    console.log(`   Total drop-off: ${result.summary.totalDropOff.toLocaleString()}`);
    console.log(`   Step with highest drop-off: ${result.summary.stepWithHighestDropOff}`);
    console.log(`   Highest drop-off rate: ${result.summary.highestDropOffRate.toFixed(2)}%`);

    // Display detailed funnel steps
    if (result.data.length > 0) {
      console.log(`\n🔀 Funnel Step Details:`);
      result.data.forEach((step, index) => {
        const { step: stepName, users, dropToNext, dropRate } = step;
        console.log(`   ${index + 1}. ${stepName}:`);
        console.log(`      Users: ${users.toLocaleString()}`);

        if (dropToNext !== null) {
          console.log(
            `      Drop-off to next: ${dropToNext.toLocaleString()} users (${dropRate?.toFixed(
              2,
            )}%)`,
          );
        } else {
          console.log(`      Final step - no drop-off calculation`);
        }
      });
    }

    // Performance analysis
    console.log(`\n🔍 Performance Analysis:`);

    if (result.data.length > 0) {
      const firstStepUsers = result.data[0]?.users || 0;
      const lastStepUsers = result.data[result.data.length - 1]?.users || 0;

      if (firstStepUsers > 0) {
        const overallDropOff = firstStepUsers - lastStepUsers;
        const overallDropOffRate = (overallDropOff / firstStepUsers) * 100;

        console.log(`   Overall funnel performance:`);
        console.log(`      Started: ${firstStepUsers.toLocaleString()} users`);
        console.log(`      Completed: ${lastStepUsers.toLocaleString()} users`);
        console.log(
          `      Total drop-off: ${overallDropOff.toLocaleString()} users (${overallDropOffRate.toFixed(
            2,
          )}%)`,
        );
        console.log(
          `      Final conversion rate: ${((lastStepUsers / firstStepUsers) * 100).toFixed(2)}%`,
        );
      }

      // Analyze drop-off patterns
      const stepsWithDropOff = result.data.filter(step => step.dropRate !== null);
      if (stepsWithDropOff.length > 0) {
        const avgDropOffRate =
          stepsWithDropOff.reduce((sum, step) => sum + (step.dropRate || 0), 0) /
          stepsWithDropOff.length;
        const maxDropOffRate = Math.max(...stepsWithDropOff.map(step => step.dropRate || 0));
        const minDropOffRate = Math.min(...stepsWithDropOff.map(step => step.dropRate || 0));

        console.log(`   Drop-off rate analysis:`);
        console.log(`      Average drop-off rate: ${avgDropOffRate.toFixed(2)}%`);
        console.log(`      Highest drop-off rate: ${maxDropOffRate.toFixed(2)}%`);
        console.log(`      Lowest drop-off rate: ${minDropOffRate.toFixed(2)}%`);
        console.log(`      Steps with drop-off: ${stepsWithDropOff.length}`);
      }

      // Identify bottlenecks
      const bottlenecks = result.data
        .filter(step => step.dropRate !== null && step.dropRate > 50)
        .sort((a, b) => (b.dropRate || 0) - (a.dropRate || 0));

      if (bottlenecks.length > 0) {
        console.log(`   🚨 High drop-off bottlenecks:`);
        bottlenecks.forEach(step => {
          console.log(`      ${step.step}: ${step.dropRate?.toFixed(2)}% drop-off`);
        });
      }

      // Identify strong conversion steps
      const strongSteps = result.data
        .filter(step => step.dropRate !== null && step.dropRate < 20)
        .sort((a, b) => (a.dropRate || 0) - (b.dropRate || 0));

      if (strongSteps.length > 0) {
        console.log(`   ✅ Strong conversion steps:`);
        strongSteps.forEach(step => {
          console.log(`      ${step.step}: ${step.dropRate?.toFixed(2)}% drop-off`);
        });
      }
    }

    return { success: true, result };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Starting check-event-drop-chain tool tests...\n');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📅 Test scenarios: ${testScenarios.length}\n`);

  let passedTests = 0;
  let failedTests = 0;

  for (const scenario of testScenarios) {
    const testResult = await testCheckEventDropChain(scenario.params, scenario.name);

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
  testCheckEventDropChain,
  runAllTests,
  testScenarios,
};
