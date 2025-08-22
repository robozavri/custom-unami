import prisma from '@/lib/prisma';
/* eslint-disable no-console */
export interface EventDropChainData {
  step: string;
  users: number;
  dropToNext: number | null;
  dropRate: number | null;
}

export async function getEventDropChainData(
  websiteId: string,
  steps: string[],
  fromDate: string,
  toDate: string,
  distinctBy: 'session_id' | 'visitor_id',
): Promise<EventDropChainData[]> {
  console.log('[check-event-drop-chain] Getting event drop chain data...');
  console.log('[check-event-drop-chain] Website ID:', websiteId);
  console.log('[check-event-drop-chain] Steps:', steps);
  console.log('[check-event-drop-chain] Date range:', fromDate, 'to', toDate);
  console.log('[check-event-drop-chain] Distinct by:', distinctBy);

  // For now, use Prisma directly since we're testing with PostgreSQL
  // TODO: Add proper database detection and routing
  return relationalQuery(websiteId, steps, fromDate, toDate, distinctBy);
}

async function relationalQuery(
  websiteId: string,
  steps: string[],
  fromDate: string,
  toDate: string,
  distinctBy: 'session_id' | 'visitor_id',
): Promise<EventDropChainData[]> {
  console.log('[check-event-drop-chain] Executing relational query...');

  try {
    const results: EventDropChainData[] = [];

    // For each step, count unique users who completed that step
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      let result: any;

      if (i === 0) {
        // First step: just count users who completed this event
        result = await prisma.rawQuery(
          `
          SELECT COUNT(DISTINCT e.${distinctBy}) AS users
          FROM website_event e
          WHERE e.website_id = {{websiteId::uuid}}
            AND e.event_name = {{eventName}}
            AND e.created_at BETWEEN {{fromDate::timestamp}} AND {{toDate::timestamp}}
          `,
          { websiteId, eventName: step, fromDate, toDate },
        );
      } else {
        // Subsequent steps: count users who completed this step AND all previous steps
        // For now, use a simpler approach - just count users who completed this step
        // TODO: Implement proper funnel logic with EXISTS subqueries
        result = await prisma.rawQuery(
          `
          SELECT COUNT(DISTINCT e.${distinctBy}) AS users
          FROM website_event e
          WHERE e.website_id = {{websiteId::uuid}}
            AND e.event_name = {{eventName}}
            AND e.created_at BETWEEN {{fromDate::timestamp}} AND {{toDate::timestamp}}
          `,
          { websiteId, eventName: step, fromDate, toDate },
        );
      }

      const users = Number(result[0]?.users || 0);

      console.log(`[check-event-drop-chain] Raw result for step ${step}:`, result);

      results.push({
        step,
        users,
        dropToNext: null,
        dropRate: null,
      });

      console.log(`[check-event-drop-chain] Step ${i + 1} (${step}): ${users} users`);
    }

    // Calculate drop-off metrics
    for (let i = 0; i < results.length - 1; i++) {
      const current = results[i];
      const next = results[i + 1];

      current.dropToNext = current.users - next.users;
      current.dropRate = current.users > 0 ? (current.dropToNext / current.users) * 100 : 0;

      console.log(
        `[check-event-drop-chain] Drop-off from ${current.step} to ${next.step}: ${
          current.dropToNext
        } users (${current.dropRate.toFixed(2)}%)`,
      );
    }

    console.log('[check-event-drop-chain] Final result:', results.length, 'steps');
    return results;
  } catch (error) {
    console.error('[check-event-drop-chain] Error getting event drop chain data:', error);
    throw error;
  }
}
