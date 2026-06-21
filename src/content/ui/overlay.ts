import { state, type Group, type Tab } from "../state";
import { SHADOW_CSS, SHADOW_HOST_ID } from "./styles";
import { closeOverlay, setViewMode } from "../actions";
import {
  applyPanelStyleContract,
  syncPanelDensity,
} from "./panel-layout";
import { createSmartSearchHandler } from "../input/search";
import {
  handleSearchKeydown,
  handleGridClick,
  handleKeyDown,
  handleKeyUp,
} from "../input/keyboard";
import {
  renderTabsStandard,
  renderTabsVirtual,
  shouldUseVirtualRendering,
} from "./rendering";
import { releaseTabPayloadState } from "../memory";
import * as focus from "../input/focus";

const DEBUG_LOGGING = false;
const log = (...args: unknown[]) => {
  if (DEBUG_LOGGING) {
    console.log(...args);
  }
};

const SVG_NS = "http://www.w3.org/2000/svg";

function createSvgElement(tag: string): SVGElement {
  return document.createElementNS(SVG_NS, tag);
}

function createGridIcon(size?: number): SVGSVGElement {
  const svg = createSvgElement("svg") as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  if (size) {
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
  }

  const rects = [
    { x: "3", y: "3" },
    { x: "14", y: "3" },
    { x: "3", y: "14" },
    { x: "14", y: "14" },
  ];

  rects.forEach(({ x, y }) => {
    const rect = createSvgElement("rect");
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", "7");
    rect.setAttribute("height", "7");
    rect.setAttribute("rx", "1.5");
    svg.appendChild(rect);
  });

  return svg;
}

function createListIcon(): SVGSVGElement {
  const svg = createSvgElement("svg") as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const elements = [
    { tag: "line", attrs: { x1: "8", y1: "6", x2: "21", y2: "6" } },
    { tag: "line", attrs: { x1: "8", y1: "12", x2: "21", y2: "12" } },
    { tag: "line", attrs: { x1: "8", y1: "18", x2: "21", y2: "18" } },
    { tag: "line", attrs: { x1: "3", y1: "6", x2: "3.01", y2: "6" } },
    { tag: "line", attrs: { x1: "3", y1: "12", x2: "3.01", y2: "12" } },
    { tag: "line", attrs: { x1: "3", y1: "18", x2: "3.01", y2: "18" } }
  ];

  elements.forEach(({ tag, attrs }) => {
    const el = createSvgElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
      el.setAttribute(key, val);
    }
    svg.appendChild(el);
  });

  return svg;
}

function createKbd(text: string): HTMLElement {
  const kbd = document.createElement("kbd");
  kbd.textContent = text;
  return kbd;
}

function getFaviconUrl(url?: string, size = 32): string | null {
  if (!url) return null;
  try {
    const favUrl = new URL(chrome.runtime.getURL("/_favicon/"));
    favUrl.searchParams.set("pageUrl", url);
    favUrl.searchParams.set("size", String(size));
    return favUrl.toString();
  } catch {
    return null;
  }
}

function createFocusGuard(onFocus: () => void): HTMLElement {
  const guard = document.createElement("span");
  guard.className = "tab-flow-focus-guard";
  guard.tabIndex = 0;
  guard.setAttribute("aria-hidden", "true");
  guard.addEventListener("focus", onFocus);
  return guard;
}

function createTopLayerOverlay(
  id: string,
  className: string,
  onCancel: () => void,
): HTMLDialogElement {
  const overlay = document.createElement("dialog");
  overlay.id = id;
  overlay.className = className;
  overlay.style.visibility = "hidden";
  overlay.style.pointerEvents = "none";
  overlay.addEventListener("cancel", (event) => {
    event.preventDefault();
    onCancel();
  });
  return overlay;
}

function showOverlayInTopLayer(overlay: HTMLElement | null): void {
  if (!(overlay instanceof HTMLDialogElement)) return;

  ensureHostMountedAbovePage();

  if (!overlay.open) {
    try {
      overlay.showModal();
    } catch (error) {
      log("[Tab Flow] Failed to enter top layer, using layered fallback:", error);
      overlay.setAttribute("open", "");
    }
  }

  overlay.style.visibility = "visible";
  overlay.style.pointerEvents = "auto";
}

function hideOverlayFromTopLayer(overlay: HTMLElement | null): void {
  if (!(overlay instanceof HTMLDialogElement)) return;

  overlay.style.visibility = "hidden";
  overlay.style.pointerEvents = "none";

  if (overlay.open) {
    overlay.close();
  } else {
    overlay.removeAttribute("open");
  }
}

// ============================================================================
// GLOBAL VIEW MODE (persisted via chrome.storage.local, applies across all sites)
// ============================================================================
let cachedViewMode: "grid" | "list" = "grid";

// Load view mode from chrome.storage once on script initialization
try {
  chrome.storage.local.get(["TabFlowViewMode"], (result) => {
    if (!chrome.runtime.lastError && result.TabFlowViewMode) {
      const mode = result.TabFlowViewMode as "grid" | "list";
      if (mode === "grid" || mode === "list") {
        cachedViewMode = mode;
      }
    }
  });
} catch {
  // Ignore - use default
}

try {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const updated = changes.TabFlowViewMode?.newValue as
      | "grid"
      | "list"
      | undefined;
    if (updated === "grid" || updated === "list") {
      cachedViewMode = updated;
    }
  });
} catch {
  // Ignore - storage events may be unavailable in some contexts.
}

/** Get the current globally cached view mode (synchronous) */
function getCachedViewMode(): "grid" | "list" {
  return cachedViewMode;
}

/** Set the global view mode and persist to chrome.storage */
function setGlobalViewMode(mode: "grid" | "list") {
  cachedViewMode = mode;
  try {
    chrome.storage.local.set({ TabFlowViewMode: mode });
  } catch {
    // Ignore storage errors
  }
}

// Track initialized shadow roots
const activeShadowRoots = new WeakSet<ShadowRoot>();

function installShadowEventGuards(shadowRoot: ShadowRoot) {
  if (activeShadowRoots.has(shadowRoot)) return;
  activeShadowRoots.add(shadowRoot);

  const stopBubbleToPage = (e: Event) => {
    if (!state.isOverlayVisible) return;
    if (!focus.isEventFromOurExtension(e as any)) return;

    // Prevent site-level listeners from seeing extension input.
    e.stopPropagation();
    if (typeof (e as any).stopImmediatePropagation === "function") {
      (e as any).stopImmediatePropagation();
    }
  };

  // Stop keyboard + input events from escaping the shadow boundary.
  const eventTypes = [
    "keydown",
    "keyup",
    "keypress",
    "beforeinput",
    "input",
    "textInput",
    "compositionstart",
    "compositionupdate",
    "compositionend",
    "click",
    "mousedown",
    "mouseup",
    "pointerdown",
    "pointerup",
    "contextmenu",
  ];

  for (const type of eventTypes) {
    shadowRoot.addEventListener(type, stopBubbleToPage);
  }
}

function getFullscreenContainer(): HTMLElement | null {
  const d: any = document as any;
  const fsEl = (document.fullscreenElement ||
    d.webkitFullscreenElement) as HTMLElement | null;
  if (!fsEl) return null;

  // Appending to a <video> element is unreliable for overlay rendering.
  if (fsEl.tagName === "VIDEO") {
    return (fsEl.parentElement as HTMLElement | null) || null;
  }
  return fsEl;
}

function ensureHostMountedAbovePage() {
  if (!state.host) return;

  const fullscreenContainer = getFullscreenContainer();
  const mountTarget =
    fullscreenContainer || document.documentElement || document.body;
  if (!mountTarget) return;

  try {
    if (state.host.parentNode !== mountTarget) {
      mountTarget.appendChild(state.host);
    } else {
      // Move to the end to win same-z-index ties.
      mountTarget.appendChild(state.host);
    }
  } catch {
    // Ignore.
  }
}

export function ensureShadowRoot() {
  try {
    if (!state.host || !state.host.isConnected) {
      state.shadowRoot = null;
      state.styleElement = null;
      const existingHost = document.getElementById(SHADOW_HOST_ID);
      if (existingHost) {
        state.host = existingHost;
      } else {
        const host = document.createElement("tab-flow-mount");
        host.id = SHADOW_HOST_ID;
        // CRITICAL: Complete isolation from host page
        host.style.cssText = `
        all: initial !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 0 !important;
        height: 0 !important;
        min-width: 0 !important;
        min-height: 0 !important;
        max-width: 0 !important;
        max-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        overflow: visible !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        contain: layout style !important;
        isolation: isolate !important;
      `;
        // Mount as high as possible; when fullscreen is active we re-mount into the fullscreen container.
        (document.documentElement || document.body).appendChild(host);
        state.host = host;
      }
    }

    ensureHostMountedAbovePage();

    if (!state.shadowRoot) {
      if (state.host.shadowRoot) {
        state.shadowRoot = state.host.shadowRoot;
      } else {
        state.shadowRoot = state.host.attachShadow({ mode: "open" });
      }
    }
    if (!state.styleElement || !state.shadowRoot.contains(state.styleElement)) {
      const style = document.createElement("style");
      style.textContent = SHADOW_CSS;
      state.shadowRoot.appendChild(style);
      state.styleElement = style;
    }

    // Ensure we never leak events to the page while open.
    installShadowEventGuards(state.shadowRoot);
    return state.shadowRoot;
  } catch (error) {
    console.error("[Tab Flow] Failed to initialize shadow root:", error);
    return null;
  }
}

export function createOverlay() {
  if (state.overlay) return;

  const shadowRoot = ensureShadowRoot();
  if (!shadowRoot) {
    return;
  }

  // Create overlay container
  const overlay = createTopLayerOverlay(
    "visual-tab-flow-overlay",
    "tab-flow-overlay",
    closeOverlay,
  );

  // Create backdrop
  const backdrop = document.createElement("div");
  backdrop.className = "tab-flow-backdrop";
  overlay.appendChild(backdrop);

  // Create main container
  const container = document.createElement("div");
  container.className = "tab-flow-container";
  container.setAttribute("role", "dialog");
  container.setAttribute("aria-modal", "true");
  applyPanelStyleContract(overlay, container);

  // Search + actions row
  const searchRow = document.createElement("div");
  searchRow.className = "tab-flow-search-row";

  // Search wrapper and box
  const searchWrap = document.createElement("div");
  searchWrap.className = "tab-flow-search-wrap";

  const searchBox = document.createElement("input");
  searchBox.type = "text";
  searchBox.className = "tab-flow-search";
  searchBox.placeholder = "Search tabs by title or URL...";
  searchBox.autocomplete = "off";
  searchBox.setAttribute("aria-label", "Search tabs");

  // Logo icon instead of search icon (Tab Flow logo)
  const searchIcon = document.createElement("div");
  searchIcon.className = "search-icon";
  searchIcon.appendChild(createGridIcon(22));

  // Tab hint on right side of search bar (Raycast style)
  const tabHint = document.createElement("div");
  tabHint.className = "search-tab-hint";
  tabHint.id = "tab-flow-search-hint";
  tabHint.appendChild(createKbd("Tab"));
  tabHint.appendChild(document.createTextNode(" Search Google"));
  searchBox.setAttribute("aria-describedby", tabHint.id);

  searchWrap.appendChild(searchIcon);
  searchWrap.appendChild(searchBox);
  searchWrap.appendChild(tabHint);
  searchRow.appendChild(searchWrap);
  container.appendChild(searchRow);

  // Section header with view toggle
  const sectionHeader = document.createElement("div");
  sectionHeader.className = "tab-flow-section-header";

  const sectionTitle = document.createElement("span");
  sectionTitle.className = "tab-flow-section-title";
  sectionTitle.textContent = "Opened Tabs";
  sectionTitle.id = "tab-flow-title";

  const viewToggle = document.createElement("div");
  viewToggle.className = "tab-flow-view-toggle";

  // Use globally cached view mode (loaded from chrome.storage at extension init)
  const currentView = getCachedViewMode();

  const gridViewBtn = document.createElement("button");
  gridViewBtn.type = "button";
  gridViewBtn.className = `view-toggle-btn ${currentView === "grid" ? "active" : ""
    }`;
  gridViewBtn.dataset.view = "grid";
  gridViewBtn.title = "Grid View";
  gridViewBtn.setAttribute("aria-label", "Grid view");
  gridViewBtn.setAttribute("aria-pressed", String(currentView === "grid"));
  gridViewBtn.appendChild(createGridIcon());

  const listViewBtn = document.createElement("button");
  listViewBtn.type = "button";
  listViewBtn.className = `view-toggle-btn ${currentView === "list" ? "active" : ""
    }`;
  listViewBtn.dataset.view = "list";
  listViewBtn.title = "List View";
  listViewBtn.setAttribute("aria-label", "List view");
  listViewBtn.setAttribute("aria-pressed", String(currentView === "list"));
  listViewBtn.appendChild(createListIcon());

  viewToggle.appendChild(gridViewBtn);
  viewToggle.appendChild(listViewBtn);

  sectionHeader.appendChild(sectionTitle);
  sectionHeader.appendChild(viewToggle);
  container.appendChild(sectionHeader);

  // Grid container with virtual scrolling support
  const grid = document.createElement("div");
  grid.className = `tab-flow-grid ${currentView === "list" ? "list-view" : ""}`;
  grid.id = "tab-flow-grid";
  grid.setAttribute("role", "listbox");
  grid.setAttribute("aria-label", "Open tabs");
  container.appendChild(grid);

  // Help text - Raycast-style action bar (centered)
  const helpText = document.createElement("div");
  helpText.className = "tab-flow-help";
  helpText.id = "tab-flow-help";
  helpText.setAttribute("aria-live", "polite");
  helpText.setAttribute("aria-atomic", "true");
  container.appendChild(helpText);

  container.setAttribute("aria-labelledby", sectionTitle.id);
  container.setAttribute("aria-describedby", helpText.id);

  const focusStart = createFocusGuard(() => searchBox.focus());
  const focusEnd = createFocusGuard(() => searchBox.focus());
  container.prepend(focusStart);
  container.appendChild(focusEnd);

  overlay.appendChild(container);

  // Event listeners with improved debounce/throttle strategy
  // Use different strategies for small vs large tab sets
  searchBox.addEventListener("input", createSmartSearchHandler());
  searchBox.addEventListener("keydown", handleSearchKeydown);
  backdrop.addEventListener("click", closeOverlay);

  // Event delegation for tab clicks (single listener)
  grid.addEventListener("click", handleGridClick);

  // View toggle click handlers
  viewToggle.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(
      ".view-toggle-btn"
    ) as HTMLButtonElement;
    if (!btn) return;

    const view = btn.dataset.view as "grid" | "list";
    if (!view) return;

    // Update button states
    gridViewBtn.classList.toggle("active", view === "grid");
    listViewBtn.classList.toggle("active", view === "list");
    gridViewBtn.setAttribute("aria-pressed", String(view === "grid"));
    listViewBtn.setAttribute("aria-pressed", String(view === "list"));

    // Update grid class
    grid.classList.toggle("list-view", view === "list");

    // Persist preference globally via chrome.storage (applies across all sites)
    setGlobalViewMode(view);

    if (shouldUseVirtualRendering(state.filteredTabs.length)) {
      renderTabsVirtual(state.filteredTabs);
    } else {
      renderTabsStandard(state.filteredTabs);
    }
  });

  // Cache DOM references
  state.overlay = overlay;
  state.domCache = {
    grid,
    searchBox,
    container,
    searchWrap,
    helpText,
    sectionTitle,
    tabHint,
  };

  shadowRoot.appendChild(overlay);

  log("[PERF] Overlay created with GPU acceleration and event delegation");
}

export function showTabFlow(
  tabs: Tab[],
  activeTabId: number | null | undefined,
  groups: Group[] = []
) {
  log(`[Tab Flow] Opening with ${tabs.length} tabs and ${groups.length} groups`);

  // Capture fullscreen element before showing overlay
  const d: any = document as any;
  state.lastFullscreenElement =
    (document.fullscreenElement as HTMLElement | null) ||
    (d.webkitFullscreenElement as HTMLElement | null) ||
    null;

  if (state.isOverlayVisible && !state.isClosing) return;

  // Cancel any pending close
  if (state.closeTimeout) {
    clearTimeout(state.closeTimeout);
    state.closeTimeout = null;
  }
  state.isClosing = false;
  state.isOverlayVisible = true;

  // Always open fresh (do not persist last used modes)
  state.webSearch.active = false;
  state.history.active = false;

  createOverlay();

  if (!state.overlay) {
    state.isOverlayVisible = false;
    return;
  }

  const overlayEl = state.overlay;

  // Ensure host is mounted above page and inside fullscreen container when needed.
  ensureHostMountedAbovePage();

  showOverlayInTopLayer(overlayEl);

  state.activeTabs = tabs;
  state.currentTabs = tabs;
  state.groups = groups;
  state.filteredTabs = tabs;
  setViewMode("active");

  // Clear any leftover mode styling from prior session
  if (state.domCache?.grid) {
    state.domCache.grid.classList.remove("search-mode");
    state.domCache.grid.classList.remove("recent-mode");
  }

  // Start selection at the second tab (most recently used that isn't current)
  // This mimics Alt+Tab behavior where pressing the shortcut once shows the previous tab
  const activeIndex = tabs.findIndex((tab: Tab) => tab.id === activeTabId);
  if (tabs.length > 1 && activeIndex === 0) {
    // Current tab is first (most recent), select the second one
    state.selectedIndex = 1;
  } else if (activeIndex > 0) {
    // Current tab is not first, select the first one (most recent)
    state.selectedIndex = 0;
  } else {
    state.selectedIndex = 0;
  }

  // Determine rendering strategy based on tab count
  if (shouldUseVirtualRendering(state.filteredTabs.length)) {
    log(
      "[PERF] Using virtual scrolling for",
      state.filteredTabs.length,
      "tabs"
    );
    renderTabsVirtual(state.filteredTabs);
  } else {
    renderTabsStandard(state.filteredTabs);
  }

  // Make visible immediately to allow focus and event trapping
  overlayEl.style.visibility = "visible";
  overlayEl.style.pointerEvents = "auto";
  state.isOverlayVisible = true;

  // Blur page and focus search immediately
  focus.lockPageInteraction();
  focus.blurPageElements();
  if (state.domCache.searchBox) {
    state.domCache.searchBox.value = "";
    state.domCache.searchBox.focus();
  }

  // Scroll to top by default
  if (state.domCache.grid) {
    state.domCache.grid.scrollTop = 0;
  }

  // Add keyboard listeners in capture phase so they still work even if
  // we stop bubbling out of the shadow DOM to prevent site shortcuts.
  document.addEventListener("keydown", handleKeyDown, true);
  document.addEventListener("keyup", handleKeyUp, true);

  // Aggressive Focus Enforcement: Prevent page from stealing focus or receiving keys
  // Using capture phase (true) to intercept events before they reach page elements
  document.addEventListener("focus", focus.handleGlobalFocus, true);
  document.addEventListener("focusin", focus.handleGlobalFocusIn, true);
  document.addEventListener("keydown", focus.handleGlobalKeydown, true);
  document.addEventListener("keypress", focus.handleGlobalKeydown, true);
  document.addEventListener("keyup", focus.handleGlobalKeydown, true);
  document.addEventListener("input", focus.handleGlobalInput, true);
  document.addEventListener("beforeinput", focus.handleGlobalInput, true);
  document.addEventListener("textInput", focus.handleGlobalInput, true);
  document.addEventListener("click", focus.handleGlobalClick, true);
  document.addEventListener("mousedown", focus.handleGlobalClick, true);

  // Block composition events
  document.addEventListener(
    "compositionstart",
    focus.handleGlobalComposition,
    true
  );
  document.addEventListener(
    "compositionupdate",
    focus.handleGlobalComposition,
    true
  );
  document.addEventListener(
    "compositionend",
    focus.handleGlobalComposition,
    true
  );

}

// ============================================================================
// QUICK SWITCH OVERLAY (Alt+Q - Alt+Tab style)
// ============================================================================

let quickSwitchOverlay: HTMLElement | null = null;
let quickSwitchGrid: HTMLElement | null = null;
let cachedQuickSwitchViewMode: "grid" | "list" = "grid"; // Default to grid
let quickSwitchCards: HTMLElement[] = [];
let quickSwitchLastSelectedIndex = -1;

// Timestamp when the quick switch overlay became ready for Alt-release switching.
// This prevents premature switches when Alt is released during initial render.
let quickSwitchReadyTime = 0;
const QUICK_SWITCH_MIN_DISPLAY_MS = 100;

// Load quick switch view mode from chrome.storage once on script initialization
try {
  chrome.storage.local.get(["QuickSwitchViewMode"], (result) => {
    if (!chrome.runtime.lastError && result.QuickSwitchViewMode) {
      const mode = result.QuickSwitchViewMode as "grid" | "list";
      if (mode === "grid" || mode === "list") {
        cachedQuickSwitchViewMode = mode;
      }
    }
  });
} catch {
  // Ignore - use default
}

try {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const updated = changes.QuickSwitchViewMode?.newValue as
      | "grid"
      | "list"
      | undefined;
    if (updated === "grid" || updated === "list") {
      cachedQuickSwitchViewMode = updated;
      updateQuickSwitchViewUI();
    }
  });
} catch {
  // Ignore - storage events may be unavailable in some contexts.
}

/** Update the quick switch UI to reflect current view mode */
function updateQuickSwitchViewUI() {
  if (!quickSwitchOverlay || !quickSwitchGrid) return;

  // Update grid class
  quickSwitchGrid.classList.toggle(
    "list-view",
    cachedQuickSwitchViewMode === "list"
  );

  // Update toggle buttons
  const gridBtn = quickSwitchOverlay.querySelector('[data-view="grid"]');
  const listBtn = quickSwitchOverlay.querySelector('[data-view="list"]');
  if (gridBtn) {
    gridBtn.classList.toggle("active", cachedQuickSwitchViewMode === "grid");
    gridBtn.setAttribute(
      "aria-pressed",
      String(cachedQuickSwitchViewMode === "grid")
    );
  }
  if (listBtn) {
    listBtn.classList.toggle("active", cachedQuickSwitchViewMode === "list");
    listBtn.setAttribute(
      "aria-pressed",
      String(cachedQuickSwitchViewMode === "list")
    );
  }
}

function createQuickSwitchOverlay() {
  if (quickSwitchOverlay) return;

  const shadowRoot = ensureShadowRoot();
  if (!shadowRoot) return;

  // Create overlay container
  const overlay = createTopLayerOverlay(
    "quick-switch-overlay",
    "tab-flow-overlay quick-switch-mode",
    closeQuickSwitch,
  );

  // Create backdrop
  const backdrop = document.createElement("div");
  backdrop.className = "tab-flow-backdrop";
  overlay.appendChild(backdrop);

  // Create compact container
  const container = document.createElement("div");
  container.className = "tab-flow-container quick-switch-container";
  container.setAttribute("role", "dialog");
  container.setAttribute("aria-modal", "true");
  applyPanelStyleContract(overlay, container);

  // Section header with title and view toggle
  const sectionHeader = document.createElement("div");
  sectionHeader.className = "tab-flow-section-header";

  const sectionTitle = document.createElement("span");
  sectionTitle.className = "tab-flow-section-title";
  sectionTitle.textContent = "Switch Tabs";
  sectionTitle.id = "quick-switch-title";

  // View toggle
  const viewToggle = document.createElement("div");
  viewToggle.className = "tab-flow-view-toggle";

  const gridViewBtn = document.createElement("button");
  gridViewBtn.type = "button";
  gridViewBtn.className = `view-toggle-btn ${cachedQuickSwitchViewMode === "grid" ? "active" : ""
    }`;
  gridViewBtn.dataset.view = "grid";
  gridViewBtn.title = "Grid View";
  gridViewBtn.setAttribute("aria-label", "Grid view");
  gridViewBtn.setAttribute(
    "aria-pressed",
    String(cachedQuickSwitchViewMode === "grid")
  );
  gridViewBtn.appendChild(createGridIcon());

  const listViewBtn = document.createElement("button");
  listViewBtn.type = "button";
  listViewBtn.className = `view-toggle-btn ${cachedQuickSwitchViewMode === "list" ? "active" : ""
    }`;
  listViewBtn.dataset.view = "list";
  listViewBtn.title = "List View";
  listViewBtn.setAttribute("aria-label", "List view");
  listViewBtn.setAttribute(
    "aria-pressed",
    String(cachedQuickSwitchViewMode === "list")
  );
  listViewBtn.appendChild(createListIcon());

  viewToggle.appendChild(gridViewBtn);
  viewToggle.appendChild(listViewBtn);

  sectionHeader.appendChild(sectionTitle);
  sectionHeader.appendChild(viewToggle);
  container.appendChild(sectionHeader);

  // Grid container (starts with list view by default)
  const grid = document.createElement("div");
  grid.className = `tab-flow-grid quick-switch-grid ${cachedQuickSwitchViewMode === "list" ? "list-view" : ""
    }`;
  grid.id = "quick-switch-grid";
  grid.setAttribute("role", "listbox");
  grid.setAttribute("aria-label", "Quick switch tabs");
  grid.tabIndex = 0;
  container.appendChild(grid);

  // Help text
  const helpText = document.createElement("div");
  helpText.className = "tab-flow-help";
  helpText.id = "quick-switch-help";
  helpText.setAttribute("aria-live", "polite");
  helpText.setAttribute("aria-atomic", "true");
  const quickSwitchHelp = [
    { keys: ["Alt+Q"], action: "Cycle" },
    { keys: ["↑↓"], action: "Navigate" },
    { keys: ["Alt"], action: "Release to Switch" },
    { keys: ["Esc"], action: "Cancel" },
  ];
  quickSwitchHelp.forEach((item) => {
    const span = document.createElement("span");
    item.keys.forEach((key) => {
      span.appendChild(createKbd(key));
      span.appendChild(document.createTextNode(" "));
    });
    span.appendChild(document.createTextNode(item.action));
    helpText.appendChild(span);
  });
  container.appendChild(helpText);

  container.setAttribute("aria-labelledby", sectionTitle.id);
  container.setAttribute("aria-describedby", helpText.id);
  const focusStart = createFocusGuard(() => grid.focus());
  const focusEnd = createFocusGuard(() => grid.focus());
  container.prepend(focusStart);
  container.appendChild(focusEnd);

  overlay.appendChild(container);

  // View toggle click handlers
  viewToggle.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(
      ".view-toggle-btn"
    ) as HTMLButtonElement;
    if (!btn) return;

    const view = btn.dataset.view as "grid" | "list";
    if (!view) return;

    cachedQuickSwitchViewMode = view;

    // Persist to chrome.storage for global consistency
    try {
      chrome.storage.local.set({ QuickSwitchViewMode: view });
    } catch {
      // Ignore storage errors
    }

    // Update button states
    gridViewBtn.classList.toggle("active", view === "grid");
    listViewBtn.classList.toggle("active", view === "list");
    gridViewBtn.setAttribute("aria-pressed", String(view === "grid"));
    listViewBtn.setAttribute("aria-pressed", String(view === "list"));

    // Update grid class
    grid.classList.toggle("list-view", view === "list");
    syncPanelDensity(container, grid, quickSwitchCards.length);
  });

  // Click backdrop to close
  backdrop.addEventListener("click", closeQuickSwitch);

  // Store references
  quickSwitchOverlay = overlay;
  quickSwitchGrid = grid;

  shadowRoot.appendChild(overlay);
}

function renderQuickSwitchTabs(tabs: Tab[]) {
  if (!quickSwitchGrid) return;

  const grid = quickSwitchGrid;
  grid.innerHTML = "";
  quickSwitchCards = [];
  quickSwitchLastSelectedIndex = -1;
  const fragment = document.createDocumentFragment();

  const isListView = cachedQuickSwitchViewMode === "list";

  tabs.forEach((tab, index) => {
    const screenshot =
      typeof tab.screenshot === "string" && tab.screenshot.length > 0
        ? tab.screenshot
        : null;
    // Screenshots are only shown in grid view (list view is a compact row).
    const hasValidScreenshot = Boolean(screenshot) && !isListView;

    const card = document.createElement("div");
    card.className = `tab-card ${hasValidScreenshot ? "has-screenshot" : "has-favicon"
      }${index === state.selectedIndex ? " selected" : ""}${tab.active ? " current-tab" : ""
      }`;
    card.dataset.tabId = String(tab.id);
    card.dataset.tabIndex = String(index);
    card.setAttribute("role", "option");
    card.setAttribute(
      "aria-selected",
      index === state.selectedIndex ? "true" : "false"
    );

    // Thumbnail area: real screenshot when we have one (grid view), otherwise a
    // favicon tile fallback.
    const thumbnail = document.createElement("div");
    thumbnail.className = "tab-thumbnail";

    if (hasValidScreenshot && screenshot) {
      const img = document.createElement("img");
      img.className = "screenshot-img";
      img.alt = tab.title || "";
      img.loading = "lazy";
      img.decoding = "async";
      img.src = screenshot;
      thumbnail.appendChild(img);
    } else {
      // Favicon tile (shown in thumbnail area for grid view)
      const faviconTile = document.createElement("div");
      faviconTile.className = "favicon-tile";

      const faviconLarge = document.createElement("img");
      faviconLarge.className = "favicon-large";
      faviconLarge.src = tab.favIconUrl || getFaviconUrl(tab.url) || "";
      faviconLarge.alt = "";
      faviconLarge.onerror = () => {
        faviconLarge.style.display = "none";
        const letter = document.createElement("div");
        letter.className = "favicon-letter";
        letter.textContent = (tab.title || "?")[0].toUpperCase();
        faviconTile.appendChild(letter);
      };
      faviconTile.appendChild(faviconLarge);
      thumbnail.appendChild(faviconTile);
    }

    // Tab info section
    const tabInfo = document.createElement("div");
    tabInfo.className = "tab-info";

    const tabHeader = document.createElement("div");
    tabHeader.className = "tab-header";

    // In grid view the thumbnail shows a screenshot, so put a small favicon in
    // front of the title (mirrors the main grid). In list view the favicon tile
    // in the thumbnail already serves as the leading icon.
    if (hasValidScreenshot) {
      const headerFavicon = document.createElement("img");
      headerFavicon.className = "tab-favicon";
      headerFavicon.loading = "lazy";
      headerFavicon.decoding = "async";
      headerFavicon.alt = "";
      const headerFaviconUrl = tab.favIconUrl || getFaviconUrl(tab.url, 16);
      if (headerFaviconUrl) {
        headerFavicon.src = headerFaviconUrl;
        headerFavicon.onerror = () => {
          headerFavicon.style.display = "none";
        };
      } else {
        headerFavicon.style.display = "none";
      }
      tabHeader.appendChild(headerFavicon);
    }

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = tab.title || "Untitled";
    title.title = tab.title || "";

    tabHeader.appendChild(title);
    tabInfo.appendChild(tabHeader);

    // URL domain
    const domain = document.createElement("span");
    domain.className = "tab-url";
    try {
      domain.textContent = new URL(tab.url || "").hostname;
    } catch {
      domain.textContent = "";
    }
    tabInfo.appendChild(domain);

    // Add elements to card
    card.appendChild(thumbnail);
    card.appendChild(tabInfo);

    // Click to switch
    card.addEventListener("click", () => {
      if (tab.id) {
        chrome.runtime.sendMessage({ action: "switchToTab", tabId: tab.id });
        closeQuickSwitch();
      }
    });

    fragment.appendChild(card);
    quickSwitchCards.push(card);
  });

  grid.appendChild(fragment);
  syncPanelDensity(
    quickSwitchGrid?.closest(".tab-flow-container") as HTMLElement | null,
    quickSwitchGrid,
    tabs.length,
  );
  updateQuickSwitchSelection(true);
}

function clearQuickSwitchRenderedTabs() {
  if (quickSwitchGrid) {
    quickSwitchGrid.textContent = "";
  }
  quickSwitchCards = [];
  quickSwitchLastSelectedIndex = -1;
}

function applyQuickSwitchSelection(index: number, selected: boolean) {
  const card = quickSwitchCards[index];
  if (!card) return;
  card.classList.toggle("selected", selected);
  card.setAttribute("aria-selected", selected ? "true" : "false");
}

export function updateQuickSwitchSelection(forceRefresh = false) {
  if (!quickSwitchGrid || quickSwitchCards.length === 0) return;

  const selectedIndex = state.selectedIndex;
  if (selectedIndex < 0 || selectedIndex >= quickSwitchCards.length) return;

  if (forceRefresh) {
    quickSwitchCards.forEach((card, index) => {
      const isSelected = index === selectedIndex;
      card.classList.toggle("selected", isSelected);
      card.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
  } else if (quickSwitchLastSelectedIndex !== selectedIndex) {
    applyQuickSwitchSelection(quickSwitchLastSelectedIndex, false);
    applyQuickSwitchSelection(selectedIndex, true);
  }

  const selectedCard = quickSwitchCards[selectedIndex];
  selectedCard?.scrollIntoView({ block: "nearest", behavior: "auto" });
  quickSwitchLastSelectedIndex = selectedIndex;
}

export function advanceQuickSwitchSelection(step: number) {
  if (!state.quickSwitchTabs || state.quickSwitchTabs.length === 0) return;

  const total = state.quickSwitchTabs.length;
  state.selectedIndex = (state.selectedIndex + step + total) % total;
  updateQuickSwitchSelection();
}

export function closeQuickSwitch() {
  if (!state.isQuickSwitchVisible) return;

  state.isQuickSwitchVisible = false;
  focus.unlockPageInteraction();
  clearQuickSwitchRenderedTabs();
  releaseTabPayloadState(state);
  quickSwitchReadyTime = 0;

  if (quickSwitchOverlay) {
    hideOverlayFromTopLayer(quickSwitchOverlay);
  }

  // Remove keyboard listeners
  window.removeEventListener("keydown", handleQuickSwitchKeyDown, true);
  window.removeEventListener("keyup", handleQuickSwitchKeyUp, true);
  document.removeEventListener("keydown", handleQuickSwitchKeyDown, true);
  document.removeEventListener("keyup", handleQuickSwitchKeyUp, true);
}

function handleQuickSwitchKeyDown(e: KeyboardEvent) {
  if (!state.isQuickSwitchVisible) return;
  if (e.defaultPrevented) return;

  // Escape to cancel
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeQuickSwitch();
    return;
  }

  // Arrow navigation
  if (e.key === "ArrowDown" || e.key === "ArrowRight") {
    e.preventDefault();
    advanceQuickSwitchSelection(1);
    return;
  }

  if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
    e.preventDefault();
    advanceQuickSwitchSelection(-1);
    return;
  }

  // Enter to switch
  if (e.key === "Enter") {
    e.preventDefault();
    if (state.quickSwitchTabs.length > 0 && state.selectedIndex >= 0) {
      const tab = state.quickSwitchTabs[state.selectedIndex];
      if (tab?.id) {
        chrome.runtime.sendMessage({ action: "switchToTab", tabId: tab.id });
        closeQuickSwitch();
      }
    }
    return;
  }
}

function switchToQuickSwitchSelected() {
  if (state.quickSwitchTabs.length > 0 && state.selectedIndex >= 0) {
    const tab = state.quickSwitchTabs[state.selectedIndex];
    if (tab?.id) {
      chrome.runtime.sendMessage({ action: "switchToTab", tabId: tab.id });
      closeQuickSwitch();
    }
  }
}

function handleQuickSwitchKeyUp(e: KeyboardEvent) {
  if (!state.isQuickSwitchVisible) return;
  if (e.defaultPrevented) return;

  // Only react to the Alt key being released — this is the "commit" gesture,
  // matching Windows Alt+Tab behavior. Ignore all other keyups.
  if (e.key !== "Alt") return;

  e.preventDefault();
  e.stopPropagation();

  // Enforce a minimum display time so the user can actually see the overlay.
  // If Alt is released too quickly (during render), defer the switch until
  // the grace period expires.
  const elapsed = Date.now() - quickSwitchReadyTime;
  if (elapsed < QUICK_SWITCH_MIN_DISPLAY_MS) {
    const remaining = QUICK_SWITCH_MIN_DISPLAY_MS - elapsed;
    setTimeout(() => {
      if (state.isQuickSwitchVisible) {
        switchToQuickSwitchSelected();
      }
    }, remaining);
    return;
  }

  switchToQuickSwitchSelected();
}

export async function showQuickSwitch(
  tabs: Tab[],
  activeTabId: number | null | undefined
) {
  console.log(`[Quick Switch] Opening with ${tabs.length} tabs`);

  if (state.isQuickSwitchVisible) return;

  // Close regular overlay if open
  if (state.isOverlayVisible) {
    closeOverlay();
  }

  createQuickSwitchOverlay();

  if (!quickSwitchOverlay) {
    return;
  }

  // Apply latest cached view mode immediately (kept in sync via storage events).
  updateQuickSwitchViewUI();

  state.isQuickSwitchVisible = true;
  state.quickSwitchTabs = tabs;
  quickSwitchReadyTime = Date.now();

  // Start selection at the second tab (previous tab, like Alt+Tab)
  const activeIndex = tabs.findIndex((tab: Tab) => tab.id === activeTabId);
  if (tabs.length > 1 && activeIndex === 0) {
    state.selectedIndex = 1;
  } else if (activeIndex > 0) {
    state.selectedIndex = 0;
  } else {
    state.selectedIndex = 0;
  }

  // Show overlay
  showOverlayInTopLayer(quickSwitchOverlay);

  // Add keyboard listeners before rendering the tab list so Alt release is not
  // missed when many tabs make DOM work expensive.
  window.addEventListener("keydown", handleQuickSwitchKeyDown, true);
  window.addEventListener("keyup", handleQuickSwitchKeyUp, true);
  document.addEventListener("keydown", handleQuickSwitchKeyDown, true);
  document.addEventListener("keyup", handleQuickSwitchKeyUp, true);

  // Lock page interaction
  focus.lockPageInteraction();
  focus.blurPageElements();

  if (quickSwitchGrid) {
    // Setting focus to the grid ensures the keyup events continue to fire
    // even after document.body is marked inert.
    quickSwitchGrid.focus();
  }

  // Render tabs after the quick-switch commit listeners are active.
  renderQuickSwitchTabs(tabs);
}
