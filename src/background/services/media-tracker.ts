// ============================================================================
// MEDIA TRACKER SERVICE
// Tracks tabs that have media elements (even if paused/muted)
// ============================================================================

const tabsWithMedia = new Set<number>();
const tabsPlayingMedia = new Set<number>();

// Persist media state to session storage so it survives service worker suspension
function saveMediaState(): void {
  try {
    chrome.storage.session.set({
      tabsWithMedia: Array.from(tabsWithMedia),
      tabsPlayingMedia: Array.from(tabsPlayingMedia),
    });
  } catch (e) {
    // Session storage might fail in some environments
  }
}

export async function loadTabsWithMedia(): Promise<void> {
  try {
    const data = await chrome.storage.session.get([
      "tabsWithMedia",
      "tabsPlayingMedia",
    ]);
    if (data.tabsWithMedia && Array.isArray(data.tabsWithMedia)) {
      data.tabsWithMedia.forEach((id: number) => tabsWithMedia.add(id));
    }
    if (data.tabsPlayingMedia && Array.isArray(data.tabsPlayingMedia)) {
      data.tabsPlayingMedia.forEach((id: number) => tabsPlayingMedia.add(id));
    }
  } catch (e) {
    // Ignore
  }
}

export function hasMedia(tabId: number): boolean {
  return tabsWithMedia.has(tabId);
}

export function isMediaPlaying(tabId: number): boolean {
  return tabsPlayingMedia.has(tabId);
}

export function addMediaTab(tabId: number): void {
  if (!tabsWithMedia.has(tabId)) {
    tabsWithMedia.add(tabId);
    saveMediaState();
    console.debug(`[MEDIA] Tab ${tabId} marked as having media`);
  }
}

export function reportMediaState(
  tabId: number,
  state: { hasMedia?: boolean; isPlaying?: boolean },
): void {
  let hasChanged = false;

  if (state.hasMedia) {
    if (!tabsWithMedia.has(tabId)) {
      tabsWithMedia.add(tabId);
      hasChanged = true;
      console.debug(`[MEDIA] Tab ${tabId} marked as having media`);
    }
  }

  if (typeof state.isPlaying === "boolean") {
    if (state.isPlaying) {
      if (!tabsPlayingMedia.has(tabId)) {
        tabsPlayingMedia.add(tabId);
        hasChanged = true;
      }
    } else if (tabsPlayingMedia.delete(tabId)) {
      hasChanged = true;
    }
  }

  if (hasChanged) {
    saveMediaState();
  }
}

export function removeMediaTab(tabId: number): void {
  const removedMedia = tabsWithMedia.delete(tabId);
  const removedPlayback = tabsPlayingMedia.delete(tabId);

  if (removedMedia || removedPlayback) {
    saveMediaState();
  }
}

// Also query currently audible tabs on startup
export async function initializeAudibleTabs(): Promise<void> {
  try {
    const audibleTabs = await chrome.tabs.query({ audible: true });
    for (const tab of audibleTabs) {
      if (tab.id && !tabsWithMedia.has(tab.id)) {
        tabsWithMedia.add(tab.id);
      }
    }
    // Also add tabs that are muted (they had audio at some point)
    const allTabs = await chrome.tabs.query({});
    for (const tab of allTabs) {
      if (tab.id && tab.mutedInfo?.muted && !tabsWithMedia.has(tab.id)) {
        tabsWithMedia.add(tab.id);
      }
    }
    if (tabsWithMedia.size > 0) {
      saveMediaState();
      console.log(`[MEDIA] Initialized ${tabsWithMedia.size} tabs with media`);
    }
  } catch (e) {
    console.debug("[MEDIA] Error initializing audible tabs:", e);
  }
}




