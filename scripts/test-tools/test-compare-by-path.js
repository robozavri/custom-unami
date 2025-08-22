// Test runner for compare-by-path tool via API
// Usage: yarn test-tools

/* eslint-disable no-console */

async function testCompareByPath(fetchFn, baseUrl) {
  const url = `${baseUrl}/api/tools/compare-by-path`;

  const params = {
    conversionEvent: 'purchase',
    currentFrom: '2025-08-01',
    currentTo: '2025-08-31',
    previousFrom: '2025-07-01',
    previousTo: '2025-07-31',
    minVisitors: 1,
    // websiteId: 'YOUR_WEBSITE_ID', // optional
  };

  console.log('\n=== Testing compare-by-path tool ===');
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
      }
    } else {
      console.log('⚠️ Response structure unexpected - data array not found');
    }
  } catch (parseError) {
    console.log('⚠️ Could not parse response as JSON:', parseError.message);
  }

  return true;
}

async function testCompareByPathWithCustomDates(fetchFn, baseUrl) {
  const url = `${baseUrl}/api/tools/compare-by-path`;

  // Test with different date ranges
  const params = {
    conversionEvent: 'signup',
    currentFrom: '2025-08-01',
    currentTo: '2025-08-31',
    previousFrom: '2025-07-01',
    previousTo: '2025-07-31',
    minVisitors: 5,
    // websiteId: 'YOUR_WEBSITE_ID', // optional
  };

  console.log('\n=== Testing compare-by-path tool with custom dates ===');
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
      console.log(`📊 Found ${data.data.length} page paths with minVisitors >= 5`);

      // Log summary of results
      if (data.data.length > 0) {
        const increases = data.data.filter(item => item.change.direction === 'increase').length;
        const decreases = data.data.filter(item => item.change.direction === 'decrease').length;
        const noChange = data.data.filter(item => item.change.direction === 'no_change').length;

        console.log(`📈 Paths with increased conversion rate: ${increases}`);
        console.log(`📉 Paths with decreased conversion rate: ${decreases}`);
        console.log(`➡️ Paths with no significant change: ${noChange}`);

        // Show paths with highest traffic
        const highTrafficPaths = data.data
          .sort((a, b) => b.current.uniqueVisitors - a.current.uniqueVisitors)
          .slice(0, 5);

        if (highTrafficPaths.length > 0) {
          console.log('\n🚀 High traffic paths:');
          highTrafficPaths.forEach((path, index) => {
            console.log(
              `  ${index + 1}. ${path.path}: ${path.current.uniqueVisitors} visitors, ${
                path.current.conversionRate
              }% conversion rate`,
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

async function testCompareByPathWithDifferentEvents(fetchFn, baseUrl) {
  const url = `${baseUrl}/api/tools/compare-by-path`;

  // Test with different conversion events
  const events = ['purchase', 'signup', 'checkout', 'subscription'];

  for (const event of events) {
    const params = {
      conversionEvent: event,
      currentFrom: '2025-08-01',
      currentTo: '2025-08-31',
      previousFrom: '2025-07-01',
      previousTo: '2025-07-31',
      minVisitors: 3,
    };

    console.log(`\n=== Testing compare-by-path tool with event: ${event} ===`);
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
      continue;
    }

    try {
      const data = JSON.parse(text);
      if (data && Array.isArray(data.data)) {
        console.log(`✅ Found ${data.data.length} paths for event: ${event}`);

        if (data.data.length > 0) {
          const increases = data.data.filter(item => item.change.direction === 'increase').length;
          const decreases = data.data.filter(item => item.change.direction === 'decrease').length;
          console.log(`📈 Increases: ${increases}, 📉 Decreases: ${decreases}`);
        }
      }
    } catch (parseError) {
      console.log('⚠️ Could not parse response as JSON:', parseError.message);
    }
  }

  return true;
}

module.exports = {
  testCompareByPath,
  testCompareByPathWithCustomDates,
  testCompareByPathWithDifferentEvents,
};
