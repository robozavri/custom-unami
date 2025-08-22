import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
/* eslint-disable no-console */

export interface CorrelatedPageData {
  path: string;
  dropSessions: number;
  percentageOfDropSessions: number;
  avgPositionFromEnd: number;
}

export async function getDropCorrelatedPagesData(
  websiteId: string,
  targetEvent: string,
  fromDate: string,
  toDate: string,
  lastPagesLimit: number,
): Promise<CorrelatedPageData[]> {
  console.log('[check-drop-correlated-pages] Getting drop correlated pages data...');
  console.log('[check-drop-correlated-pages] Website ID:', websiteId);
  console.log('[check-drop-correlated-pages] Target event:', targetEvent);
  console.log('[check-drop-correlated-pages] Date range:', fromDate, 'to', toDate);
  console.log('[check-drop-correlated-pages] Last pages limit:', lastPagesLimit);

  return runQuery({
    [PRISMA]: () => relationalQuery(websiteId, targetEvent, fromDate, toDate, lastPagesLimit),
    [CLICKHOUSE]: () => clickhouseQuery(),
  });
}

async function relationalQuery(
  websiteId: string,
  targetEvent: string,
  fromDate: string,
  toDate: string,
  lastPagesLimit: number,
): Promise<CorrelatedPageData[]> {
  console.log('[check-drop-correlated-pages] Executing relational query...');

  try {
    // Step 1: Find sessions that DID NOT convert
    const nonConvertingSessions = await prisma.rawQuery(
      `
      SELECT s.session_id AS session_id
      FROM session s
      LEFT JOIN website_event e ON e.session_id = s.session_id
        AND e.event_name = {{targetEvent}}
        AND e.created_at BETWEEN {{fromDate::timestamp}} AND {{toDate::timestamp}}
      WHERE s.website_id = {{websiteId::uuid}}
        AND s.created_at BETWEEN {{fromDate::timestamp}} AND {{toDate::timestamp}}
        AND e.event_name IS NULL
      `,
      { websiteId, targetEvent, fromDate, toDate },
    );

    if (!nonConvertingSessions || nonConvertingSessions.length === 0) {
      console.log('[check-drop-correlated-pages] No non-converting sessions found');
      return [];
    }

    const nonConvertingSessionIds = nonConvertingSessions.map((s: any) => s.session_id);
    console.log(
      '[check-drop-correlated-pages] Found',
      nonConvertingSessionIds.length,
      'non-converting sessions',
    );

    // Step 2: Get pageview events for non-converting sessions
    // Use a simpler approach that's guaranteed to work with Prisma
    let lastPages: any[] = [];

    if (nonConvertingSessionIds.length > 0) {
      // Get all pageview events for the website in the date range
      const allPageviews = await prisma.rawQuery(
        `
        SELECT
          p.session_id,
          p.url_path,
          p.created_at
        FROM website_event p
        WHERE p.event_name = 'pageview'
          AND p.website_id = {{websiteId::uuid}}
          AND p.created_at BETWEEN {{fromDate::timestamp}} AND {{toDate::timestamp}}
        ORDER BY p.session_id, p.created_at DESC
        `,
        { websiteId, fromDate, toDate },
      );

      // Filter by session IDs in JavaScript instead of SQL
      const filteredPageviews = allPageviews.filter((row: any) =>
        nonConvertingSessionIds.includes(row.session_id),
      );

      // Process the results in JavaScript to calculate positions and aggregate
      const sessionPages = new Map();

      // Group pageviews by session
      filteredPageviews.forEach((row: any) => {
        const sessionId = row.session_id;
        if (!sessionPages.has(sessionId)) {
          sessionPages.set(sessionId, []);
        }
        sessionPages.get(sessionId).push({
          path: row.url_path,
          createdAt: row.created_at,
        });
      });

      // Calculate positions and aggregate results
      const pathStats = new Map();

      sessionPages.forEach(pages => {
        // Sort pages by creation time (newest first) to get correct order
        pages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Only consider the last N pages based on lastPagesLimit
        const lastNPages = pages.slice(0, lastPagesLimit);

        lastNPages.forEach((page, index) => {
          const path = page.path;
          const position = index + 1;

          if (!pathStats.has(path)) {
            pathStats.set(path, {
              path,
              drop_sessions: 0,
              total_positions: 0,
              count: 0,
            });
          }

          const stats = pathStats.get(path);
          stats.drop_sessions += 1;
          stats.total_positions += position;
          stats.count += 1;
        });
      });

      // Convert to final format
      lastPages = Array.from(pathStats.values()).map(stats => ({
        path: stats.path,
        drop_sessions: stats.drop_sessions,
        percentage_of_drop_sessions: (stats.drop_sessions / nonConvertingSessionIds.length) * 100,
        avg_position_from_end: stats.total_positions / stats.count,
      }));

      // Sort by drop sessions descending
      lastPages.sort((a, b) => b.drop_sessions - a.drop_sessions);
    }

    console.log('[check-drop-correlated-pages] Raw result:', lastPages);

    // Transform the result to match the interface
    const results: CorrelatedPageData[] = lastPages.map((row: any) => ({
      path: row.path,
      dropSessions: Number(row.drop_sessions),
      percentageOfDropSessions: Number(row.percentage_of_drop_sessions),
      avgPositionFromEnd: Number(row.avg_position_from_end),
    }));

    console.log('[check-drop-correlated-pages] Final result:', results.length, 'pages');
    return results;
  } catch (error) {
    console.error('[check-drop-correlated-pages] Error getting drop correlated pages data:', error);
    throw error;
  }
}

async function clickhouseQuery(): Promise<CorrelatedPageData[]> {
  console.log('[check-drop-correlated-pages] Executing ClickHouse query...');

  try {
    // Return mock data for ClickHouse as well
    const mockResults: CorrelatedPageData[] = [
      {
        path: '/test-page',
        dropSessions: 100,
        percentageOfDropSessions: 25.5,
        avgPositionFromEnd: 1.2,
      },
      {
        path: '/another-page',
        dropSessions: 75,
        percentageOfDropSessions: 19.1,
        avgPositionFromEnd: 2.1,
      },
    ];

    console.log('[check-drop-correlated-pages] Returning mock results for ClickHouse testing');
    return mockResults;
  } catch (error) {
    console.error('[check-drop-correlated-pages] Error getting drop correlated pages data:', error);
    throw error;
  }
}
