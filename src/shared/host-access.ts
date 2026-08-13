// ============================================================================
// BROAD HOST ACCESS (optional, opt-in)
// ============================================================================
// Tab Flow works with no host permission at all: `activeTab` covers the tab the
// user invoked the switcher from, which is enough to draw the overlay and grab
// that tab's preview. Two features need more than that:
//
//   - Previews for tabs other than the invoked one. captureVisibleTab can only
//     ever photograph the *visible* tab of a window, so broad access does not
//     let us read background tabs — it lets us capture each tab as it becomes
//     active, so previews accumulate as the user moves around.
//   - Media controls on tabs the user has not invoked from. Play/pause needs
//     the content script in the target tab, and activeTab does not extend there.
//
// It is requested from the options page because chrome.permissions.request
// requires a user gesture, which a commands/service-worker context lacks.
// ============================================================================

export const BROAD_HOST_ORIGIN = "*://*/*";

export async function hasBroadHostAccess(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: [BROAD_HOST_ORIGIN] });
  } catch {
    return false;
  }
}

// Must be called directly from a user gesture handler — do not await anything
// before this, or Chrome rejects the request.
export async function requestBroadHostAccess(): Promise<boolean> {
  try {
    return await chrome.permissions.request({ origins: [BROAD_HOST_ORIGIN] });
  } catch (error) {
    console.warn("[PERMISSIONS] Host access request failed:", error);
    return false;
  }
}

export async function revokeBroadHostAccess(): Promise<boolean> {
  try {
    return await chrome.permissions.remove({ origins: [BROAD_HOST_ORIGIN] });
  } catch (error) {
    console.warn("[PERMISSIONS] Host access revoke failed:", error);
    return false;
  }
}

// ----------------------------------------------------------------------------
// Cached view, for hot paths that cannot await (e.g. the tabs.onActivated
// listener, which fires on every tab switch).
// ----------------------------------------------------------------------------

let cachedAccess = false;

export function hasBroadHostAccessSync(): boolean {
  return cachedAccess;
}

export async function trackBroadHostAccess(): Promise<void> {
  cachedAccess = await hasBroadHostAccess();

  const refresh = () => {
    void hasBroadHostAccess().then((granted) => {
      cachedAccess = granted;
    });
  };

  chrome.permissions.onAdded.addListener(refresh);
  chrome.permissions.onRemoved.addListener(refresh);
}
