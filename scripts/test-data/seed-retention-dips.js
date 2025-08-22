/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

// Import enhanced constants for realistic data
const {
  // COUNTRIES,
  // DEVICES,
  PATHS,
  UTM_SOURCES,
  UTM_MEDIUMS,
  UTM_CAMPAIGNS,
  pickRandomDevice,
  pickRandomBrowser,
  pickRandomCountry,
  pickFrom,
} = require('./seed-constants');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Config (can be overridden via CLI flags)
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2025-07-01'; // YYYY-MM-DD
const DEFAULT_END_DATE = '2025-08-30'; // YYYY-MM-DD
const DEFAULT_COHORT_SIZE = 200; // users per cohort
const DEFAULT_ANOMALY_COHORT = '2025-07-15'; // specific cohort with retention dip

// Retention patterns (k=0 is cohort size, k≥1 is retention rate)
const RETENTION_PATTERNS = {
  baseline: {
    k0: 1.0, // 100% of cohort users active in first period
    k1: 0.35, // 35% retention at k=1
    k2: 0.25, // 25% retention at k=2
    k3: 0.18, // 18% retention at k=3
    k4: 0.14, // 14% retention at k=4
    k5: 0.12, // 12% retention at k=5
    k6: 0.1, // 10% retention at k=6
    k7: 0.09, // 9% retention at k=7
    k8: 0.08, // 8% retention at k=8
  },
  anomaly: {
    k0: 1.0, // 100% of cohort users active in first period
    k1: 0.2, // 20% retention at k=1 (vs 35% baseline) - DIP!
    k2: 0.15, // 15% retention at k=2 (vs 25% baseline) - DIP!
    k3: 0.12, // 12% retention at k=3 (vs 18% baseline) - DIP!
    k4: 0.1, // 10% retention at k=4 (vs 14% baseline) - DIP!
    k5: 0.08, // 8% retention at k=5 (vs 12% baseline) - DIP!
    k6: 0.07, // 7% retention at k=6 (vs 10% baseline) - DIP!
    k7: 0.06, // 6% retention at k=7 (vs 9% baseline) - DIP!
    k8: 0.05, // 5% retention at k=8 (vs 8% baseline) - DIP!
  },
};

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
      case '--cohort-size':
        params.cohortSize = Number(next);
        i++;
        break;
      case '--anomaly-cohort':
        params.anomalyCohort = next;
        i++;
        break;
      case '--reset-range':
        params.resetRange = true;
        break;
      default:
        break;
    }
  }

  return {
    websiteId: params.websiteId || DEFAULT_WEBSITE_ID,
    startDate: params.startDate || DEFAULT_START_DATE,
    endDate: params.endDate || DEFAULT_END_DATE,
    cohortSize: Number.isFinite(params.cohortSize) ? params.cohortSize : DEFAULT_COHORT_SIZE,
    anomalyCohort: params.anomalyCohort || DEFAULT_ANOMALY_COHORT,
    resetRange: params.resetRange || false,
  };
}

function generateCohortData(cohortDate, isAnomaly = false) {
  const pattern = isAnomaly ? RETENTION_PATTERNS.anomaly : RETENTION_PATTERNS.baseline;
  const cohortStart = new Date(cohortDate);

  const data = [];

  // Generate data for each k (offset period)
  for (let k = 0; k <= 8; k++) {
    const retentionRate = pattern[`k${k}`];
    const activeUsers = Math.round(DEFAULT_COHORT_SIZE * retentionRate);

    if (activeUsers > 0) {
      // Calculate the date for this k period
      const periodDate = new Date(cohortStart);
      periodDate.setDate(periodDate.getDate() + k * 7); // Weekly periods

      // Generate individual user events for this period
      for (let user = 0; user < activeUsers; user++) {
        const userId = randomUUID();
        const sessionId = randomUUID();

        // Create session
        data.push({
          type: 'session',
          sessionId,
          userId,
          websiteId: DEFAULT_WEBSITE_ID,
          cohortDate: cohortStart,
          periodDate,
          k,
          retentionRate,
          activeUsers,
        });

        // Create website event
        data.push({
          type: 'event',
          sessionId,
          userId,
          websiteId: DEFAULT_WEBSITE_ID,
          eventDate: periodDate,
          cohortDate: cohortStart,
          k,
          retentionRate,
          activeUsers,
        });
      }
    }
  }

  return data;
}

function generateWeeklyCohorts(startDate, endDate) {
  const cohorts = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Generate weekly cohorts from start to end
  let current = new Date(start);
  while (current <= end) {
    const cohortDate = new Date(current);
    const isAnomaly = cohortDate.toISOString().split('T')[0] === DEFAULT_ANOMALY_COHORT;

    cohorts.push({
      date: cohortDate.toISOString().split('T')[0],
      isAnomaly,
      data: generateCohortData(cohortDate, isAnomaly),
    });

    // Move to next week
    current.setDate(current.getDate() + 7);
  }

  return cohorts;
}

async function cleanupRange(startDate, endDate) {
  console.log(`🧹 Cleaning up data from ${startDate} to ${endDate}...`);

  try {
    // Delete in chronological order of dependencies
    await prisma.eventData.deleteMany({
      where: {
        websiteEvent: {
          website_id: DEFAULT_WEBSITE_ID,
          created_at: {
            gte: new Date(startDate),
            lte: new Date(endDate + 'T23:59:59.999Z'),
          },
        },
      },
    });

    await prisma.sessionData.deleteMany({
      where: {
        session: {
          website_id: DEFAULT_WEBSITE_ID,
          created_at: {
            gte: new Date(startDate),
            lte: new Date(endDate + 'T23:59:59.999Z'),
          },
        },
      },
    });

    // Delete website events first (they reference sessions)
    await prisma.websiteEvent.deleteMany({
      where: {
        website_id: DEFAULT_WEBSITE_ID,
        created_at: {
          gte: new Date(startDate),
          lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      },
    });

    // Then delete sessions
    await prisma.session.deleteMany({
      where: {
        website_id: DEFAULT_WEBSITE_ID,
        created_at: {
          gte: new Date(startDate),
          lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      },
    });

    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    throw error;
  }
}

async function seedCohorts(cohorts) {
  console.log(`🌱 Seeding ${cohorts.length} cohorts...`);

  let totalSessions = 0;
  let totalEvents = 0;

  for (const cohort of cohorts) {
    console.log(`  📅 Cohort ${cohort.date} (${cohort.isAnomaly ? 'ANOMALY' : 'baseline'})`);

    const sessions = new Map();
    const events = [];

    // Group data by session
    for (const item of cohort.data) {
      if (item.type === 'session') {
        const deviceInfo = pickRandomDevice();
        const countryInfo = pickRandomCountry();
        const browserInfo = pickRandomBrowser(deviceInfo.type);

        sessions.set(item.sessionId, {
          id: item.sessionId,
          websiteId: DEFAULT_WEBSITE_ID,
          createdAt: item.periodDate,
          country: countryInfo.code,
          device: deviceInfo.type,
          browser: browserInfo.browser,
          os: deviceInfo.os,
          screen: deviceInfo.screen,
          language: 'en-US',
          region: countryInfo.region,
          city: countryInfo.city,
        });
      } else if (item.type === 'event') {
        const utmSource = pickFrom(UTM_SOURCES);
        const utmMedium = pickFrom(UTM_MEDIUMS);
        const utmCampaign = pickFrom(UTM_CAMPAIGNS);
        const path = pickFrom(PATHS);

        events.push({
          id: randomUUID(),
          websiteId: DEFAULT_WEBSITE_ID,
          sessionId: item.sessionId,
          visitId: item.sessionId,
          eventType: 1, // pageview
          urlPath: path,
          pageTitle: path === '/home' ? 'Home' : path.slice(1).toUpperCase(),
          referrerDomain: utmSource === 'direct' ? null : `${utmSource}.example.com`,
          utmSource: utmSource === 'direct' ? null : utmSource,
          utmMedium: utmSource === 'direct' ? null : utmMedium,
          utmCampaign: utmSource === 'direct' ? null : utmCampaign,
          createdAt: item.eventDate,
        });
      }
    }

    // Create sessions
    if (sessions.size > 0) {
      await prisma.session.createMany({
        data: Array.from(sessions.values()),
        skipDuplicates: true,
      });
      totalSessions += sessions.size;
    }

    // Create events
    if (events.length > 0) {
      await prisma.websiteEvent.createMany({
        data: events,
        skipDuplicates: true,
      });
      totalEvents += events.length;
    }

    console.log(`    ✅ ${sessions.size} sessions, ${events.length} events`);
  }

  console.log(`\n🎉 Seeding completed:`);
  console.log(`   📊 Total cohorts: ${cohorts.length}`);
  console.log(`   👥 Total sessions: ${totalSessions}`);
  console.log(`   📝 Total events: ${totalEvents}`);

  return { totalSessions, totalEvents };
}

async function main() {
  const config = parseArgs();

  console.log('🚀 Retention Dips Seed Script');
  console.log('==============================');
  console.log(`Website ID: ${config.websiteId}`);
  console.log(`Date range: ${config.startDate} to ${config.endDate}`);
  console.log(`Cohort size: ${config.cohortSize} users`);
  console.log(`Anomaly cohort: ${config.anomalyCohort}`);
  console.log(`Reset range: ${config.resetRange}`);
  console.log('');

  try {
    // Cleanup if requested
    if (config.resetRange) {
      await cleanupRange(config.startDate, config.endDate);
    }

    // Generate cohorts
    const cohorts = generateWeeklyCohorts(config.startDate, config.endDate);
    console.log(`📅 Generated ${cohorts.length} weekly cohorts`);

    // Show cohort details
    for (const cohort of cohorts) {
      const anomalyFlag = cohort.isAnomaly ? '🚨 ANOMALY' : '✅ Normal';
      console.log(`  ${anomalyFlag} ${cohort.date}: ${cohort.data.length} data points`);
    }

    console.log('');

    // Seed the data
    await seedCohorts(cohorts);

    console.log('');
    console.log('🎯 Expected Anomalies:');
    console.log(`   📉 Cohort ${config.anomalyCohort} should show retention dips:`);
    console.log(`      k=1: 20% vs 35% baseline (-15pp)`);
    console.log(`      k=2: 15% vs 25% baseline (-10pp)`);
    console.log(`      k=3: 12% vs 18% baseline (-6pp)`);
    console.log('');
    console.log('🧪 Test the tool with:');
    console.log(`   date_from: "${config.startDate}"`);
    console.log(`   date_to: "${config.endDate}"`);
    console.log(`   period: "week"`);
    console.log(`   max_k: 8`);
    console.log(`   min_effect_size: 0.05`);
    console.log(`   sensitivity: "medium"`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, generateCohorts: generateWeeklyCohorts };
