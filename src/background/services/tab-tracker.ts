// ============================================================================
// TAB TRACKER SERVICE
// Orders tabs by how recently they were used.
// ============================================================================

// Chrome populates `lastAccessed` on every tab (121+, which manifest.json
// pins via minimum_chrome_version). It is strictly better than anything this
// extension could track itself: it survives service-worker suspension and
// browser restarts for free, and needs no storage writes on tab activation.
//
// This module used to also keep a persisted `recentTabOrder` array as a
// fallback. That fallback was unreachable — the lastAccessed comparison below
// returns first for any pair of real tabs — so it was pure cost: a debounced
// chrome.storage.local write on every tab switch, plus a storage read and a
// full tabs.query on first open, to build an ordering nothing consumed.
export function sortTabsByRecent<T extends chrome.tabs.Tab>(tabs: T[]): T[] {
  return [...tabs].sort((a, b) => {
    const aLastAccessed = a.lastAccessed ?? 0;
    const bLastAccessed = b.lastAccessed ?? 0;

    // Higher (more recent) first.
    if (aLastAccessed !== bLastAccessed) {
      return bLastAccessed - aLastAccessed;
    }

    // Only reachable for tabs Chrome never stamped; fall back to tab strip
    // position, where a higher index is the more recently opened tab.
    return (b.index ?? 0) - (a.index ?? 0);
  });
}
