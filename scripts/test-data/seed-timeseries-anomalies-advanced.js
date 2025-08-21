/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient({ errorFormat: 'pretty' });

// Defaults
const DEFAULT_WEBSITE_ID = '5801af32-ebe2-4273-9e58-89de8971a2fd';
const DEFAULT_START_DATE = '2024-01-01';
const DEFAULT_DAYS = 21; // ensures >= 3 weeks and >= 8 data points
const DEFAULT_INTERVAL = 'day'; // hour | day | week
const DEFAULT_METRIC = 'pageviews'; // visits | pageviews | bounce_rate | visit_duration
const DEFAULT_ANOMALY_INDEX = 10; // index within the series (hour or day)
// const DEFAULT_DIRECTION = 'spike'; // spike | dip
const DEFAULT_MAGNITUDE = 2.0; // multiplier applied to the anomaly bucket

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
      case '--days':
        params.days = Number(next);
        i++;
        break;
      case '--interval':
        params.interval = next;
        i++;
        break;
      case '--metric':
        params.metric = next;
        i++;
        break;
      case '--anomaly-index':
        params.anomalyIndex = Number(next);
        i++;
        break;
      case '--direction':
        params.direction = next;
        i++;
        break;
      case '--magnitude':
        params.magnitude = Number(next);
        i++;
        break;
      case '--reset-range':
        params.resetRange = true;
        break;
      default:
        break;
    }
  }

  const interval = params.interval || DEFAULT_INTERVAL;

  return {
    websiteId: params.websiteId || DEFAULT_WEBSITE_ID,
    startDate: params.startDate || DEFAULT_START_DATE,
    days: Number.isFinite(params.days) ? params.days : DEFAULT_DAYS,
    interval,
    metric: params.metric || DEFAULT_METRIC,
    anomalyIndex: Number.isFinite(params.anomalyIndex)
      ? params.anomalyIndex
      : DEFAULT_ANOMALY_INDEX,
    direction: params.direction === 'dip' ? 'dip' : 'spike',
    magnitude:
      Number.isFinite(params.magnitude) && params.magnitude > 0
        ? params.magnitude
        : DEFAULT_MAGNITUDE,
    resetRange: !!params.resetRange,
  };
}

function toDateOnlyString(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addHours(date, hours) {
  const d = new Date(date);
  d.setUTCHours(d.getUTCHours() + hours);
  return d;
}

function pickInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function ensureWebsite(websiteId) {
  const existing = await prisma.website.findUnique({ where: { id: websiteId } }).catch(() => null);
  if (existing) return existing;
  return prisma.website.create({
    data: {
      id: websiteId,
      name: 'Timeseries Anomaly Test',
      domain: 'timeseries-anomaly.local',
    },
  });
}

async function cleanupRange(websiteId, start, end) {
  await prisma.eventData.deleteMany({
    where: { websiteId, createdAt: { gte: start, lt: end } },
  });
  await prisma.sessionData.deleteMany({
    where: { websiteId, createdAt: { gte: start, lt: end } },
  });
  await prisma.websiteEvent.deleteMany({
    where: { websiteId, createdAt: { gte: start, lt: end } },
  });
  await prisma.session.deleteMany({
    where: { websiteId, createdAt: { gte: start, lt: end } },
  });
}

// Build a plan for one bucket (hour or day) that controls the chosen metric
function buildBucketPlan({ bucketIndex, metric, direction, magnitude, anomalyIndex }) {
  // Baselines
  const baselineVisits = pickInt(30, 50);
  const baselinePvPerVisit = 2; // average
  const baselinePageviews = Math.max(
    baselineVisits,
    Math.round(baselineVisits * baselinePvPerVisit),
  );
  const baselineBounceRate = 0.35; // 35%
  const baselineAvgDurationSec = 180; // 3 minutes

  const isAnomaly = bucketIndex === anomalyIndex;

  let visits = baselineVisits;
  let pageviews = baselinePageviews;
  let targetBounceRate = baselineBounceRate;
  let targetAvgDurationSec = baselineAvgDurationSec;

  if (isAnomaly) {
    if (metric === 'visits') {
      visits = Math.max(
        3,
        Math.round(visits * (direction === 'spike' ? magnitude : 1 / magnitude)),
      );
      // keep pv/visit similar
      pageviews = Math.max(visits, Math.round(visits * baselinePvPerVisit));
    } else if (metric === 'pageviews') {
      pageviews = Math.max(
        visits,
        Math.round(pageviews * (direction === 'spike' ? magnitude : 1 / magnitude)),
      );
    } else if (metric === 'bounce_rate') {
      const factor = direction === 'spike' ? magnitude : 1 / magnitude;
      targetBounceRate = Math.min(0.95, Math.max(0.05, baselineBounceRate * factor));
      pageviews = Math.max(visits, Math.round(visits * baselinePvPerVisit));
    } else if (metric === 'visit_duration') {
      const factor = direction === 'spike' ? magnitude : 1 / magnitude;
      targetAvgDurationSec = Math.min(
        3600,
        Math.max(10, Math.round(baselineAvgDurationSec * factor)),
      );
      pageviews = Math.max(visits, Math.round(visits * baselinePvPerVisit));
    }
  }

  return { visits, pageviews, targetBounceRate, targetAvgDurationSec, isAnomaly };
}

// Seed one bucket worth of data
async function seedBucket({ websiteId, bucketStartUtc, interval, plan }) {
  // Sessions
  const sessions = Array.from({ length: plan.visits }).map(() => ({
    id: randomUUID(),
    websiteId,
    createdAt: new Date(
      bucketStartUtc.getTime() +
        (interval === 'hour' ? pickInt(0, 59) : pickInt(0, 23) * 3600 * 1000),
    ),
  }));

  // Persist sessions
  if (sessions.length > 0) {
    await prisma.$transaction(
      sessions.map(s =>
        prisma.session.create({
          data: { id: s.id, websiteId: s.websiteId, createdAt: s.createdAt },
        }),
      ),
      { timeout: 60000 },
    );
  }

  // Determine bounce vs non-bounce sessions
  const bounceSessionsCount = Math.min(
    sessions.length,
    Math.round(sessions.length * plan.targetBounceRate),
  );

  const shuffled = [...sessions].sort(() => Math.random() - 0.5);
  const bounceSessions = new Set(shuffled.slice(0, bounceSessionsCount).map(s => s.id));

  // We aim to reach total pageviews ~ plan.pageviews by distributing across sessions
  let remaining = Math.max(plan.pageviews, sessions.length); // at least one PV per session
  const events = [];

  for (let si = 0; si < sessions.length; si++) {
    const session = sessions[si];
    const isBounce = bounceSessions.has(session.id);

    // Decide number of pageviews for this session
    let viewsForSession;
    if (isBounce) {
      viewsForSession = 1;
    } else {
      // spread to achieve average duration and total count
      const maxViews = plan.targetAvgDurationSec > 240 ? 6 : 4;
      viewsForSession = Math.min(maxViews, pickInt(2, maxViews));
    }

    // Do not exceed remaining too much; allow small variance
    const views = Math.max(1, Math.min(viewsForSession, remaining));
    remaining -= views;

    // Build timestamps inside the bucket
    const bucketMillis = interval === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const startOffset = pickInt(0, Math.max(0, bucketMillis - 1));
    const sessionStart = new Date(bucketStartUtc.getTime() + startOffset);

    // If targeting duration, spread last view accordingly
    const sessionDuration = isBounce
      ? 0
      : pickInt(
          Math.max(30, Math.round(plan.targetAvgDurationSec * 0.7)),
          Math.round(plan.targetAvgDurationSec * 1.3),
        ) * 1000;

    const endCandidate = new Date(sessionStart.getTime() + sessionDuration);
    const lastEventTime = new Date(
      Math.min(bucketStartUtc.getTime() + bucketMillis - 1, endCandidate.getTime()),
    );

    for (let i = 0; i < views; i++) {
      const t = new Date(
        sessionStart.getTime() +
          Math.round(
            ((lastEventTime.getTime() - sessionStart.getTime()) * i) / Math.max(1, views - 1),
          ),
      );
      events.push({
        id: randomUUID(),
        websiteId,
        sessionId: session.id,
        visitId: session.id,
        createdAt: t,
        urlPath: i % 2 === 0 ? '/' : '/products',
        eventType: 1,
      });
    }
  }

  // If we still have remaining due to rounding, distribute 1 PV per session in round-robin
  let si = 0;
  while (remaining > 0 && sessions.length > 0) {
    const session = sessions[si % sessions.length];
    const t = new Date(
      bucketStartUtc.getTime() +
        pickInt(0, interval === 'hour' ? 59 : 23) *
          (interval === 'hour' ? 60 * 1000 : 60 * 60 * 1000),
    );
    events.push({
      id: randomUUID(),
      websiteId,
      sessionId: session.id,
      visitId: session.id,
      createdAt: t,
      urlPath: '/extra',
      eventType: 1,
    });
    remaining--;
    si++;
  }

  // Persist events in batches
  const BATCH = 500;
  for (let i = 0; i < events.length; i += BATCH) {
    const chunk = events.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map(e =>
        prisma.websiteEvent.create({
          data: {
            id: e.id,
            websiteId: e.websiteId,
            sessionId: e.sessionId,
            visitId: e.visitId,
            createdAt: e.createdAt,
            urlPath: e.urlPath,
            eventType: e.eventType,
          },
        }),
      ),
      { timeout: 120000 },
    );
  }

  return { sessions: sessions.length, events: events.length };
}

async function main() {
  const cfg = parseArgs();

  console.log('[seed-advanced] config', cfg);
  await ensureWebsite(cfg.websiteId);

  const start = new Date(`${cfg.startDate}T00:00:00.000Z`);
  const end = addDays(start, cfg.days);

  if (cfg.resetRange) {
    console.log('[seed-advanced] cleaning up existing data in range');
    await cleanupRange(cfg.websiteId, start, end);
  }

  let totalSessions = 0;
  let totalEvents = 0;

  if (cfg.interval === 'hour') {
    const hoursTotal = cfg.days * 24;
    for (let hi = 0; hi < hoursTotal; hi++) {
      const bucketStartUtc = addHours(start, hi);
      const plan = buildBucketPlan({
        bucketIndex: hi,
        metric: cfg.metric,
        direction: cfg.direction,
        magnitude: cfg.magnitude,
        anomalyIndex: cfg.anomalyIndex,
      });
      const { sessions, events } = await seedBucket({
        websiteId: cfg.websiteId,
        bucketStartUtc,
        interval: 'hour',
        plan,
      });
      totalSessions += sessions;
      totalEvents += events;
      console.log(
        `[seed-advanced][hour] ${bucketStartUtc
          .toISOString()
          .slice(0, 13)}:00 sessions=${sessions} events=${events}` +
          (plan.isAnomaly ? ' (ANOMALY)' : ''),
      );
    }
  } else {
    for (let di = 0; di < cfg.days; di++) {
      const bucketStartUtc = addDays(start, di);
      const plan = buildBucketPlan({
        bucketIndex: di,
        metric: cfg.metric,
        direction: cfg.direction,
        magnitude: cfg.magnitude,
        anomalyIndex: cfg.anomalyIndex,
      });
      const { sessions, events } = await seedBucket({
        websiteId: cfg.websiteId,
        bucketStartUtc,
        interval: 'day',
        plan,
      });
      totalSessions += sessions;
      totalEvents += events;
      console.log(
        `[seed-advanced][day] ${toDateOnlyString(
          bucketStartUtc,
        )} sessions=${sessions} events=${events}` + (plan.isAnomaly ? ' (ANOMALY)' : ''),
      );
    }
  }

  console.log('[seed-advanced] done', { totalSessions, totalEvents });
  const dateTo = toDateOnlyString(addDays(start, cfg.days - 1));
  console.log(
    '\nNext: run the tool with parameters like:',
    `\n{"metric":"${cfg.metric}","interval":"${cfg.interval}","date_from":"${cfg.startDate}","date_to":"${dateTo}","websiteId":"${cfg.websiteId}","sensitivity":"medium"}`,
  );
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
