// const {
//   getDetectTimeseriesAnomaliesTool,
// } = require('../src/app/chat/tools/anomaly-insights/get-detect-timeseries-anomalies.ts');

async function testAnomalyTool() {
  try {
    // console.log('Testing anomaly tool with default website ID...');
    // const params = {
    //   metric: 'visits',
    //   date_from: '2025-01-01',
    //   date_to: '2025-01-31',
    //   interval: 'day',
    //   sensitivity: 'medium',
    // };
    // console.log('Input params:', params);
    // const result = await getDetectTimeseriesAnomaliesTool.execute(params);
    // console.log('✅ Tool executed successfully:', {
    //   hasAnomalies: Array.isArray(result.anomalies),
    //   anomalyCount: result.anomalies?.length || 0,
    //   hasSeries: Array.isArray(result.series),
    //   seriesCount: result.series?.length || 0,
    // });
  } catch (error) {
    // console.error('❌ Tool failed:', error.message);
  }
}

testAnomalyTool();
