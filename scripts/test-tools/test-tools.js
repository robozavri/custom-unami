// Test runner for chat tools via API
// Usage: yarn test-tools

/* eslint-disable no-console */

async function testGetDetailedPageViews(fetchFn, baseUrl) {
  const url = `${baseUrl}/api/tools/get-detailed-page-views`;

  const params = {
    days: 7,
    date_from: '2025-08-01',
    date_to: '2025-08-31',
    // websiteId: 'YOUR_WEBSITE_ID', // optional
  };

  console.log('\n=== Testing get-detailed-page-views tool ===');
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
  return true;
}

async function testGetWebStatistic(fetchFn, baseUrl) {
  const url = `${baseUrl}/api/tools/get-web-statistic`;

  const params = {
    period: 'custom',
    custom_days: 31,
    date_from: '2025-08-01',
    date_to: '2025-08-31',
    // websiteId: 'YOUR_WEBSITE_ID', // optional
  };

  console.log('\n=== Testing get-web-statistic tool ===');
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
  return true;
}

async function testCompareBySource(fetchFn, baseUrl) {
  const url = `${baseUrl}/api/tools/compare-by-source`;

  const params = {
    conversionEvent: 'purchase',
    currentFrom: '2025-01-01',
    currentTo: '2025-01-31',
    previousFrom: '2024-12-01',
    previousTo: '2024-12-31',
    minVisitors: 10,
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
  return true;
}

// async function testDashboardStats(fetchFn, baseUrl) {
//   // We need a website ID to test the dashboard stats
//   // For now, let's test with a sample website ID or get it from the tool response
//   const websiteId = 'sample-website-id'; // This would need to be a real website ID

//   const url = `${baseUrl}/api/websites/${websiteId}/stats`;

//   // Use the same date range as the tool test
//   const startAt = Math.floor(new Date('2025-08-01').getTime());
//   const endAt = Math.floor(new Date('2025-08-31').getTime());

//   const params = {
//     startAt,
//     endAt,
//   };

//   console.log('\n=== Testing Dashboard Stats API ===');
//   console.log('GET', url);
//   console.log('Params:', JSON.stringify(params, null, 2));

//   try {
//     const res = await fetchFn(url, {
//       method: 'GET',
//       headers: { 'Content-Type': 'application/json' },
//     });

//     if (!res.ok) {
//       console.log('Dashboard stats request failed:', res.status, res.statusText);
//       console.log('This is expected if not authenticated or website ID is invalid');
//       return false;
//     }

//     const text = await res.text();
//     console.log('\n--- Dashboard Stats Response ---');
//     console.log(text);
//     return true;
//   } catch (error) {
//     console.log('Dashboard stats request error:', error.message);
//     console.log('This is expected if not authenticated or website ID is invalid');
//     return false;
//   }
// }

async function run() {
  // Use global fetch if available (Node >=18), otherwise dynamically import node-fetch (ESM)
  const fetchFn = typeof fetch === 'function' ? fetch : (await import('node-fetch')).default;

  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';

  console.log('Testing tools at:', baseUrl);
  console.log('Make sure your dev server is running (yarn dev)');

  // Test all tools
  const results = await Promise.all([
    testGetDetailedPageViews(fetchFn, baseUrl),
    testGetWebStatistic(fetchFn, baseUrl),
    testCompareBySource(fetchFn, baseUrl),
    // testDashboardStats(fetchFn, baseUrl), // Skip dashboard test for now
  ]);

  console.log('\n=== Test Results Summary ===');
  console.log('get-detailed-page-views:', results[0] ? '✅ PASSED' : '❌ FAILED');
  console.log('get-web-statistic:', results[1] ? '✅ PASSED' : '❌ FAILED');
  console.log('compare-by-source:', results[2] ? '✅ PASSED' : '❌ FAILED');
  // console.log('dashboard-stats:', results[3] ? '✅ PASSED' : '❌ FAILED');
}

run().catch(err => {
  console.error('Unexpected error running test-tools:', err);
  console.error('Hint: Ensure your dev server is running at http://localhost:3000 (yarn dev)');
  process.exit(1);
});
