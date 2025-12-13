export const state = {
  overlay: null,
  currentTabs: [],
  activeTabs: [],
  filteredTabs: [],
  selectedIndex: 0,
  isOverlayVisible: false,
  viewMode: "active",
  recentItems: [],
  host: null,
  shadowRoot: null,
  styleElement: null,

  // DOM cache
  domCache: {
    grid: null,
    searchBox: null,
    container: null,
    searchWrap: null,
    backBtn: null,
    recentBtn: null,
  },

  // Virtual scrolling
  virtualScroll: {
    startIndex: 0,
    endIndex: 0,
    visibleCount: 20, // Render 20 tabs at a time
    bufferCount: 5, // Buffer above/below viewport
  },

  // Performance
  lastKeyTime: 0,
  keyThrottleMs: 16, // ~60fps
  resizeObserver: null,
  intersectionObserver: null,
  focusInterval: null, // For periodic focus enforcement

  // History view selection state
  history: {
    active: false,
    backEls: [],
    forwardEls: [],
    column: "back",
    index: 0,
  },
};
