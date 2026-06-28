import { state, Tab } from "../state";
import { closeOverlay } from "../actions";
import { syncPanelDensity } from "./panel-layout";

const DEBUG_LOGGING = false;
const log = (...args: unknown[]) => {
  if (DEBUG_LOGGING) {
    console.log(...args);
  }
};

const VIRTUAL_RENDER_THRESHOLD = 50;
const VIRTUAL_ROW_HEIGHT = 48;
const VIRTUAL_ROW_GAP = 10;
const VIRTUAL_LIST_PADDING_TOP = 8;
const VIRTUAL_LIST_PADDING_BOTTOM = 12;
const VIRTUAL_SPACER_CLASS = "virtual-list-spacer";
let virtualScrollGrid: HTMLElement | null = null;
let virtualScrollFrame = 0;
let lastVirtualTabsRef: Tab[] | null = null;

function isListLayout(): boolean {
  const grid = state.domCache.grid;
  if (!grid) return false;
  return (
    grid.classList.contains("list-view") ||
    grid.classList.contains("search-mode") ||
    grid.classList.contains("recent-mode")
  );
}

// ============================================================================
// FAVICON API HELPER
// ============================================================================
export function getFaviconUrl(url?: string, fallbackUrl?: string, size: number = 32): string | null {
  if (url) {
    try {
      const favUrl = new URL(chrome.runtime.getURL("/_favicon/"));
      favUrl.searchParams.set("pageUrl", url);
      favUrl.searchParams.set("size", size.toString());
      return favUrl.toString();
    } catch {
      // Ignore
    }
  }
  return fallbackUrl || null;
}

export function shouldUseVirtualRendering(tabCount: number): boolean {
  return tabCount > VIRTUAL_RENDER_THRESHOLD && isListLayout();
}

// ============================================================================
// TAB CARD TEMPLATE (Performance Optimization)
// Template cloning is ~3x faster than creating elements individually
// ============================================================================
const TAB_CARD_TEMPLATE = document.createElement("template");
TAB_CARD_TEMPLATE.innerHTML = `
  <div class="tab-card" role="option" tabindex="-1" style="transform: translate3d(0, 0, 0);">
    <div class="tab-thumbnail"></div>
    <div class="tab-info">
      <div class="tab-header">
        <img class="tab-favicon" loading="lazy" decoding="async" style="display: none;">
        <div class="tab-title"></div>
      </div>
      <div class="tab-url" style="display: none;"></div>
    </div>
    <div class="tab-media-controls"></div>
    <button class="tab-close-btn" type="button" data-action="close" title="Close tab" aria-label="Close tab">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>
`;

// ============================================================================
// SVG ICON TEMPLATES (DOM-based for security - no innerHTML)
// Using template elements with cloneNode instead of innerHTML for SVG icons
// ============================================================================
const SVG_NS = "http://www.w3.org/2000/svg";

interface SVGDef {
  tag: string;
  attrs: Record<string, string>;
}

function createSVGTemplate(shapes: SVGDef[]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  shapes.forEach(({ tag, attrs }) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [key, val] of Object.entries(attrs)) {
      el.setAttribute(key, val);
    }
    svg.appendChild(el);
  });
  return svg;
}

// Pre-create SVG templates for cloning (faster than innerHTML)
const SVG_PLAY_TEMPLATE = createSVGTemplate([
  { tag: "polygon", attrs: { points: "6 3 20 12 6 21 6 3", fill: "currentColor" } }
]);

const SVG_PAUSE_TEMPLATE = createSVGTemplate([
  { tag: "rect", attrs: { x: "14", y: "4", width: "4", height: "16", rx: "1", fill: "currentColor", stroke: "none" } },
  { tag: "rect", attrs: { x: "6", y: "4", width: "4", height: "16", rx: "1", fill: "currentColor", stroke: "none" } }
]);

const SVG_MUTE_TEMPLATE = createSVGTemplate([
  { tag: "polygon", attrs: { points: "11 5 6 9 2 9 2 15 6 15 11 19 11 5", fill: "currentColor" } },
  { tag: "line", attrs: { x1: "22", y1: "9", x2: "16", y2: "15" } },
  { tag: "line", attrs: { x1: "16", y1: "9", x2: "22", y2: "15" } }
]);

const SVG_UNMUTE_TEMPLATE = createSVGTemplate([
  { tag: "polygon", attrs: { points: "11 5 6 9 2 9 2 15 6 15 11 19 11 5", fill: "currentColor" } },
  { tag: "path", attrs: { d: "M15.54 8.46a5 5 0 0 1 0 7.07" } },
  { tag: "path", attrs: { d: "M19.07 4.93a10 10 0 0 1 0 14.14" } }
]);

// Helper to clone SVG template (safer than innerHTML)
function cloneSVG(template: SVGSVGElement): SVGSVGElement {
  return template.cloneNode(true) as SVGSVGElement;
}

export function createMediaIcon(type: "play" | "pause" | "mute" | "unmute"): SVGSVGElement {
  switch (type) {
    case "play":
      return cloneSVG(SVG_PLAY_TEMPLATE);
    case "pause":
      return cloneSVG(SVG_PAUSE_TEMPLATE);
    case "mute":
      return cloneSVG(SVG_MUTE_TEMPLATE);
    case "unmute":
      return cloneSVG(SVG_UNMUTE_TEMPLATE);
  }
}

// Create media control button with DOM API (no innerHTML)
function createMediaButton(
  className: string,
  action: string,
  svgTemplate: SVGSVGElement,
  title: string,
  pressed: boolean
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = className;
  btn.dataset.action = action;
  btn.title = title;
  btn.type = "button";
  btn.setAttribute("aria-label", title);
  btn.setAttribute("aria-pressed", String(pressed));
  btn.appendChild(cloneSVG(svgTemplate));
  return btn;
}

// ============================================================================
// RENDERING - STANDARD (< 50 tabs)
// ============================================================================
export function renderTabsStandard(tabs: Tab[]) {
  const startTime = performance.now();
  const grid = state.domCache.grid;
  const container = state.domCache.container;
  if (!grid) return;

  // Capture grid state before modification
  const captured = captureGridState(grid);

  // Clear grid and reset virtual list mode
  detachVirtualScroll(grid);
  lastVirtualTabsRef = null;
  grid.innerHTML = "";
  grid.classList.remove("virtual-list");
  grid.style.minHeight = "";

  // ARIA accessibility: set listbox role for screen readers
  grid.setAttribute("role", "listbox");
  grid.setAttribute("aria-label", "Open tabs");

  if (tabs.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "tab-flow-empty";
    emptyMsg.textContent = "No tabs found";
    grid.appendChild(emptyMsg);
    syncPanelDensity(container, grid, 0);
    applyGridFLIP(grid, captured);
    return;
  }

  // Use DocumentFragment for batched DOM updates
  const fragment = document.createDocumentFragment();

  tabs.forEach((tab: Tab, index: number) => {
    const tabCard = createTabCard(tab, index);
    tabCard.dataset.tabIndex = String(index);
    fragment.appendChild(tabCard);
  });

  // Single DOM update
  grid.appendChild(fragment);
  syncPanelDensity(container, grid, tabs.length);
  // After rendering, ensure only one card is selected in DOM
  enforceSingleSelection(false);

  // Apply FLIP transitions
  applyGridFLIP(grid, captured);

  // Load screenshots deferred beyond the initial ±10 window
  setupIntersectionObserver();

  const duration = performance.now() - startTime;
  log(`[PERF] Rendered ${tabs.length} tabs in ${duration.toFixed(2)}ms`);
}

// ============================================================================
// RENDERING - VIRTUAL SCROLLING (50+ tabs)
// ============================================================================
export function renderTabsVirtual(tabs: Tab[]) {
  const startTime = performance.now();
  const grid = state.domCache.grid;
  const container = state.domCache.container;
  if (!grid) return;

  grid.classList.add("virtual-list");
  attachVirtualScroll(grid);

  // ARIA accessibility: set listbox role for screen readers
  grid.setAttribute("role", "listbox");
  grid.setAttribute("aria-label", "Open tabs");

  if (tabs.length === 0) {
    lastVirtualTabsRef = null;
    grid.innerHTML = "";
    grid.style.minHeight = "";
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "tab-flow-empty";
    emptyMsg.textContent = "No tabs found";
    grid.appendChild(emptyMsg);
    syncPanelDensity(container, grid, 0);
    return;
  }

  const itemHeight = getVirtualItemHeight();
  const itemStride = getVirtualItemStride();
  const scrollTop = Math.max(0, grid.scrollTop - VIRTUAL_LIST_PADDING_TOP);
  const viewportHeight = Math.max(
    grid.clientHeight,
    itemStride * state.virtualScroll.visibleCount,
  );
  const bufferCount = state.virtualScroll.bufferCount;
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / itemStride) - bufferCount,
  );
  const endIndex = Math.min(
    tabs.length,
    Math.ceil((scrollTop + viewportHeight) / itemStride) + bufferCount,
  );

  const didRangeChange =
    startIndex !== state.virtualScroll.startIndex ||
    endIndex !== state.virtualScroll.endIndex ||
    lastVirtualTabsRef !== tabs;

  state.virtualScroll.startIndex = startIndex;
  state.virtualScroll.endIndex = endIndex;
  lastVirtualTabsRef = tabs;

  // Create placeholder for scrolling
  const totalHeight = getVirtualListHeight(tabs.length);
  grid.style.minHeight = "";
  syncVirtualSpacer(grid, totalHeight);

  if (!didRangeChange) {
    setupIntersectionObserver();
    enforceSingleSelection(false);
    return;
  }

  // Clear grid only after we know the render window changed.
  grid.innerHTML = "";
  syncVirtualSpacer(grid, totalHeight);

  // Render only visible tabs
  const fragment = document.createDocumentFragment();

  for (let i = startIndex; i < endIndex; i++) {
    const tab = tabs[i];
    const tabCard = createTabCard(tab, i);

    // Position absolutely for virtual scrolling
    tabCard.style.position = "absolute";
    tabCard.style.top = `${VIRTUAL_LIST_PADDING_TOP + i * itemStride}px`;

    fragment.appendChild(tabCard);
  }

  grid.appendChild(fragment);
  syncPanelDensity(container, grid, tabs.length);

  // Setup intersection observer for lazy loading
  setupIntersectionObserver();
  enforceSingleSelection(false);

  const duration = performance.now() - startTime;
  log(
    `[PERF] Virtual rendered ${endIndex - startIndex} of ${tabs.length
    } tabs in ${duration.toFixed(2)}ms`
  );
}

// ============================================================================
// CREATE TAB CARD (Template-based for ~3x faster rendering)
// ============================================================================
export function createTabCard(tab: Tab, index: number): HTMLElement {
  // Clone template (much faster than creating elements individually)
  const fragment = TAB_CARD_TEMPLATE.content.cloneNode(
    true
  ) as DocumentFragment;
  const tabCard = fragment.firstElementChild as HTMLElement;

  // Set data attributes
  if (tab && typeof tab.id === "number") {
    tabCard.dataset.tabId = String(tab.id);
  }
  if (tab?.sessionId) {
    tabCard.dataset.sessionId = tab.sessionId;
    tabCard.dataset.recent = "1";
  }
  if (tab?.isWebSearch) {
    tabCard.dataset.webSearch = "1";
    tabCard.dataset.searchQuery = tab.searchQuery;
  }
  tabCard.dataset.tabIndex = String(index);

  const tabTitle = tab.title ?? "Untitled";
  const tabUrl = tab.url ?? "";
  tabCard.setAttribute(
    "aria-selected",
    index === state.selectedIndex ? "true" : "false"
  );
  tabCard.setAttribute("aria-label", `${tabTitle} - ${tabUrl}`);

  // Determine if we should show screenshot or favicon
  const screenshot =
    typeof tab.screenshot === "string" && tab.screenshot.length > 0
      ? tab.screenshot
      : null;
  const isListView = Boolean(state.domCache.grid?.classList.contains("list-view"));
  const hasValidScreenshot = Boolean(screenshot) && !isListView;

  // Add classes efficiently
  const classList = tabCard.classList;
  classList.add(hasValidScreenshot ? "has-screenshot" : "has-favicon");
  if (index === state.selectedIndex) classList.add("selected");
  if (tab.pinned) classList.add("pinned");
  if (tab.sessionId) classList.add("recent-item");

  // Tab Groups Support
  let groupColor: string | null = null;
  let groupTitle: string | null = null;
  if (tab.groupId && tab.groupId !== -1 && state.groups) {
    const group = state.groups.find((g) => g.id === tab.groupId);
    if (group) {
      groupColor = getGroupColor(group.color);
      groupTitle = group.title || "Group";
      tabCard.dataset.groupId = String(group.id);
      tabCard.style.borderLeft = `6px solid ${groupColor}`;
      tabCard.style.background = `linear-gradient(to right, ${withAlpha(groupColor, "1A")}, rgba(255,255,255,0.02))`;
    }
  }

  // Get cached DOM elements from template
  const thumbnail = tabCard.querySelector(".tab-thumbnail") as HTMLElement;
  const titleEl = tabCard.querySelector(".tab-title") as HTMLElement;
  const urlEl = tabCard.querySelector(".tab-url") as HTMLElement;
  const faviconEl = tabCard.querySelector(".tab-favicon") as HTMLImageElement;
  const mediaControls = tabCard.querySelector(
    ".tab-media-controls"
  ) as HTMLElement;
  const closeBtn = tabCard.querySelector(".tab-close-btn") as HTMLButtonElement;

  // Set title
  titleEl.textContent = tabTitle;
  titleEl.title = tabTitle;

  // Thumbnail content
  if (tab.sessionId || !hasValidScreenshot) {
    // Show favicon tile
    const faviconTile = createFaviconTile(tab);
    thumbnail.appendChild(faviconTile);
  } else if (screenshot) {
    // Show screenshot
    const img = document.createElement("img");
    img.className = "screenshot-img";
    img.alt = tabTitle;
    img.loading = "lazy"; // Native lazy loading
    img.decoding = "async";
    // Load immediately if in viewport, otherwise lazy
    if (Math.abs(index - state.selectedIndex) < 10) {
      img.src = screenshot;
    } else {
      img.dataset.src = screenshot;
    }
    thumbnail.appendChild(img);
  }

  // Header favicon (only for screenshots)
  if (hasValidScreenshot) {
    const faviconUrl = getFaviconUrl(tab.url, tab.favIconUrl, 16);
    if (faviconUrl) {
      faviconEl.src = faviconUrl;
      faviconEl.style.display = "";
      faviconEl.onerror = () => {
        faviconEl.style.display = "none";
      };
    }

    // Show URL
    urlEl.textContent = tabUrl;
    urlEl.title = tabUrl;
    urlEl.style.display = "";
  }

  // Group pill
  if (groupColor && groupTitle) {
    const header = tabCard.querySelector(".tab-header") as HTMLElement;
    const pill = document.createElement("span");
    pill.className = "group-pill";
    pill.textContent = groupTitle;
    pill.style.setProperty("--group-pill-color", groupColor);
    pill.style.setProperty("--group-pill-bg", withAlpha(groupColor, "26"));
    header.appendChild(pill);
  }

  // Media controls - create buttons dynamically with DOM API (no innerHTML for security)
  if (!tab.sessionId && !tab.isWebSearch) {
    const isPlaying = getEffectivePlaybackState(tab);
    const isAudible = Boolean(tab.audible);
    const isMuted = Boolean(tab.mutedInfo?.muted);
    const hasMediaElements = Boolean(tab.hasMedia || isPlaying || isMuted);
    const showMediaControls = hasMediaElements || isAudible || isMuted;

    if (hasMediaElements) classList.add("has-media");
    if (isPlaying) classList.add("is-playing");
    if (isAudible) classList.add("is-audible");
    if (isMuted) classList.add("is-muted");

    closeBtn.dataset.tabId = String(tab.id);

    if (showMediaControls) {
      // Create play/pause button with cloned SVG (no innerHTML)
      const playBtn = createMediaButton(
        "tab-play-btn visible",
        "play-pause",
        isPlaying ? SVG_PAUSE_TEMPLATE : SVG_PLAY_TEMPLATE,
        isPlaying ? "Pause tab" : "Play tab",
        isPlaying
      );
      playBtn.dataset.tabId = String(tab.id);
      if (isPlaying) playBtn.classList.add("playing");
      mediaControls.appendChild(playBtn);

      // Create mute button with cloned SVG (no innerHTML)
      const muteBtn = createMediaButton(
        "tab-mute-btn visible",
        "mute",
        isMuted ? SVG_MUTE_TEMPLATE : SVG_UNMUTE_TEMPLATE,
        isMuted ? "Unmute tab" : "Mute tab",
        Boolean(isMuted)
      );
      muteBtn.dataset.tabId = String(tab.id);
      if (isMuted) muteBtn.classList.add("muted");
      mediaControls.appendChild(muteBtn);
    }
  } else {
    // Hide media controls and close button for session/web search items
    mediaControls.style.display = "none";
    closeBtn.style.display = "none";
  }

  return tabCard;
}

// ============================================================================
// CREATE FAVICON TILE (Template-based)
// ============================================================================
const FAVICON_TILE_TEMPLATE = document.createElement("template");
FAVICON_TILE_TEMPLATE.innerHTML = `<div class="favicon-tile"><img class="favicon-large" loading="lazy" decoding="async"><div class="favicon-letter" style="display:none;"></div></div>`;

export function createFaviconTile(tab: Tab): HTMLElement {
  const fragment = FAVICON_TILE_TEMPLATE.content.cloneNode(
    true
  ) as DocumentFragment;
  const faviconTile = fragment.firstElementChild as HTMLElement;
  const favicon = faviconTile.querySelector(
    ".favicon-large"
  ) as HTMLImageElement;
  const letter = faviconTile.querySelector(".favicon-letter") as HTMLElement;

  const faviconUrl = getFaviconUrl(tab.url, tab.favIconUrl, 32);

  if (faviconUrl) {
    favicon.src = faviconUrl;
    favicon.onerror = () => {
      favicon.style.display = "none";
      letter.textContent = (tab.title || "T")[0].toUpperCase();
      letter.style.display = "";
    };
  } else {
    favicon.style.display = "none";
    letter.textContent = (tab.title || "T")[0].toUpperCase();
    letter.style.display = "";
  }

  return faviconTile;
}

export function enforceSingleSelection(scrollIntoView: boolean) {
  try {
    const grid = state.domCache.grid;
    if (!grid) return;
    // Remove any stale selections currently in DOM
    const selectedEls = grid.querySelectorAll(".tab-card.selected");
    selectedEls.forEach((el) => {
      el.classList.remove("selected");
      el.setAttribute("aria-selected", "false");
    });
    // Apply selection to the current index if present in DOM
    const target = grid.querySelector(
      `.tab-card[data-tab-index="${state.selectedIndex}"]`
    );
    if (!target) return;
    target.classList.add("selected");
    target.setAttribute("aria-selected", "true");

    // Update active descendant for screen readers
    grid.setAttribute(
      "aria-activedescendant",
      target.id || `tab-card-${state.selectedIndex}`
    );
    if (!target.id) target.id = `tab-card-${state.selectedIndex}`;

    if (scrollIntoView) {
      requestAnimationFrame(() => {
        target.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest",
        });
      });
    }
  } catch (error) {
    console.error("[Tab Flow] Error enforcing selection:", error);
  }
}

export function updateSelection() {
  try {
    const grid = state.domCache.grid;
    if (!grid) return;

    const isVirtual = shouldUseVirtualRendering(state.filteredTabs.length);
    if (isVirtual) {
      scrollVirtualSelectionIntoView(grid);
      renderTabsVirtual(state.filteredTabs);
      enforceSingleSelection(false);
      return;
    }

    enforceSingleSelection(true);
  } catch (error) {
    console.error("[Tab Flow] Error in updateSelection:", error);
  }
}

export function setupIntersectionObserver() {
  if (state.intersectionObserver) {
    state.intersectionObserver.disconnect();
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const img = entry.target;
        if (!(img instanceof HTMLImageElement)) return;

        if (img.dataset.src && !img.src) {
          img.src = img.dataset.src;
          observer.unobserve(img);
        }
      });
    },
    {
      rootMargin: "100px", // Load images 100px before they enter viewport
    }
  );

  state.intersectionObserver = observer;

  // Observe all lazy-load images
  const grid = state.domCache.grid;
  if (!grid) return;

  const images = grid.querySelectorAll("img[data-src]");
  images.forEach((img) => {
    observer.observe(img);
  });
}

export function cleanupTabRendering() {
  const grid = state.domCache.grid;
  detachVirtualScroll(grid ?? undefined);
  lastVirtualTabsRef = null;

  if (!grid) return;

  grid.textContent = "";
  grid.classList.remove("virtual-list", "search-mode", "recent-mode");
  grid.style.minHeight = "";
  grid.removeAttribute("aria-activedescendant");
}

// History Views
export function renderHistoryView(historyData: {
  back: Array<{ url: string; title: string }>;
  forward: Array<{ url: string; title: string }>;
}) {
  const grid = state.domCache.grid;
  const panelContainer = state.domCache.container;
  if (!grid) return;

  detachVirtualScroll(grid);
  lastVirtualTabsRef = null;
  grid.innerHTML = "";
  grid.style.minHeight = "";
  grid.className = "tab-flow-grid search-mode"; // Reuse search-mode for column layout

  const container = document.createElement("div");
  container.className = "history-view";

  // Reset history selection caches
  state.history.active = true;
  state.history.backEls = [];
  state.history.forwardEls = [];

  // Back Column
  const backCol = document.createElement("div");
  backCol.className = "history-column";

  const backHeader = document.createElement("button");
  backHeader.type = "button";
  backHeader.className = "history-column-header";
  backHeader.textContent = "← BACK";
  
  if (historyData.back && historyData.back.length > 0) {
    backHeader.classList.add("clickable");
    backHeader.title = "Go back 1 page";
    backHeader.onclick = () => {
      window.history.go(-1);
      closeOverlay();
    };
  } else {
    backHeader.classList.add("disabled");
    backHeader.disabled = true;
    backHeader.title = "No back history";
  }
  backCol.appendChild(backHeader);

  const backColBody = document.createElement("div");
  backColBody.className = "history-column-body";

  if (historyData.back && historyData.back.length > 0) {
    // Create container for history items
    const backItemsContainer = document.createElement("div");
    backItemsContainer.className = "history-items-container";

    historyData.back.forEach((entry, index) => {
      // Back history is reversed (most recent first), so index 0 is -1
      const item = createHistoryItem(entry, -(index + 1));
      item.dataset.column = "back";
      item.dataset.index = String(index);
      backItemsContainer.appendChild(item);
      state.history.backEls.push(item);
    });

    backColBody.appendChild(backItemsContainer);
  } else {
    const empty = document.createElement("div");
    empty.className = "tab-flow-empty";
    empty.textContent = "No back history";
    empty.style.padding = "20px";
    empty.style.textAlign = "center";
    empty.style.color = "var(--text-muted)";
    backColBody.appendChild(empty);
  }
  backCol.appendChild(backColBody);

  // Forward Column
  const fwdCol = document.createElement("div");
  fwdCol.className = "history-column";

  const fwdHeader = document.createElement("button");
  fwdHeader.type = "button";
  fwdHeader.className = "history-column-header";
  fwdHeader.textContent = "FORWARD →";
  
  if (historyData.forward && historyData.forward.length > 0) {
    fwdHeader.classList.add("clickable");
    fwdHeader.title = "Go forward 1 page";
    fwdHeader.onclick = () => {
      window.history.go(1);
      closeOverlay();
    };
  } else {
    fwdHeader.classList.add("disabled");
    fwdHeader.disabled = true;
    fwdHeader.title = "No forward history";
  }
  fwdCol.appendChild(fwdHeader);

  const fwdColBody = document.createElement("div");
  fwdColBody.className = "history-column-body";

  if (historyData.forward && historyData.forward.length > 0) {
    // Create container for history items
    const fwdItemsContainer = document.createElement("div");
    fwdItemsContainer.className = "history-items-container";

    historyData.forward.forEach((entry, index) => {
      const item = createHistoryItem(entry, index + 1); // +1, +2, ...
      item.dataset.column = "forward";
      item.dataset.index = String(index);
      fwdItemsContainer.appendChild(item);
      state.history.forwardEls.push(item);
    });

    fwdColBody.appendChild(fwdItemsContainer);
  } else {
    const empty = document.createElement("div");
    empty.className = "tab-flow-empty";
    empty.textContent = "No forward history";
    empty.style.padding = "20px";
    empty.style.textAlign = "center";
    empty.style.color = "var(--text-muted)";
    fwdColBody.appendChild(empty);
  }
  fwdCol.appendChild(fwdColBody);

  container.appendChild(backCol);
  container.appendChild(fwdCol);
  grid.appendChild(container);
  syncPanelDensity(
    panelContainer,
    grid,
    historyData.back.length + historyData.forward.length,
  );

  // Choose a default selection
  if (state.history.backEls.length > 0) {
    state.history.column = "back";
    state.history.index = 0;
  } else if (state.history.forwardEls.length > 0) {
    state.history.column = "forward";
    state.history.index = 0;
  }
  updateHistorySelection();
}

export function createHistoryItem(
  entry: string | { url: string; title?: string },
  delta: number
) {
  // Handle both string (legacy) and object (new) formats
  const url = typeof entry === "string" ? entry : entry.url;
  const title = typeof entry === "string" ? entry : entry.title || entry.url;

  const item = document.createElement("div");
  item.className = "history-item";
  item.tabIndex = 0;
  item.dataset.delta = String(delta);

  item.onclick = () => {
    // Use browser's native history API directly for reliable navigation
    window.history.go(delta);
    closeOverlay();
  };

  item.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      window.history.go(delta);
      closeOverlay();
    }
  };

  // Favicon
  const faviconImg = document.createElement("img");
  faviconImg.className = "history-favicon";
  const faviconUrl = getFaviconUrl(url, undefined, 16);
  if (faviconUrl) {
    faviconImg.src = faviconUrl;
    faviconImg.onerror = () => {
      faviconImg.style.display = "none";
    };
  } else {
    faviconImg.style.display = "none";
  }

  const content = document.createElement("div");
  content.className = "history-item-content";

  const titleDiv = document.createElement("div");
  titleDiv.className = "history-item-title";
  titleDiv.textContent = title;
  titleDiv.title = title;

  const urlDiv = document.createElement("div");
  urlDiv.className = "history-item-url";
  try {
    const urlObj = new URL(url);
    urlDiv.textContent = urlObj.hostname + urlObj.pathname;
  } catch {
    urlDiv.textContent = url;
  }
  urlDiv.title = url;

  content.appendChild(titleDiv);
  content.appendChild(urlDiv);
  item.appendChild(faviconImg);
  item.appendChild(content);

  return item;
}

export function updateHistorySelection() {
  const backEls = state.history.backEls || [];
  const forwardEls = state.history.forwardEls || [];
  for (const el of backEls) el.classList.remove("selected");
  for (const el of forwardEls) el.classList.remove("selected");

  const list = state.history.column === "forward" ? forwardEls : backEls;
  if (!list.length) return;

  const idx = Math.min(Math.max(0, state.history.index), list.length - 1);
  state.history.index = idx;
  const selected = list[idx];
  if (selected) {
    selected.classList.add("selected");
    selected.scrollIntoView({ block: "nearest" });
  }
}

export function activateSelectedHistoryItem() {
  const backEls = state.history.backEls || [];
  const forwardEls = state.history.forwardEls || [];
  const list = state.history.column === "forward" ? forwardEls : backEls;
  const el = list[state.history.index];
  if (!el) return;
  const delta = Number(el.dataset.delta);
  if (!Number.isFinite(delta)) return;
  // Use browser's native history API directly
  window.history.go(delta);
  closeOverlay();
}

export function getGroupColor(colorName: string) {
  const colors: Record<string, string> = {
    grey: "#bdc1c6",
    blue: "#8ab4f8",
    red: "#f28b82",
    yellow: "#fdd663",
    green: "#81c995",
    pink: "#ff8bcb",
    purple: "#c58af9",
    cyan: "#78d9ec",
    orange: "#fcad70",
  };
  return colors[colorName] || colorName;
}

export function withAlpha(color: string, alphaHex: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alphaHex}` : color;
}

function getEffectivePlaybackState(tab: Pick<Tab, "isPlaying" | "audible">): boolean {
  return Boolean(tab.isPlaying ?? tab.audible);
}

function getVirtualItemHeight(): number {
  return VIRTUAL_ROW_HEIGHT;
}

function getVirtualItemStride(): number {
  return VIRTUAL_ROW_HEIGHT + VIRTUAL_ROW_GAP;
}

function getVirtualListHeight(itemCount: number): number {
  if (itemCount <= 0) return 0;

  return (
    VIRTUAL_LIST_PADDING_TOP +
    itemCount * VIRTUAL_ROW_HEIGHT +
    (itemCount - 1) * VIRTUAL_ROW_GAP +
    VIRTUAL_LIST_PADDING_BOTTOM
  );
}

function syncVirtualSpacer(grid: HTMLElement, height: number): void {
  let spacer = grid.querySelector(`:scope > .${VIRTUAL_SPACER_CLASS}`) as HTMLElement | null;

  if (!spacer) {
    spacer = document.createElement("div");
    spacer.className = VIRTUAL_SPACER_CLASS;
    grid.appendChild(spacer);
  }

  spacer.style.height = `${height}px`;
}

function handleVirtualScroll(): void {
  if (virtualScrollFrame !== 0) return;

  virtualScrollFrame = requestAnimationFrame(() => {
    virtualScrollFrame = 0;
    if (!shouldUseVirtualRendering(state.filteredTabs.length)) return;
    const grid = state.domCache.grid;
    if (!grid || state.filteredTabs.length === 0) return;

    const itemStride = getVirtualItemStride();
    const scrollTop = Math.max(0, grid.scrollTop - VIRTUAL_LIST_PADDING_TOP);
    const firstVisibleIndex = Math.max(0, Math.floor(scrollTop / itemStride));
    const lastVisibleIndex = Math.max(
      firstVisibleIndex,
      Math.min(
        state.filteredTabs.length - 1,
        Math.ceil((scrollTop + grid.clientHeight) / itemStride) - 1,
      ),
    );

    if (
      state.selectedIndex < firstVisibleIndex ||
      state.selectedIndex > lastVisibleIndex
    ) {
      state.selectedIndex = firstVisibleIndex;
    }

    renderTabsVirtual(state.filteredTabs);
  });
}

function attachVirtualScroll(grid: HTMLElement): void {
  if (virtualScrollGrid === grid) return;

  detachVirtualScroll();
  virtualScrollGrid = grid;
  grid.addEventListener("scroll", handleVirtualScroll, { passive: true });
}

function detachVirtualScroll(grid?: HTMLElement): void {
  const target = grid || virtualScrollGrid;
  if (!target) return;

  target.removeEventListener("scroll", handleVirtualScroll);
  if (!grid || virtualScrollGrid === grid) {
    virtualScrollGrid = null;
  }

  if (virtualScrollFrame !== 0) {
    cancelAnimationFrame(virtualScrollFrame);
    virtualScrollFrame = 0;
  }
}

function scrollVirtualSelectionIntoView(grid: HTMLElement): void {
  const itemHeight = getVirtualItemHeight();
  const itemStride = getVirtualItemStride();
  const itemTop = VIRTUAL_LIST_PADDING_TOP + state.selectedIndex * itemStride;
  const itemBottom = itemTop + itemHeight;
  const viewportTop = grid.scrollTop;
  const viewportBottom = viewportTop + grid.clientHeight;

  if (itemTop < viewportTop) {
    grid.scrollTop = itemTop;
  } else if (itemBottom > viewportBottom) {
    grid.scrollTop = Math.max(0, itemBottom - grid.clientHeight);
  }
}

// ============================================================================
// FLIP LAYOUT TRANSITION HELPERS
// ============================================================================
interface AnimatedHTMLElement extends HTMLElement {
  _onTransitionEnd?: (e: TransitionEvent) => void;
}

function getCardKey(card: HTMLElement): string | null {
  if (card.dataset.tabId) return `tab-${card.dataset.tabId}`;
  if (card.dataset.sessionId) return `session-${card.dataset.sessionId}`;
  if (card.dataset.webSearch === "1") return `search-${card.dataset.searchQuery}`;
  return null;
}

interface CapturedGridState {
  gridRect: DOMRect;
  scrollTop: number;
  stateMap: Map<string, { rect: DOMRect; element: HTMLElement }>;
}

function captureGridState(grid: HTMLElement): CapturedGridState {
  const gridRect = grid.getBoundingClientRect();
  const scrollTop = grid.scrollTop;
  const stateMap = new Map<string, { rect: DOMRect; element: HTMLElement }>();
  
  // Only capture if grid is not virtual list
  if (!grid.classList.contains("virtual-list")) {
    const cards = grid.querySelectorAll(".tab-card");
    cards.forEach((card) => {
      const htmlCard = card as HTMLElement;
      const key = getCardKey(htmlCard);
      if (key) {
        stateMap.set(key, {
          rect: htmlCard.getBoundingClientRect(),
          element: htmlCard,
        });
      }
    });
  }
  
  return { gridRect, scrollTop, stateMap };
}

function applyGridFLIP(
  grid: HTMLElement,
  captured: CapturedGridState,
): void {
  const { gridRect, scrollTop: oldScrollTop, stateMap: firstState } = captured;
  if (firstState.size === 0) return; // Nothing to animate from

  const newCards = grid.querySelectorAll(".tab-card");
  const lastState = new Map<string, { rect: DOMRect; element: HTMLElement }>();

  // 1. Capture new positions
  newCards.forEach((card) => {
    const htmlCard = card as HTMLElement;
    const key = getCardKey(htmlCard);
    if (key) {
      lastState.set(key, {
        rect: htmlCard.getBoundingClientRect(),
        element: htmlCard,
      });
    }
  });

  const animatedCards: Array<{
    card: AnimatedHTMLElement;
    dx: number;
    dy: number;
  }> = [];
  const enteringCards: AnimatedHTMLElement[] = [];

  // 2. Invert and prepare entry/FLIP animations
  newCards.forEach((card) => {
    const htmlCard = card as AnimatedHTMLElement;
    const key = getCardKey(htmlCard);
    if (!key) return;

    // Clean up any stale event listeners or styles on the card
    if (htmlCard._onTransitionEnd) {
      htmlCard.removeEventListener("transitionend", htmlCard._onTransitionEnd);
      htmlCard._onTransitionEnd = undefined;
    }
    htmlCard.style.transition = "";
    htmlCard.style.transform = "";
    htmlCard.classList.remove("card-entering", "card-entering-active");

    const first = firstState.get(key);
    if (first) {
      const last = lastState.get(key)!;
      const dx = first.rect.left - last.rect.left;
      const dy = first.rect.top - last.rect.top;

      if (dx !== 0 || dy !== 0) {
        htmlCard.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        htmlCard.style.transition = "none";
        animatedCards.push({ card: htmlCard, dx, dy });
      }
    } else {
      htmlCard.classList.add("card-entering");
      enteringCards.push(htmlCard);
    }
  });

  // 3. Handle exiting cards (removed items)
  firstState.forEach((first, key) => {
    if (!lastState.has(key)) {
      // Clone card to play exit animation
      const clone = first.element.cloneNode(true) as HTMLElement;
      clone.classList.remove("selected"); // Remove selected border to avoid confusion
      clone.classList.add("card-exiting-start");

      const left = first.rect.left - gridRect.left + grid.scrollLeft;
      const top = first.rect.top - gridRect.top + oldScrollTop;

      clone.style.left = `${left}px`;
      clone.style.top = `${top}px`;
      clone.style.width = `${first.rect.width}px`;
      clone.style.height = `${first.rect.height}px`;
      clone.style.margin = "0";

      grid.appendChild(clone);

      // Force layout trigger for clone
      clone.offsetHeight;

      requestAnimationFrame(() => {
        clone.classList.add("card-exiting-active");
      });

      setTimeout(() => {
        clone.remove();
      }, 250); // Matches CSS transition duration
    }
  });

  // 4. Play remaining and entering card transitions
  if (animatedCards.length > 0 || enteringCards.length > 0) {
    // Force layout trigger
    grid.offsetHeight;

    requestAnimationFrame(() => {
      // Play FLIP animations
      animatedCards.forEach(({ card }) => {
        card.style.transition = "transform 0.25s cubic-bezier(0.2, 0, 0, 1)";
        card.style.transform = "";

        const onTransitionEnd = (e: TransitionEvent) => {
          if (e.propertyName === "transform") {
            card.style.transition = "";
            card.removeEventListener("transitionend", onTransitionEnd);
            card._onTransitionEnd = undefined;
          }
        };
        card._onTransitionEnd = onTransitionEnd;
        card.addEventListener("transitionend", onTransitionEnd);
      });

      // Play entering animations
      enteringCards.forEach((card) => {
        card.classList.add("card-entering-active");

        const onTransitionEnd = (e: TransitionEvent) => {
          if (e.propertyName === "opacity" || e.propertyName === "transform") {
            card.classList.remove("card-entering", "card-entering-active");
            card.removeEventListener("transitionend", onTransitionEnd);
            card._onTransitionEnd = undefined;
          }
        };
        card._onTransitionEnd = onTransitionEnd;
        card.addEventListener("transitionend", onTransitionEnd);
      });
    });
  }
}

