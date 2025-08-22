// Test runner for compare-by-source tool via API
// Usage: yarn test-tools

/* eslint-disable no-console */

async function testCompareBySource(fetchFn, baseUrl) {
  const url = `${baseUrl}/api/tools/compare-by-source`;

  const params = {
    conversionEvent: 'purchase',
    currentFrom: '2025-08-01',
    currentTo: '2025-08-31',
    previousFrom: '2025-01-01',
    previousTo: '2025-07-30',
    minVisitors: 1,
    // websiteId: 'YOUR_WEBSITE_ID', // optional
  };

  console.log('\n=== Testing compare-by-source tool ===');
  console.log('POST', url);
  console.log('Params:', JSON.stringify(params, null, 2));

  const res = await fetchFn(url, {
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
      console.log(`📊 Found ${data.data.length} traffic sources`);

      // Log summary of results
      if (data.data.length > 0) {
        const increases = data.data.filter(item => item.change.direction === 'increase').length;
        const decreases = data.data.filter(item => item.change.direction === 'decrease').length;
        const noChange = data.data.filter(item => item.change.direction === 'no_change').length;

        console.log(`📈 Sources with increased conversion rate: ${increases}`);
        console.log(`📉 Sources with decreased conversion rate: ${decreases}`);
        console.log(`➡️ Sources with no significant change: ${noChange}`);

        // Show top performers
        const topPerformers = data.data
          .filter(item => item.change.direction === 'increase')
          .sort((a, b) => b.change.percentChange - a.change.percentChange)
          .slice(0, 3);

        if (topPerformers.length > 0) {
          console.log('\n🏆 Top performing sources:');
          topPerformers.forEach((source, index) => {
            console.log(
              `  ${index + 1}. ${source.source}: +${
                source.change.percentChange
              }% (${source.current.conversionRate.toFixed(
                4,
              )} vs ${source.previous.conversionRate.toFixed(4)})`,
            );
          });
        }
      }
    } else {
      console.log('⚠️ Response structure unexpected - data array not found');
    }
  } catch (parseError) {
    console.log('⚠️ Could not parse response as JSON:', parseError.message);
  }

  return true;
}

async function testCompareBySourceWithCustomDates(fetchFn, baseUrl) {
  const url = `${baseUrl}/api/tools/compare-by-source`;

  // Test with different date ranges
  const params = {
    conversionEvent: 'signup',
    currentFrom: '2025-08-01',
    currentTo: '2025-08-31',
    previousFrom: '2025-01-01',
    previousTo: '2025-07-30',
    minVisitors: 5,
    // websiteId: 'YOUR_WEBSITE_ID', // optional
  };

  console.log('\n=== Testing compare-by-source tool with custom dates ===');
  console.log('POST', url);
  console.log('Params:', JSON.stringify(params, null, 2));

  const res = await fetchFn(url, {
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

  console.log('\n--- JSON Response (Custom Dates) ---');
  console.log(text);
  return true;
}

async function testCompareBySourceWithWebsiteId(fetchFn, baseUrl) {
  const url = `${baseUrl}/api/tools/compare-by-source`;

  // Test with specific website ID (if available)
  const params = {
    conversionEvent: 'checkout',
    currentFrom: '2025-08-01',
    currentTo: '2025-08-31',
    previousFrom: '2025-01-01',
    previousTo: '2025-07-30',
    minVisitors: 15,
    websiteId: process.env.TEST_WEBSITE_ID || 'test-website-id',
  };

  console.log('\n=== Testing compare-by-source tool with website ID ===');
  console.log('POST', url);
  console.log('Params:', JSON.stringify(params, null, 2));
  console.log('Note: Set TEST_WEBSITE_ID env var to test with real website ID');

  const res = await fetchFn(url, {
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

  console.log('\n--- JSON Response (With Website ID) ---');
  console.log(text);
  return true;
}

async function run() {
  // Use global fetch if available (Node >=18), otherwise dynamically import node-fetch (ESM)
  const fetchFn = typeof fetch === 'function' ? fetch : (await import('node-fetch')).default;

  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';

  console.log('Testing compare-by-source tool at:', baseUrl);
  console.log('Make sure your dev server is running (yarn dev)');
  console.log('Optional: Set TEST_WEBSITE_ID env var to test with real website ID');

  // Test the tool with different configurations
  const results = await Promise.all([
    testCompareBySource(fetchFn, baseUrl),
    testCompareBySourceWithCustomDates(fetchFn, baseUrl),
    testCompareBySourceWithWebsiteId(fetchFn, baseUrl),
  ]);

  console.log('\n=== Test Results Summary ===');
  console.log('compare-by-source (default):', results[0] ? '✅ PASSED' : '❌ FAILED');
  console.log('compare-by-source (custom dates):', results[1] ? '✅ PASSED' : '❌ FAILED');
  console.log('compare-by-source (with website ID):', results[2] ? '✅ PASSED' : '❌ FAILED');
}

run().catch(err => {
  console.error('Unexpected error running compare-by-source tests:', err);
  console.error('Hint: Ensure your dev server is running at http://localhost:3000 (yarn dev)');
  process.exit(1);
});
