// ============================================================================
// Quick Switch Popup - Protected page fallback using the same overlay engine
// as injected quick switch on normal websites.
// ============================================================================

import {
  showQuickSwitch,
  advanceQuickSwitchSelection,
} from "../content/ui/overlay";
import type { Tab } from "../shared/types";
import {
  closePopupWindowSoon,
  getActiveTabId,
  initializeProtectedPopup,
} from "../shared/protected-popup";

type QuickSwitchPayload = {
  tabs: Tab[];
  activeTabId: number | null;
};

function setupPopupLifecycle(closePopupWindowSoon: () => void): void {
  // Auto-close once focus leaves the popup (e.g. tab switch completed).
  window.addEventListener("blur", closePopupWindowSoon);

  // Close on explicit cancel/confirm keys.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.key === "Enter") {
      closePopupWindowSoon();
    }
  }, true);

  document.addEventListener("keyup", (event) => {
    if (event.key === "Alt" || (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey)) {
      closePopupWindowSoon();
    }
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
      activeTabId: getActiveTabId(response.tabs as Tab[]),
    };
  } catch (error) {
    console.error("[QS POPUP] Failed to request tabs:", error);
    return null;
  }
}

function parseStoredQuickSwitchPayload(stored: unknown): QuickSwitchPayload | null {
  const quickSwitchState = stored as
    | { tabs?: Tab[]; activeTabId?: number }
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
      await showQuickSwitch(payload.tabs, payload.activeTabId);
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
