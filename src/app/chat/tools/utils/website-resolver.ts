import prisma from '@/lib/prisma';
import { getActiveWebsiteId, setActiveWebsiteId } from '../../state';
import { DEFAULT_WEBSITE_ID } from '../../config';

/**
 * Resolves a website ID from various sources in order of priority:
 * 1. Explicitly provided websiteId
 * 2. Currently active website
 * 3. Valid DEFAULT_WEBSITE_ID (non-empty)
 * 4. First available website from database
 *
 * @param websiteIdInput - Optional explicit website ID
 * @returns Promise<string | null> - Resolved website ID or null if none available
 */
export async function resolveWebsiteId(websiteIdInput?: string): Promise<string | null> {
  // eslint-disable-next-line no-console
  console.log('resolveWebsiteId: Function called with input:', websiteIdInput);

  // 1. Use explicitly provided websiteId if available
  if (websiteIdInput) {
    // Handle the case where AI model passes literal template strings
    if (websiteIdInput === '${DEFAULT_WEBSITE_ID}') {
      // eslint-disable-next-line no-console
      console.log(
        'resolveWebsiteId: Received literal template string, ignoring and continuing to fallback',
      );
      // Don't return this literal string, continue to fallback options
    } else {
      // Validate that the input looks like a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(websiteIdInput)) {
        // eslint-disable-next-line no-console
        console.warn('resolveWebsiteId: Invalid UUID format provided:', websiteIdInput);
        // Don't return invalid input, continue to fallback options
      } else {
        // eslint-disable-next-line no-console
        console.log('resolveWebsiteId: Returning valid input websiteId:', websiteIdInput);
        return websiteIdInput;
      }
    }
  }

  // 2. Check for currently active website
  const active = getActiveWebsiteId();
  if (active) {
    // eslint-disable-next-line no-console
    console.log('resolveWebsiteId: Returning active website:', active);
    return active;
  }

  // 3. Only use DEFAULT_WEBSITE_ID if it's actually a valid UUID (non-empty)
  if (DEFAULT_WEBSITE_ID !== '') {
    // eslint-disable-next-line no-console
    console.log('resolveWebsiteId: Returning DEFAULT_WEBSITE_ID:', DEFAULT_WEBSITE_ID);
    return DEFAULT_WEBSITE_ID;
  }

  // eslint-disable-next-line no-console
  console.log('resolveWebsiteId: No valid websiteId found, falling back to database lookup');

  // 4. Fallback to database lookup - find first available website
  try {
    const first = await prisma.client.website.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    });

    if (first?.id) {
      setActiveWebsiteId(first.id);
      // eslint-disable-next-line no-console
      console.log('resolveWebsiteId: Found website from database:', first.id);
      return first.id;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('resolveWebsiteId: Database lookup failed:', error);
  }

  // eslint-disable-next-line no-console
  console.log('resolveWebsiteId: No website found, returning null');
  return null;
}
