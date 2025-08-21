// Test script for the detect-segment-shifts tool
// Usage: node scripts/test-segment-shifts.js

const {
  getDetectSegmentShiftsTool,
} = require('../src/app/chat/tools/anomaly-insights/get-detect-segment-shifts.ts');

async function testSegmentShiftsTool() {
  // eslint-disable-next-line no-console
  console.log('=== Testing detect-segment-shifts tool ===\n');

  try {
    // Test case 1: Basic functionality with default parameters
    // eslint-disable-next-line no-console
    console.log('Test 1: Basic functionality with default parameters');
    const params1 = {
      date_from: '2025-08-01',
      date_to: '2025-08-31',
      segment_by: ['country', 'device'],
      metric: 'visits',
      timezone: 'UTC',
      min_effect_size: 0.01,
      min_share: 0.05,
      min_support: 100,
      use_chi_square: false,
      normalize_labels: true,
    };

    // eslint-disable-next-line no-console
    console.log('Input params:', JSON.stringify(params1, null, 2));

    const result1 = await getDetectSegmentShiftsTool.execute(params1);

    // eslint-disable-next-line no-console
    console.log('✅ Tool executed successfully');
    // eslint-disable-next-line no-console
    console.log('Result structure:', {
      hasFindings: Array.isArray(result1.findings),
      findingsCount: result1.findings?.length || 0,
      hasSummary: typeof result1.summary === 'string',
      hasExtras: !!result1.extras,
      extrasCurrentCount: result1.extras?.current?.length || 0,
      extrasPreviousCount: result1.extras?.previous?.length || 0,
    });
    // eslint-disable-next-line no-console
    console.log('Summary:', result1.summary);
    // eslint-disable-next-line no-console
    console.log('Extras current (first 3):', result1.extras?.current?.slice(0, 3) || []);
    // eslint-disable-next-line no-console
    console.log('Extras previous (first 3):', result1.extras?.previous?.slice(0, 3) || []);
    // eslint-disable-next-line no-console
    console.log('');

    // Test case 2: Single segment
    // eslint-disable-next-line no-console
    console.log('Test 2: Single segment');
    const params2 = {
      date_from: '2025-08-01',
      date_to: '2025-08-31',
      segment_by: 'browser',
      metric: 'pageviews',
      min_effect_size: 0.02, // 2pp threshold
      use_chi_square: true,
    };

    // eslint-disable-next-line no-console
    console.log('Input params:', JSON.stringify(params2, null, 2));

    const result2 = await getDetectSegmentShiftsTool.execute(params2);

    // eslint-disable-next-line no-console
    console.log('✅ Tool executed successfully');
    // eslint-disable-next-line no-console
    console.log('Findings count:', result2.findings?.length || 0);
    // eslint-disable-next-line no-console
    console.log('Summary:', result2.summary);
    // eslint-disable-next-line no-console
    console.log('');

    // Test case 3: Very sensitive threshold
    // eslint-disable-next-line no-console
    console.log('Test 3: Very sensitive threshold (0.005 = 0.5pp)');
    const params3 = {
      date_from: '2025-08-01',
      date_to: '2025-08-31',
      segment_by: ['country', 'device', 'browser'],
      metric: 'visits',
      min_effect_size: 0.005, // 0.5pp threshold
      min_share: 0.01, // 1% minimum share
      min_support: 50, // Lower support threshold
    };

    // eslint-disable-next-line no-console
    console.log('Input params:', JSON.stringify(params3, null, 2));

    const result3 = await getDetectSegmentShiftsTool.execute(params3);

    // eslint-disable-next-line no-console
    console.log('✅ Tool executed successfully');
    // eslint-disable-next-line no-console
    console.log('Findings count:', result3.findings?.length || 0);
    // eslint-disable-next-line no-console
    console.log('Summary:', result3.summary);

    if (result3.findings && result3.findings.length > 0) {
      // eslint-disable-next-line no-console
      console.log('First finding:', {
        segment: result3.findings[0].segment_by,
        label: result3.findings[0].label,
        effect_size: `${(result3.findings[0].effect_size * 100).toFixed(2)}pp`,
        explanation: result3.findings[0].explanation,
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Tool failed:', error.message);
    // eslint-disable-next-line no-console
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testSegmentShiftsTool();
