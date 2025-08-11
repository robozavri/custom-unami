// Simple in-memory state for the active website within the app server process.
// For multi-user isolation or persistence, replace with a per-session store (e.g., Redis keyed by authKey).

let activeWebsiteId: string | null = null;

export function getActiveWebsiteId(): string | null {
  return activeWebsiteId;
}

export function setActiveWebsiteId(websiteId: string | null) {
  activeWebsiteId = websiteId;
}
