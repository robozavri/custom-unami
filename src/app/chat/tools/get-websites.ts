import { z } from 'zod';
import prisma from '@/lib/prisma';

const paramsSchema = z.object({});

export const getWebsitesTool = {
  name: 'get-websites',
  description: `
- Get a list of available websites with their IDs, names, and domains.
- This tool helps you see what websites are available before setting an active website.
- No parameters required.
- Returns: Array of websites with id, name, domain, and team information.
`.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    paramsSchema.parse(rawParams); // Validate but don't store unused params

    try {
      const websites = await prisma.client.website.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          domain: true,
          teamId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        websites: websites.map(website => ({
          id: website.id,
          name: website.name,
          domain: website.domain || 'No domain',
          teamId: website.teamId,
          createdAt: website.createdAt,
        })),
        count: websites.length,
        message:
          websites.length > 0
            ? `Found ${websites.length} website(s). Use set-active-website with one of these IDs.`
            : 'No websites found in the database.',
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching websites:', error);
      throw new Error(
        `Failed to fetch websites: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },
};

export type GetWebsitesTool = typeof getWebsitesTool;
