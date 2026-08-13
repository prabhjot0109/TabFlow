// ============================================================================
// Background Service Worker for Visual Tab Flow
// ============================================================================
// PERFORMANCE-OPTIMIZED IMPLEMENTATION (MODULAR)
// Target: <100ms overlay open, <50MB with 100 tabs, 60fps animations
// ============================================================================

import { PERF_CONFIG } from "./config";
import { LRUCache } from "./cache/lru-cache";
import { perfMetrics } from "./utils/performance";
import * as mediaTracker from "./services/media-tracker";
import * as tabTracker from "./services/tab-tracker";
import * as screenshot from "./services/screenshot";
import {
  buildFlowPayload,
  buildQuickSwitchPayload,
} from "./services/tab-data";
import { handleMessage, sendMessageWithRetry } from "./handlers/messages";
import { getCenteredPopupBounds } from "../shared/panel";
import {
  hasBroadHostAccessSync,
  trackBroadHostAccess,
} from "../shared/host-access";
import type { Group, Tab } from "../shared/types";

const DEBUG_LOGGING = false;
const log = (...args: unknown[]) => {
  if (DEBUG_LOGGING) {
    console.log(...args);
  }
};

// ============================================================================
// GLOBAL STATE
// ============================================================================

const screenshotCache = new LRUCache(
  PERF_CONFIG.MAX_CACHED_TABS,
  PERF_CONFIG.MAX_CACHE_BYTES,
);
const SCREENSHOT_PROFILE_VERSION = 2;

// Track the popup window ID to avoid duplicates
let FlowPopupWindowId: number | null = null;

// ============================================================================
// POPUP WINDOW FALLBACK (for protected pages)
// ============================================================================

async function openFlowPopup(
  tabsData: Tab[],
  groupsData: Group[],
  activeTabId: number,
): Promise<void> {
  try {
    // Check if popup already exists and is still open
    if (FlowPopupWindowId !== null) {
      try {
        const existingWindow = await chrome.windows.get(FlowPopupWindowId);
        if (existingWindow) {
          // Focus the existing popup
          await chrome.windows.update(FlowPopupWindowId, { focused: true });

          // If the popup is already open, treat repeated command as cycle-next
          log("[POPUP] Sending FlowPopupCycleNext message");
          try {
            // Send message to all extension contexts (popup will receive it)
            chrome.runtime.sendMessage({ action: "FlowPopupCycleNext" });
          } catch (err) {
            log("[POPUP] Message send error:", err);
          }
          return;
        }
      } catch {
        // Window no longer exists, proceed to create new one
        FlowPopupWindowId = null;
      }
    }

    // Store tab data in session storage for the popup to retrieve
    await chrome.storage.session.set({
      FlowTabData: {
        tabs: tabsData,
        groups: groupsData,
        activeTabId: activeTabId,
      },
    });

    // Get the current window to position the popup
    const currentWindow = await chrome.windows.getCurrent();
    const popupBounds = getCenteredPopupBounds(currentWindow);

    // Create popup window
    const popupWindow = await chrome.windows.create({
      url: chrome.runtime.getURL("src/flow/index.html"),
      type: "popup",
      width: popupBounds.width,
      height: popupBounds.height,
      left: popupBounds.left,
      top: popupBounds.top,
      focused: true,
    });

    if (popupWindow?.id) {
      FlowPopupWindowId = popupWindow.id;

      // Listen for window close to reset the ID
      const handleWindowRemoved = (windowId: number) => {
        if (windowId === FlowPopupWindowId) {
          FlowPopupWindowId = null;
          chrome.windows.onRemoved.removeListener(handleWindowRemoved);
        }
      };
      chrome.windows.onRemoved.addListener(handleWindowRemoved);
    }

    log("[POPUP] Flow popup window created");
  } catch (error) {
    console.error("[POPUP] Failed to create Flow popup:", error);
  }
}

// Track the quick switch popup window ID to avoid duplicates
let QuickSwitchPopupWindowId: number | null = null;

async function openQuickSwitchPopup(
  tabsData: Tab[],
  groupsData: Group[],
  activeTabId: number,
): Promise<void> {
  try {
    // Check if popup already exists and is still open
    if (QuickSwitchPopupWindowId !== null) {
      try {
        const existingWindow = await chrome.windows.get(
          QuickSwitchPopupWindowId,
        );
        if (existingWindow) {
          // Focus the existing popup
          await chrome.windows.update(QuickSwitchPopupWindowId, {
            focused: true,
          });

          // If the popup is already open, treat repeated command as cycle-next
          log("[QUICK SWITCH] Sending QuickSwitchPopupCycleNext message");
          try {
            chrome.runtime.sendMessage({ action: "QuickSwitchPopupCycleNext" });
          } catch (err) {
            log("[QUICK SWITCH] Message send error:", err);
          }
          return;
        }
      } catch {
        // Window no longer exists, proceed to create new one
        QuickSwitchPopupWindowId = null;
      }
    }

    // Store tab data in session storage for the popup to retrieve
    await chrome.storage.session.set({
      QuickSwitchTabData: {
        tabs: tabsData,
        groups: groupsData,
        activeTabId: activeTabId,
      },
    });

    // Get the current window to position the popup
    const currentWindow = await chrome.windows.getCurrent();
    const popupBounds = getCenteredPopupBounds(currentWindow);

    // Create popup window with quick switch page
    const popupWindow = await chrome.windows.create({
      url: chrome.runtime.getURL("src/quick-switch/index.html"),
      type: "popup",
      width: popupBounds.width,
      height: popupBounds.height,
      left: popupBounds.left,
      top: popupBounds.top,
      focused: true,
    });

    if (popupWindow?.id) {
      QuickSwitchPopupWindowId = popupWindow.id;

      // Listen for window close to reset the ID
      const handleWindowRemoved = (windowId: number) => {
        if (windowId === QuickSwitchPopupWindowId) {
          QuickSwitchPopupWindowId = null;
          chrome.windows.onRemoved.removeListener(handleWindowRemoved);
        }
      };
      chrome.windows.onRemoved.addListener(handleWindowRemoved);
    }

    log("[POPUP] Quick Switch popup window created");
  } catch (error) {
    console.error("[POPUP] Failed to create Quick Switch popup:", error);
  }
}

async function tryCycleOpenQuickSwitchOverlay(tabId: number): Promise<boolean> {
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 80));
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, { action: "quickSwitchCycleIfOpen" }),
      timeout,
    ]);
    return !!(response as { advanced?: boolean } | null)?.advanced;
  } catch {
    return false;
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initialize(): Promise<void> {
  log("═══════════════════════════════════════════════════════");
  log("Visual Tab Flow - Performance Optimized (Modular)");
  log("═══════════════════════════════════════════════════════");
  log(
    `Cache: Max ${PERF_CONFIG.MAX_CACHED_TABS} tabs, ${(
      PERF_CONFIG.MAX_CACHE_BYTES /
      1024 /
      1024
    ).toFixed(2)}MB`,
  );
  log(`Rate Limit: 1 capture per ${PERF_CONFIG.THROTTLE_INTERVAL}ms`);
  log(`Target: <100ms overlay open, <50MB memory, 60fps`);
  log("═══════════════════════════════════════════════════════");

  await loadCacheSettings();
  await refreshScreenshotCacheIfProfileChanged();
  await trackBroadHostAccess();

  // Load persisted data
  await mediaTracker.loadTabsWithMedia();
  await screenshot.loadQualityTierFromStorage();

  // Initialize tabs after a short delay
  setTimeout(async () => {
    await tabTracker.initializeExistingTabs();
    await mediaTracker.initializeAudibleTabs();
  }, 100);
}

// Capture the tab the user just invoked the switcher from. A keyboard command
// (or action click) grants `activeTab` for the current tab, which is all
// `captureVisibleTab` needs — no broad host permission required. This is the
// only place captures originate: previews are refreshed when you open the
// switcher while on a tab, never silently in the background.
//
// The capture is awaited and taken with `immediate` (no settle delay) so it
// happens BEFORE the overlay is drawn over the page — otherwise the screenshot
// would include our own overlay. It returns instantly when the cache is still
// fresh, so repeated opens stay fast.
async function captureInvokedTab(tab: chrome.tabs.Tab): Promise<void> {
  if (typeof tab.id !== "number" || !screenshot.isTabCapturable(tab)) {
    return;
  }
  try {
    await screenshot.captureTabScreenshot(tab.id, screenshotCache, null, {
      immediate: true,
    });
  } catch (error) {
    console.debug("[CAPTURE] Failed to capture invoked tab:", error);
  }
}

// Capturing as tabs are activated is what populates previews beyond the single
// tab the switcher was invoked from — captureVisibleTab can only ever photograph
// the foreground tab, so this is the only way coverage accumulates. A plain tab
// switch is not a user invocation, so it needs broad host access and stays a
// no-op until the user opts in from the options page.
const ACTIVATION_CAPTURE_DELAY = 400;
let activationCaptureTimer: ReturnType<typeof setTimeout> | null = null;
let pendingActivationTabId: number | null = null;

function scheduleActivationCapture(tabId: number): void {
  if (!hasBroadHostAccessSync()) return;

  // Only the tab the user settles on is worth a capture; cycling past a dozen
  // tabs should not spend a dozen slots.
  pendingActivationTabId = tabId;
  if (activationCaptureTimer) clearTimeout(activationCaptureTimer);

  activationCaptureTimer = setTimeout(() => {
    activationCaptureTimer = null;
    const target = pendingActivationTabId;
    pendingActivationTabId = null;
    if (target !== null) void captureActivatedTab(target);
  }, ACTIVATION_CAPTURE_DELAY);
}

async function captureActivatedTab(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active || !screenshot.isTabCapturable(tab)) return;

    // A recent preview is good enough; don't spend quota re-shooting it.
    if (screenshotCache.isFresh(tabId, PERF_CONFIG.SCREENSHOT_CACHE_DURATION)) {
      return;
    }

    await screenshot.captureTabScreenshot(tabId, screenshotCache);
  } catch (error) {
    console.debug("[CAPTURE] Activation capture skipped:", error);
  }
}

async function refreshScreenshotCacheIfProfileChanged(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(["screenshotProfileVersion"]);
    const storedVersion =
      typeof result.screenshotProfileVersion === "number"
        ? result.screenshotProfileVersion
        : 0;

    if (storedVersion >= SCREENSHOT_PROFILE_VERSION) {
      return;
    }

    screenshotCache.clear();
    await chrome.storage.local.set({
      screenshotProfileVersion: SCREENSHOT_PROFILE_VERSION,
    });
  } catch (error) {
    console.warn("[CACHE] Failed to refresh screenshot cache profile:", error);
  }
}

async function loadCacheSettings(): Promise<void> {
  try {
    const result = await chrome.storage.local.get([
      "cacheMaxTabs",
      "cacheMaxMB",
    ]);

    const maxTabs =
      typeof result.cacheMaxTabs === "number"
        ? result.cacheMaxTabs
        : PERF_CONFIG.MAX_CACHED_TABS;

    const maxMB =
      typeof result.cacheMaxMB === "number"
        ? result.cacheMaxMB
        : PERF_CONFIG.MAX_CACHE_BYTES / 1024 / 1024;

    await screenshotCache.ready;
    screenshotCache.resize(maxTabs, Math.round(maxMB * 1024 * 1024));
    log(`[CACHE] Limits set to ${maxTabs} tabs, ${Math.round(maxMB)}MB total`);
  } catch (error) {
    console.warn("[CACHE] Failed to load cache settings:", error);
  }
}

// ============================================================================
// TAB EVENT LISTENERS
// ============================================================================

if (typeof chrome !== "undefined" && chrome.tabs) {
  // Listen for tab activation — track recency only. Screenshots cannot be
  // captured here (a plain tab switch is not a user invocation, so the
  // extension has no access to the page); captures happen at invocation time
  // instead. See captureInvokedTab.
  chrome.tabs.onActivated.addListener(
    (activeInfo: chrome.tabs.OnActivatedInfo) => {
      try {
        tabTracker.updateRecentTabOrder(activeInfo.tabId);
        scheduleActivationCapture(activeInfo.tabId);
      } catch (e) {
        console.debug("[TAB] Error in onActivated:", e);
      }
    },
  );

  // Listen for tab updates
  chrome.tabs.onUpdated.addListener(
    (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
      try {
        if (changeInfo.status === "loading") {
          mediaTracker.removeMediaTab(tabId);
        }

        // Track audible state in both directions. Only handling the `true`
        // edge left tabs pinned as "playing" forever once their audio stopped,
        // because nothing else clears the flag for tabs without a content
        // script. `hasMedia` stays sticky on the way down — a silent tab still
        // has a media element worth offering controls for.
        if (changeInfo.audible !== undefined) {
          mediaTracker.reportMediaState(tabId, {
            hasMedia: changeInfo.audible,
            isPlaying: changeInfo.audible,
          });
        }
      } catch (e) {
        console.debug("[TAB] Error in onUpdated:", e);
      }
    },
  );

  // Track when tabs are created
  chrome.tabs.onCreated.addListener((tab: chrome.tabs.Tab) => {
    try {
      if (tab.id) tabTracker.setTabOpenTime(tab.id);
    } catch (e) {
      console.debug("[TAB] Error in onCreated:", e);
    }
  });

  // Clean up when tabs are closed
  chrome.tabs.onRemoved.addListener((tabId: number) => {
    try {
      screenshotCache.delete(tabId);
      tabTracker.removeFromRecentOrder(tabId);
      tabTracker.removeTabOpenOrder(tabId);
      mediaTracker.removeMediaTab(tabId);
      console.debug(`[CLEANUP] Removed tab ${tabId} from cache`);
    } catch (e) {
      console.debug("[TAB] Error in onRemoved:", e);
    }
  });
} else {
  console.error("[INIT] chrome.tabs API not available");
}

// ============================================================================
// COMMAND HANDLER
// ============================================================================

if (typeof chrome !== "undefined" && chrome.commands) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === "show-tab-flow" || command === "cycle-next-tab") {
      handleShowTabFlow();
    } else if (command === "quick-switch") {
      handleQuickSwitch();
    }
  });
}

// Handle showing the Tab Flow - OPTIMIZED FOR <100ms
async function handleShowTabFlow(): Promise<void> {
  // Ensure cache is ready — cap the wait so a slow IndexedDB can't hang startup.
  if (screenshotCache.ready) {
    await Promise.race([
      screenshotCache.ready,
      new Promise<void>((resolve) => setTimeout(resolve, 300)),
    ]);
  }
  // Restore recent tab order in the background; don't block the overlay on it.
  // Tabs will fall back to Chrome's lastAccessed ordering if restoration is still
  // in progress when buildFlowPayload runs — same behaviour as Quick Switch.
  if (!tabTracker.isRecentOrderRestored()) {
    tabTracker.restoreRecentOrder().catch((err) => {
      console.debug("[TAB FLOW] Failed to restore recent order:", err);
    });
  }

  const startTime = performance.now();

  try {
    // If the protected-page fallback popup is currently focused, the command
    // should cycle selection inside that popup (matching the in-page overlay
    // behavior) instead of attempting to inject into the popup tab.
    try {
      const currentWindow = await chrome.windows.getCurrent();
      const [currentActiveTab] = await chrome.tabs.query({
        active: true,
        windowId: currentWindow.id,
      });

      const FlowUrl = chrome.runtime.getURL("src/flow/index.html");
      if (
        currentWindow?.type === "popup" &&
        currentActiveTab?.url === FlowUrl
      ) {
        chrome.runtime.sendMessage({ action: "FlowPopupCycleNext" });
        return;
      }
    } catch {
      // Ignore detection errors and proceed with normal flow
    }

    const currentWindow = await chrome.windows.getCurrent();
    if (typeof currentWindow.id !== "number") {
      console.warn("[INJECT] No current window ID found");
      return;
    }

    // Get active tab first so we can capture its clean preview BEFORE the
    // overlay is drawn over the page (otherwise the screenshot includes the
    // overlay) and before we build the payload, so the payload carries it.
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!activeTab || typeof activeTab.id !== "number") {
      console.warn("[INJECT] No active tab found to open overlay");
      return;
    }

    const capturable = screenshot.isTabCapturable(activeTab);
    if (capturable) {
      await captureInvokedTab(activeTab);
    }

    const { tabs: tabsData, groups: groupsData } = await buildFlowPayload(
      currentWindow.id,
      screenshotCache,
      { recordCacheMetrics: true },
    );

    if (!capturable) {
      console.log(
        "[INJECT] Protected page detected, opening popup window fallback...",
      );
      // Open popup window for protected pages
      await openFlowPopup(tabsData, groupsData, activeTab.id);
      return;
    }

    let delivered = false;
    try {
      delivered = await sendMessageWithRetry(activeTab.id, {
        action: "showTabFlow",
        tabs: tabsData,
        groups: groupsData,
        activeTabId: activeTab.id,
      });
    } catch (error) {
      console.error("[ERROR] Failed to send Tab Flow message:", error);
    }

    if (!delivered) {
      console.warn(
        "[INJECT] Content script unavailable. Falling back to popup window.",
      );
      await openFlowPopup(tabsData, groupsData, activeTab.id);
      return;
    }

    const duration = performance.now() - startTime;
    perfMetrics.recordOverlayOpen(duration);
  } catch (error) {
    console.error("[ERROR] Failed to show Tab Flow:", error);
  }
}

// Handle Quick Switch (Alt+Q) - Alt+Tab style switching without search
async function handleQuickSwitch(): Promise<void> {
  // FAST PATH: If Quick Switch popup already exists, cycle selection and return
  if (QuickSwitchPopupWindowId !== null) {
    try {
      const existingWindow = await chrome.windows.get(QuickSwitchPopupWindowId);
      if (existingWindow) {
        // Focus the existing popup
        await chrome.windows.update(QuickSwitchPopupWindowId, {
          focused: true,
        });
        // Cycle to next tab
        console.log("[QUICK SWITCH] Popup exists, sending cycle message");
        try {
          chrome.runtime.sendMessage({ action: "QuickSwitchPopupCycleNext" });
        } catch (err) {
          console.log("[QUICK SWITCH] Message send error:", err);
        }
        return;
      }
    } catch {
      // Window no longer exists, clear the ID and continue
      QuickSwitchPopupWindowId = null;
    }
  }

  // FAST PATH: If currently focused on quick switch popup, cycle and return.
  try {
    const currentWindow = await chrome.windows.getCurrent();
    const QuickSwitchUrl = chrome.runtime.getURL("src/quick-switch/index.html");
    const [currentActiveTab] = await chrome.tabs.query({
      active: true,
      windowId: currentWindow.id,
    });

    if (
      currentWindow?.type === "popup" &&
      currentActiveTab?.url?.startsWith(QuickSwitchUrl.split("?")[0])
    ) {
      // We're in the quick switch popup, just cycle
      console.log("[QUICK SWITCH] Inside popup, sending cycle message");
      chrome.runtime.sendMessage({ action: "QuickSwitchPopupCycleNext" });
      return;
    }
  } catch {
    // Ignore detection errors and proceed with normal flow
  }

  try {
    const currentWindow = await chrome.windows.getCurrent();

    // Resolve active tab first for cheap cycle checks.
    const [activeTab] = await chrome.tabs.query({
      active: true,
      windowId: currentWindow.id,
    });

    if (!activeTab || typeof activeTab.id !== "number") {
      console.warn("[QUICK SWITCH] No active tab found");
      return;
    }

    // FAST PATH: If quick switch overlay is already open in page, cycle without
    // rebuilding tab data.
    if (screenshot.isTabCapturable(activeTab)) {
      const cycled = await tryCycleOpenQuickSwitchOverlay(activeTab.id);
      if (cycled) {
        return;
      }
    }

    // The command invocation grants activeTab for this tab, so refresh its
    // preview now — awaited and taken before the overlay is drawn so the
    // overlay isn't captured. Returns instantly when the cache is fresh.
    if (screenshot.isTabCapturable(activeTab)) {
      await captureInvokedTab(activeTab);
    }

    // Restore recent order asynchronously. Quick switch can open immediately
    // with Chrome's lastAccessed sorting while restoration catches up.
    if (!tabTracker.isRecentOrderRestored()) {
      tabTracker.restoreRecentOrder().catch((error) => {
        console.debug(
          "[QUICK SWITCH] Failed to restore recent order in background:",
          error,
        );
      });
    }

    if (typeof currentWindow.id !== "number") {
      console.warn("[QUICK SWITCH] No current window ID found");
      return;
    }

    const { tabs: tabsData, groups: groupsData } = await buildQuickSwitchPayload(
      currentWindow.id,
      screenshotCache,
    );

    // For protected pages, open popup window fallback that runs the same
    // quick-switch overlay behavior as injected pages.
    if (!screenshot.isTabCapturable(activeTab)) {
      console.log("[QUICK SWITCH] Protected page, opening popup window");
      await openQuickSwitchPopup(tabsData, groupsData, activeTab.id);
      return;
    }

    let delivered = false;
    try {
      delivered = await sendMessageWithRetry(activeTab.id, {
        action: "showQuickSwitch",
        tabs: tabsData,
        groups: groupsData,
        activeTabId: activeTab.id,
      });
    } catch (error) {
      console.error("[ERROR] Failed to send Quick Switch message:", error);
    }

    if (!delivered) {
      console.warn(
        "[INJECT] Content script unavailable. Falling back to popup window.",
      );
      await openQuickSwitchPopup(tabsData, groupsData, activeTab.id);
      return;
    }

    log("[QUICK SWITCH] Quick switch overlay triggered");
  } catch (error) {
    console.error("[ERROR] Failed to show quick switch:", error);
  }
}

// ============================================================================
// MESSAGE LISTENER
// ============================================================================

if (
  typeof chrome !== "undefined" &&
  chrome.runtime &&
  chrome.runtime.onMessage
) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(
      request,
      sender,
      sendResponse,
      screenshotCache,
      handleShowTabFlow,
    );
    return true; // Keep channel open for async response
  });
}

// ============================================================================
// START INITIALIZATION
// ============================================================================

initialize().catch((error) => {
  console.error("[INIT] Failed to initialize:", error);
});
