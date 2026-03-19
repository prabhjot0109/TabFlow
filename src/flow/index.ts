// ============================================================================
// Flow Popup - Protected page fallback using the same overlay engine
// as injected Flow on normal websites.
// ============================================================================

import { showTabFlow } from "../content/ui/overlay";
import { selectNext } from "../content/input/keyboard";
import { enforceSingleSelection } from "../content/ui/rendering";
import { state } from "../content/state";
import type { Group, Tab } from "../shared/types";
import {
  closePopupWindowSoon,
  getActiveTabId,
  initializeProtectedPopup,
} from "../shared/protected-popup";

type FlowPayload = {
  tabs: Tab[];
  groups: Group[];
  activeTabId: number | null;
};

function setupPopupLifecycle(closePopupWindowSoon: () => void): void {
  // Close once focus moves to another tab/window.
  window.addEventListener("blur", closePopupWindowSoon);

  // Escape should close popup window as well as overlay.
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closePopupWindowSoon();
      }
    },
    true,
  );

  // If the overlay is closed without blur, close popup shell too.
  const monitor = window.setInterval(() => {
    if (!state.isOverlayVisible && !state.isClosing) {
      window.clearInterval(monitor);
      closePopupWindowSoon();
    }
  }, 120);
}

async function requestTabsFromBackground(): Promise<FlowPayload | null> {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getTabsForFlow" });
    if (!response?.success || !Array.isArray(response.tabs)) {
      return null;
    }

    const tabs = response.tabs as Tab[];
    const groups = (Array.isArray(response.groups) ? response.groups : []) as Group[];
    return {
      tabs,
      groups,
      activeTabId: getActiveTabId(tabs),
    };
  } catch (error) {
    console.error("[FLOW POPUP] Failed to request tabs:", error);
    return null;
  }
}

function parseStoredFlowPayload(stored: unknown): FlowPayload | null {
  const flowState = stored as
    | { tabs?: Tab[]; groups?: Group[]; activeTabId?: number }
    | undefined;

  if (!flowState || !Array.isArray(flowState.tabs) || flowState.tabs.length === 0) {
    return null;
  }

  return {
    tabs: flowState.tabs,
    groups: Array.isArray(flowState.groups) ? flowState.groups : [],
    activeTabId:
      typeof flowState.activeTabId === "number"
        ? flowState.activeTabId
        : getActiveTabId(flowState.tabs),
  };
}

async function initialize(): Promise<void> {
  await initializeProtectedPopup<FlowPayload>({
    storageKey: "FlowTabData",
    errorLabel: "[FLOW POPUP]",
    overlayId: "visual-tab-flow-overlay",
    containerSelector: ".tab-flow-container",
    parseStored: parseStoredFlowPayload,
    fallbackLoader: requestTabsFromBackground,
    isEmpty: (payload) => payload.tabs.length === 0,
    setupLifecycle: setupPopupLifecycle,
    render: (payload) => {
      showTabFlow(payload.tabs, payload.activeTabId, payload.groups);
    },
    cycleAction: {
      action: "FlowPopupCycleNext",
      onCycle: () => {
        selectNext();
        enforceSingleSelection(true);
      },
    },
  });
}

initialize().catch((error) => {
  console.error("[FLOW POPUP] Initialization failed:", error);
  closePopupWindowSoon();
});
