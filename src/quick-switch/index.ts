// ============================================================================
// Quick Switch Popup - Protected page fallback using the same overlay engine
// as injected quick switch on normal websites.
// ============================================================================

import {
  showQuickSwitch,
  advanceQuickSwitchSelection,
} from "../content/ui/overlay";
import type { Group, Tab } from "../shared/types";
import {
  closePopupWindowSoon,
  getActiveTabId,
  initializeProtectedPopup,
} from "../shared/protected-popup";

type QuickSwitchPayload = {
  tabs: Tab[];
  groups: Group[];
  activeTabId: number | null;
};

// Minimum time (ms) the popup must be open before blur/Alt-release can close it.
// This prevents the popup from closing due to transient focus changes during
// window creation or when there are many tabs causing slow render.
const MIN_POPUP_DISPLAY_MS = 100;

function setupPopupLifecycle(closePopupWindowSoon: () => void): void {
  const popupOpenTime = Date.now();

  // Debounced close — only close if the popup has been visible long enough.
  // This prevents premature closing from transient focus shifts during
  // window creation and tab switching.
  let blurCloseTimer: ReturnType<typeof setTimeout> | null = null;

  const debouncedClose = () => {
    if (blurCloseTimer) clearTimeout(blurCloseTimer);
    blurCloseTimer = setTimeout(() => {
      closePopupWindowSoon();
    }, 50);
  };

  // Cancel debounced close if focus returns to the popup
  window.addEventListener("focus", () => {
    if (blurCloseTimer) {
      clearTimeout(blurCloseTimer);
      blurCloseTimer = null;
    }
  });

  // Auto-close once focus leaves the popup (e.g. tab switch completed).
  // Use debounced version to handle transient focus changes.
  window.addEventListener("blur", () => {
    const elapsed = Date.now() - popupOpenTime;
    if (elapsed < MIN_POPUP_DISPLAY_MS) {
      // Too soon — the popup is still initializing, ignore this blur
      return;
    }
    debouncedClose();
  });

  // Close on explicit cancel/confirm keys.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.key === "Enter") {
      closePopupWindowSoon();
    }
  }, true);

  // Only react to the Alt key being released — this is the important
  // "commit" gesture that mirrors Windows Alt+Tab behavior.
  document.addEventListener("keyup", (event) => {
    if (event.key !== "Alt") return;

    const elapsed = Date.now() - popupOpenTime;
    if (elapsed < MIN_POPUP_DISPLAY_MS) {
      // Alt released too quickly during render — defer the close
      const remaining = MIN_POPUP_DISPLAY_MS - elapsed;
      setTimeout(() => {
        closePopupWindowSoon();
      }, remaining);
      return;
    }

    closePopupWindowSoon();
  }, true);
}

async function requestTabsFromBackground(): Promise<QuickSwitchPayload | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getTabsForQuickSwitch",
    });

    if (!response?.success || !Array.isArray(response.tabs)) {
      return null;
    }

    return {
      tabs: response.tabs as Tab[],
      groups: (Array.isArray(response.groups) ? response.groups : []) as Group[],
      activeTabId: getActiveTabId(response.tabs as Tab[]),
    };
  } catch (error) {
    console.error("[QS POPUP] Failed to request tabs:", error);
    return null;
  }
}

function parseStoredQuickSwitchPayload(stored: unknown): QuickSwitchPayload | null {
  const quickSwitchState = stored as
    | { tabs?: Tab[]; groups?: Group[]; activeTabId?: number }
    | undefined;

  if (
    !quickSwitchState ||
    !Array.isArray(quickSwitchState.tabs) ||
    quickSwitchState.tabs.length === 0
  ) {
    return null;
  }

  return {
    tabs: quickSwitchState.tabs,
    groups: Array.isArray(quickSwitchState.groups) ? quickSwitchState.groups : [],
    activeTabId:
      typeof quickSwitchState.activeTabId === "number"
        ? quickSwitchState.activeTabId
        : getActiveTabId(quickSwitchState.tabs),
  };
}

async function initialize(): Promise<void> {
  await initializeProtectedPopup<QuickSwitchPayload>({
    storageKey: "QuickSwitchTabData",
    errorLabel: "[QS POPUP]",
    overlayId: "quick-switch-overlay",
    containerSelector: ".tab-flow-container.quick-switch-container",
    parseStored: parseStoredQuickSwitchPayload,
    fallbackLoader: requestTabsFromBackground,
    isEmpty: (payload) => payload.tabs.length === 0,
    setupLifecycle: setupPopupLifecycle,
    render: async (payload) => {
      await showQuickSwitch(payload.tabs, payload.activeTabId, payload.groups);
    },
    cycleAction: {
      action: "QuickSwitchPopupCycleNext",
      onCycle: () => {
        advanceQuickSwitchSelection(1);
      },
    },
  });
}

initialize().catch((error) => {
  console.error("[QS POPUP] Initialization failed:", error);
  closePopupWindowSoon();
});
