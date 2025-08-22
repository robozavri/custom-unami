/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
// const path = require('path');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Import all seed functions
const seedComprehensive = require('./seed-comprehensive');
const seedEvents = require('./seed-events');
const seedReturningEventUsers = require('./seed-returning-event-users');
const seedReturningEventUsersEnhanced = require('./seed-returning-event-users-enhanced');
const seedSegmentedEvents = require('./seed-segmented-events');
const seedCtr = require('./seed-ctr');
const seedRetentionDips = require('./seed-retention-dips');
const seedSegmentShifts = require('./seed-segment-shifts');
const seedPathDropoffs = require('./seed-path-dropoffs');
const seedAnomalyTimeseries = require('./seed-anomaly-timeseries');
const seedTimeseriesAnomaliesAdvanced = require('./seed-timeseries-anomalies-advanced');

// Configuration
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2024-07-01';
const DEFAULT_END_DATE = '2024-08-31';

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    switch (arg) {
      case '--website':
      case '--websiteId':
        params.websiteId = next;
        i++;
        break;
      case '--from':
      case '--start':
        params.startDate = next;
        i++;
        break;
      case '--to':
      case '--end':
        params.endDate = next;
        i++;
        break;
      case '--reset-range':
        params.resetRange = true;
        break;
      case '--skip':
        params.skipSeeds = next.split(',');
        i++;
        break;
      default:
        break;
    }
  }

  return {
    websiteId: params.websiteId || DEFAULT_WEBSITE_ID,
    startDate: params.startDate || DEFAULT_START_DATE,
    endDate: params.endDate || DEFAULT_END_DATE,
    resetRange: !!params.resetRange,
    skipSeeds: params.skipSeeds || [],
  };
}

async function ensureWebsite(websiteId) {
  const existing = await prisma.website.findUnique({ where: { id: websiteId } }).catch(() => null);
  if (existing) return existing;
  return prisma.website.create({
    data: { id: websiteId, name: 'All Seeds Test Website', domain: 'all-seeds-test.local' },
  });
}

async function runSeed(seedName, seedFunction, config) {
  console.log(`\n[seed-all] Running ${seedName}...`);
  const startTime = Date.now();

  try {
    await seedFunction.main(config);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[seed-all] ✅ ${seedName} completed successfully in ${duration}s`);
    return { success: true, duration };
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[seed-all] ❌ ${seedName} failed after ${duration}s:`, error.message);
    return { success: false, duration, error: error.message };
  }
}

async function main() {
  const config = parseArgs();
  console.log('[seed-all] Starting comprehensive test data generation...');
  console.log('[seed-all] Config:', config);

  await ensureWebsite(config.websiteId);

  // Define all seeds to run
  const seeds = [
    { name: 'comprehensive', func: seedComprehensive },
    { name: 'events', func: seedEvents },
    { name: 'returning-event-users', func: seedReturningEventUsers },
    { name: 'returning-event-users-enhanced', func: seedReturningEventUsersEnhanced },
    { name: 'segmented-events', func: seedSegmentedEvents },
    { name: 'ctr', func: seedCtr },
    { name: 'retention-dips', func: seedRetentionDips },
    { name: 'segment-shifts', func: seedSegmentShifts },
    { name: 'path-dropoffs', func: seedPathDropoffs },
    { name: 'anomaly-timeseries', func: seedAnomalyTimeseries },
    { name: 'timeseries-anomalies-advanced', func: seedTimeseriesAnomaliesAdvanced },
  ];

  // Filter out skipped seeds
  const seedsToRun = seeds.filter(seed => !config.skipSeeds.includes(seed.name));

  console.log(
    `[seed-all] Will run ${seedsToRun.length} seeds:`,
    seedsToRun.map(s => s.name).join(', '),
  );

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (const seed of seedsToRun) {
    const result = await runSeed(seed.name, seed.func, config);
    results.push({ name: seed.name, ...result });

    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('[seed-all] SEEDING COMPLETED - SUMMARY');
  console.log('='.repeat(80));

  console.log(`Total seeds: ${seedsToRun.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failureCount}`);

  if (successCount > 0) {
    console.log('\n✅ Successful seeds:');
    results
      .filter(r => r.success)
      .forEach(r => {
        console.log(`  - ${r.name}: ${r.duration}s`);
      });
  }

  if (failureCount > 0) {
    console.log('\n❌ Failed seeds:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
  }

  console.log('\n📊 Database now contains comprehensive test data for:');
  console.log(`  - Website ID: ${config.websiteId}`);
  console.log(`  - Date range: ${config.startDate} to ${config.endDate}`);
  console.log(`  - Multiple user behaviors and patterns`);
  console.log(`  - Various device types, countries, and traffic sources`);
  console.log(`  - Business events with realistic data`);
  console.log(`  - Anomalies and retention patterns`);

  if (failureCount === 0) {
    console.log(
      '\n🎉 All seeds completed successfully! Your database is ready for comprehensive testing.',
    );
  } else {
    console.log(
      `\n⚠️  ${failureCount} seed(s) failed. Check the errors above and consider re-running failed seeds individually.`,
    );
  }
}

if (require.main === module) {
  main()
    .catch(err => {
      console.error('[seed-all] Fatal error:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { main };
