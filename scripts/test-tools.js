// Test runner for chat tools via API
// Usage: yarn test-tools

/* eslint-disable no-console */

async function run() {
  // Use global fetch if available (Node >=18), otherwise dynamically import node-fetch (ESM)
  const fetchFn = typeof fetch === 'function' ? fetch : (await import('node-fetch')).default;

  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
  // Hit direct tool endpoint to bypass LLM
  const url = process.env.TEST_URL || `${baseUrl}/api/tools/get-detailed-page-views`;

  // Adjust dates as needed
  const params = {
    days: 7,
    date_from: '2025-08-01',
    date_to: '2025-08-31',
    // websiteId: 'YOUR_WEBSITE_ID', // optional
  };

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
    process.exit(1);
  }

  console.log('\n--- JSON Response ---');
  console.log(text);
}

run().catch(err => {
  console.error('Unexpected error running test-tools:', err);
  console.error('Hint: Ensure your dev server is running at http://localhost:3000 (yarn dev)');
  process.exit(1);
});
