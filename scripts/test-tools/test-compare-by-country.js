// Test runner for compare-by-country tool via API
// Usage: yarn test-tools

/* eslint-disable no-console */

async function testCompareByCountry(fetchFn, baseUrl) {
  const url = `${baseUrl}/api/tools/compare-by-country`;

  const params = {
    conversionEvent: 'purchase',
    currentFrom: '2025-08-01',
    currentTo: '2025-08-31',
    previousFrom: '2025-07-01',
    previousTo: '2025-07-31',
    minVisitors: 1,
    // websiteId: 'YOUR_WEBSITE_ID', // optional
  };

  console.log('\n=== Testing compare-by-country tool ===');
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
      console.log(`📊 Found ${data.data.length} countries`);

      // Log summary of results
      if (data.data.length > 0) {
        const increases = data.data.filter(item => item.change.direction === 'increase').length;
        const decreases = data.data.filter(item => item.change.direction === 'decrease').length;
        const noChange = data.data.filter(item => item.change.direction === 'no_change').length;

        console.log(`📈 Countries with increased conversion rate: ${increases}`);
        console.log(`📉 Countries with decreased conversion rate: ${decreases}`);
        console.log(`➡️ Countries with no significant change: ${noChange}`);

        // Show top performers
        const topPerformers = data.data
          .filter(item => item.change.direction === 'increase')
          .sort((a, b) => b.change.percentChange - a.change.percentChange)
          .slice(0, 3);

        if (topPerformers.length > 0) {
          console.log('\n🏆 Top performing countries:');
          topPerformers.forEach((country, index) => {
            console.log(
              `  ${index + 1}. ${country.country}: +${
                country.change.percentChange
              }% (${country.current.conversionRate.toFixed(
                4,
              )} vs ${country.previous.conversionRate.toFixed(4)})`,
            );
          });
        }

        // Show worst performers
        const worstPerformers = data.data
          .filter(item => item.change.direction === 'decrease')
          .sort((a, b) => a.change.percentChange - b.change.percentChange)
          .slice(0, 3);

        if (worstPerformers.length > 0) {
          console.log('\n⚠️ Countries with declining performance:');
          worstPerformers.forEach((country, index) => {
            console.log(
              `  ${index + 1}. ${country.country}: ${
                country.change.percentChange
              }% (${country.current.conversionRate.toFixed(
                4,
              )} vs ${country.previous.conversionRate.toFixed(4)})`,
            );
          });
        }

        // Show some sample data
        console.log('\n📋 Sample country data:');
        data.data.slice(0, 5).forEach((country, index) => {
          console.log(
            `  ${index + 1}. ${country.country}:`,
            `Current: ${country.current.conversionRate.toFixed(4)}% (${
              country.current.uniqueVisitors
            } visitors)`,
            `Previous: ${country.previous.conversionRate.toFixed(4)}% (${
              country.previous.uniqueVisitors
            } visitors)`,
            `Change: ${country.change.percentChange.toFixed(2)}% (${country.change.direction})`,
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
}

async function testCompareByCountryWithCustomDates(fetchFn, baseUrl) {
  const url = `${baseUrl}/api/tools/compare-by-country`;

  const params = {
    conversionEvent: 'signup',
    currentFrom: '2025-08-15',
    currentTo: '2025-08-31',
    previousFrom: '2025-07-15',
    previousTo: '2025-07-31',
    minVisitors: 3,
  };

  console.log('\n=== Testing compare-by-country tool with custom dates ===');
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

  try {
    const data = JSON.parse(text);
    if (data && Array.isArray(data.data)) {
      console.log(`✅ Found ${data.data.length} countries for custom date range`);

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

  return true;
}

async function testCompareByCountryWithDifferentEvents(fetchFn, baseUrl) {
  const url = `${baseUrl}/api/tools/compare-by-country`;
  const events = ['purchase', 'signup', 'checkout', 'subscription'];

  console.log('\n=== Testing compare-by-country tool with different events ===');

  for (const event of events) {
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
        console.log(`✅ Found ${data.data.length} countries for event: ${event}`);

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
  }

  return true;
}

module.exports = {
  testCompareByCountry,
  testCompareByCountryWithCustomDates,
  testCompareByCountryWithDifferentEvents,
};
