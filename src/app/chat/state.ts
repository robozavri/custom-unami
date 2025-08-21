// Simple in-memory state for the active website within the app server process.
// For multi-user isolation or persistence, replace with a per-session store (e.g., Redis keyed by authKey).

let activeWebsiteId: string | null = null;

export function getActiveWebsiteId(): string | null {
  return activeWebsiteId;
}

export function setActiveWebsiteId(websiteId: string | null) {
  activeWebsiteId = websiteId;
}

/**
 * Central function to get website ID for all tools.
 * Priority order:
 * 1. Explicitly provided websiteId
 * 2. Currently active website
 * 3. DEFAULT_WEBSITE_ID from config
 *
 * @param websiteIdInput - Optional explicit website ID
 * @returns Promise<string> - Always returns a valid website ID
 */
export async function getWebsiteId(websiteIdInput?: string): Promise<string> {
  // 1. Use explicitly provided websiteId if available and valid
  if (websiteIdInput) {
    // Handle the case where AI model passes literal template strings
    if (websiteIdInput === '${DEFAULT_WEBSITE_ID}') {
      // eslint-disable-next-line no-console
      console.log(
        'getWebsiteId: Received literal template string, ignoring and continuing to fallback',
      );
      // Don't return this literal string, continue to fallback options
    } else {
      // Validate that the input looks like a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(websiteIdInput)) {
        // eslint-disable-next-line no-console
        console.log('getWebsiteId: Returning valid input websiteId:', websiteIdInput);
        return websiteIdInput;
      } else {
        // eslint-disable-next-line no-console
        console.warn('getWebsiteId: Invalid UUID format provided:', websiteIdInput);
        // Don't return invalid input, continue to fallback options
      }
    }
  }

  // 2. Check for currently active website
  const active = getActiveWebsiteId();
  if (active) {
    // eslint-disable-next-line no-console
    console.log('getWebsiteId: Returning active website:', active);
    return active;
  }

  // 3. Use DEFAULT_WEBSITE_ID from config
  // eslint-disable-next-line no-console
  console.log('getWebsiteId: Returning DEFAULT_WEBSITE_ID');
  return '5801af32-ebe2-4273-9e58-89de8971a2fd';
}
