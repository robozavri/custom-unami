// Standalone test runner for compare-by-path tool
// Usage: node scripts/test-tools/test-compare-by-path-standalone.js

/* eslint-disable no-console */

async function testCompareByPath() {
  const baseUrl = 'http://localhost:3000';
  const url = `${baseUrl}/api/tools/compare-by-path`;

  const params = {
    conversionEvent: 'purchase',
    currentFrom: '2025-08-01',
    currentTo: '2025-08-31',
    previousFrom: '2025-07-01',
    previousTo: '2025-07-31',
    minVisitors: 1,
    // websiteId: '5801af32-ebe2-4273-9e58-89de8971a2fd', // optional
  };

  console.log('\n=== Testing compare-by-path tool ===');
  console.log('POST', url);
  console.log('Params:', JSON.stringify(params, null, 2));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    let text = await res.text();
    if (!res.ok) {
      console.error('Request failed:', res.status, res.statusText);
      console.error(text);
      return false;
    }

    console.log('\n--- JSON Response ---');
    console.log(text);

    // Try to parse and validate the response structure
    try {
      const data = JSON.parse(text);
      if (data && Array.isArray(data.data)) {
        console.log('\n✅ Response structure is valid - data array found');
        console.log(`📊 Found ${data.data.length} page paths`);

        // Log summary of results
        if (data.data.length > 0) {
          const increases = data.data.filter(item => item.change.direction === 'increase').length;
          const decreases = data.data.filter(item => item.change.direction === 'decrease').length;
          const noChange = data.data.filter(item => item.change.direction === 'no_change').length;

          console.log(`📈 Paths with increased conversion rate: ${increases}`);
          console.log(`📉 Paths with decreased conversion rate: ${decreases}`);
          console.log(`➡️ Paths with no significant change: ${noChange}`);

          // Show top performers
          const topPerformers = data.data
            .filter(item => item.change.direction === 'increase')
            .sort((a, b) => b.change.percentChange - a.change.percentChange)
            .slice(0, 3);

          if (topPerformers.length > 0) {
            console.log('\n🏆 Top performing paths:');
            topPerformers.forEach((path, index) => {
              console.log(
                `  ${index + 1}. ${path.path}: +${
                  path.change.percentChange
                }% (${path.current.conversionRate.toFixed(
                  4,
                )} vs ${path.previous.conversionRate.toFixed(4)})`,
              );
            });
          }

          // Show worst performers
          const worstPerformers = data.data
            .filter(item => item.change.direction === 'decrease')
            .sort((a, b) => a.change.percentChange - b.change.percentChange)
            .slice(0, 3);

          if (worstPerformers.length > 0) {
            console.log('\n⚠️ Paths with declining performance:');
            worstPerformers.forEach((path, index) => {
              console.log(
                `  ${index + 1}. ${path.path}: ${
                  path.change.percentChange
                }% (${path.current.conversionRate.toFixed(
                  4,
                )} vs ${path.previous.conversionRate.toFixed(4)})`,
              );
            });
          }

          // Show some sample data
          console.log('\n📋 Sample path data:');
          data.data.slice(0, 5).forEach((path, index) => {
            console.log(
              `  ${index + 1}. ${path.path}:`,
              `Current: ${path.current.conversionRate.toFixed(4)}% (${
                path.current.uniqueVisitors
              } visitors)`,
              `Previous: ${path.previous.conversionRate.toFixed(4)}% (${
                path.previous.uniqueVisitors
              } visitors)`,
              `Change: ${path.change.percentChange.toFixed(2)}% (${path.change.direction})`,
            );
          });
        }
      } else {
        console.log('⚠️ Response structure unexpected - data array not found');
      }
    } catch (parseError) {
      console.log('⚠️ Could not parse response as JSON:', parseError.message);
    }

    return true;
  } catch (error) {
    console.error('❌ Request error:', error.message);
    return false;
  }
}

async function testCompareByPathWithDifferentEvents() {
  const baseUrl = 'http://localhost:3000';
  const events = ['purchase', 'signup', 'checkout', 'subscription'];

  console.log('\n=== Testing compare-by-path tool with different events ===');

  for (const event of events) {
    const url = `${baseUrl}/api/tools/compare-by-path`;
    const params = {
      conversionEvent: event,
      currentFrom: '2025-08-01',
      currentTo: '2025-08-31',
      previousFrom: '2025-07-01',
      previousTo: '2025-07-31',
      minVisitors: 3,
    };

    console.log(`\n--- Testing event: ${event} ---`);
    console.log('POST', url);
    console.log('Params:', JSON.stringify(params, null, 2));

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      let text = await res.text();
      if (!res.ok) {
        console.error('Request failed:', res.status, res.statusText);
        console.error(text);
        continue;
      }

      try {
        const data = JSON.parse(text);
        if (data && Array.isArray(data.data)) {
          console.log(`✅ Found ${data.data.length} paths for event: ${event}`);

          if (data.data.length > 0) {
            const increases = data.data.filter(item => item.change.direction === 'increase').length;
            const decreases = data.data.filter(item => item.change.direction === 'decrease').length;
            const noChange = data.data.filter(item => item.change.direction === 'no_change').length;
            console.log(
              `📈 Increases: ${increases}, 📉 Decreases: ${decreases}, ➡️ No change: ${noChange}`,
            );
          }
        }
      } catch (parseError) {
        console.log('⚠️ Could not parse response as JSON:', parseError.message);
      }
    } catch (error) {
      console.error('❌ Request error:', error.message);
    }
  }
}

async function main() {
  console.log('🚀 Starting compare-by-path tool tests...');
  console.log('Make sure your dev server is running on http://localhost:3000');

  try {
    const result1 = await testCompareByPath();
    const result2 = await testCompareByPathWithDifferentEvents();

    console.log('\n=== Test Results Summary ===');
    console.log('compare-by-path (purchase):', result1 ? '✅ PASSED' : '❌ FAILED');
    console.log('compare-by-path (multiple events):', result2 ? '✅ PASSED' : '❌ FAILED');

    if (result1 && result2) {
      console.log('\n🎉 All tests passed! The compare-by-path tool is working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed. Check the output above for details.');
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the tests
main();
