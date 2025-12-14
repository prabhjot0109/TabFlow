(function(){(function(){function y(t="navigate"){try{if(document.hidden&&t==="navigate")return;const a={action:"REPORT_NAVIGATION",url:window.location.href,title:document.title,navType:t};chrome.runtime.sendMessage(a,r=>{chrome.runtime.lastError})}catch{}}y();window.addEventListener("popstate",()=>y("back_forward"));window.addEventListener("hashchange",()=>y("navigate"));const F=new MutationObserver(()=>{y("title_update")}),K=document.querySelector("title");if(K)F.observe(K,{childList:!0,characterData:!0,subtree:!0});else{const t=new MutationObserver(a=>{const r=document.querySelector("title");r&&(F.observe(r,{childList:!0,characterData:!0,subtree:!0}),t.disconnect())});t.observe(document.head||document.documentElement,{childList:!0,subtree:!0})}const re=history.pushState;history.pushState=function(...t){re.apply(this,t),y("navigate")};const ae=history.replaceState;history.replaceState=function(...t){ae.apply(this,t),y("navigate")};const e={overlay:null,currentTabs:[],activeTabs:[],filteredTabs:[],selectedIndex:0,isOverlayVisible:!1,viewMode:"active",recentItems:[],groups:[],collapsedGroups:new Set,host:null,shadowRoot:null,styleElement:null,domCache:{grid:null,searchBox:null,container:null,searchWrap:null,backBtn:null,recentBtn:null},virtualScroll:{startIndex:0,endIndex:0,visibleCount:20,bufferCount:5},lastKeyTime:0,keyThrottleMs:16,resizeObserver:null,intersectionObserver:null,focusInterval:null,closeTimeout:null,isClosing:!1,history:{active:!1,backEls:[],forwardEls:[],column:"back",index:0}},j="tab-switcher-host",oe=`/* Visual Tab Switcher - Modern Glass UI 2.0 */
/* ============================================================================
 * SHADOW DOM ENCAPSULATED STYLES
 * These styles are completely isolated from the host page.
 * The :host selector resets all inherited styles to prevent any leakage.
 * ============================================================================ */

/* Reset only within shadow DOM - does NOT affect host page */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:host {
  /* Reset ALL inherited properties to prevent host page styles from leaking in */
  all: initial !important;
  
  /* Ensure host doesn't affect page layout */
  display: contents !important;
  
  /* CSS Custom Properties - Material 3 Dark Theme (Lighter) */
  --bg-overlay: rgba(76, 76, 80, 0.8);
  --bg-surface: #202020;
  --bg-glass: #282830;
  --bg-glass-hover: #32323c;
  --border-subtle: #3a3a45;
  --border-hover: #4a4a58;
  --border-active: #5a5a6a;
  --text-primary: #f4f4f8;
  --text-secondary: #c0c0cc;
  --text-muted: #888899;
  --accent: #e8e8f0;
  --accent-light: #d0d0dc;
  --accent-glow: rgba(255, 255, 255, 0.12);
  --card-bg: #262630;
  --card-hover: #30303c;
  --card-selected: #383848;
  --danger: #ffb4ab;
  --success: #a8dab5;
  
  /* Material 3 Shape - Extra Rounded */
  --radius-3xl: 32px;
  --radius-2xl: 28px;
  --radius-xl: 24px;
  --radius-lg: 20px;
  --radius-md: 16px;
  --radius-sm: 12px;
  --radius-xs: 8px;
  --radius-full: 9999px;
  
  --shadow-xl: 0 24px 48px rgba(0, 0, 0, 0.4);
  --shadow-card: 0 4px 12px rgba(0, 0, 0, 0.25);
  --font-family: "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --transition-fast: 0.1s ease;
  --transition-smooth: 0.2s cubic-bezier(0.2, 0, 0, 1);
}

@media (prefers-color-scheme: light) {
  :host {
    /* Material 3 Light Theme - Clean & Bright */
    --bg-overlay: rgba(100, 100, 110, 0.45);
    --bg-surface: #fafafc;
    --bg-glass: #f2f2f6;
    --bg-glass-hover: #e8e8ee;
    --border-subtle: #d8d8e0;
    --border-hover: #c8c8d2;
    --border-active: #b0b0bc;
    --text-primary: #1a1a22;
    --text-secondary: #4a4a58;
    --text-muted: #7a7a8a;
    --accent: #202030;
    --accent-light: #404055;
    --accent-glow: rgba(0, 0, 0, 0.06);
    --card-bg: #f0f0f6;
    --card-hover: #e6e6ee;
    --card-selected: #dcdce6;
    --shadow-xl: 0 24px 48px rgba(0, 0, 0, 0.1);
    --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.06);
  }
}

/* Overlay */
.tab-switcher-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: none;
  align-items: flex-start;
  justify-content: center;
  padding-top: 6vh;
  font-family: var(--font-family);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* Enable pointer events on the overlay when visible */
  pointer-events: auto;
}

.tab-switcher-backdrop {
  position: absolute;
  inset: 0;
  background: var(--bg-overlay);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  animation: backdropFadeIn 0.25s cubic-bezier(0.2, 0, 0, 1);
}

.tab-switcher-container {
  position: relative;
  width: 900px;
  max-width: 94vw;
  max-height: 80vh;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-3xl);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  padding: 24px;
  overflow: hidden;
  animation: containerSlideIn 0.25s cubic-bezier(0.2, 0, 0, 1);
}

/* Search Header */
.tab-switcher-search-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.tab-switcher-search-wrap {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.tab-switcher-search {
  width: 100%;
  background: var(--bg-glass);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 16px 20px 16px 54px;
  font-size: 15px;
  font-weight: 400;
  color: var(--text-primary);
  outline: none;
  transition: all var(--transition-smooth);
  letter-spacing: -0.01em;
}

.tab-switcher-search:focus {
  background: var(--bg-glass-hover);
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-glow), var(--shadow-card);
}

.tab-switcher-search::placeholder {
  color: var(--text-muted);
  font-weight: 400;
}

.search-icon {
  position: absolute;
  left: 18px;
  color: var(--text-muted);
  pointer-events: none;
  display: flex;
  align-items: center;
  transition: all var(--transition-fast);
}

.tab-switcher-search:focus ~ .search-icon,
.tab-switcher-search-wrap:focus-within .search-icon {
  color: var(--accent);
  transform: scale(1.05);
}

/* Buttons */
.recently-closed-btn {
  background: var(--bg-glass);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  padding: 0 24px;
  border-radius: var(--radius-xl);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-smooth);
  white-space: nowrap;
  height: 54px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  letter-spacing: -0.01em;
}

.recently-closed-btn:hover {
  background: var(--bg-glass-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.recently-closed-btn:active {
  transform: translateY(0);
}

.recent-back-btn {
  position: absolute;
  left: 10px;
  z-index: 10;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--bg-glass-hover);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 18px;
  transition: all var(--transition-smooth);
}

.recent-back-btn:hover {
  background: var(--accent);
  color: white;
  transform: scale(1.08);
}

/* Grid - Active Tabs */
.tab-switcher-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px;
  padding-right: 8px;
  min-height: 200px;
  scroll-behavior: smooth;
}

/* Recent Mode & Search Mode - Column Layout */
.tab-switcher-grid.recent-mode,
.tab-switcher-grid.search-mode {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: auto;
}

.tab-switcher-grid::-webkit-scrollbar {
  width: 6px;
}

.tab-switcher-grid::-webkit-scrollbar-track {
  background: transparent;
  margin: 4px 0;
}

.tab-switcher-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 100px;
  transition: background 0.2s ease;
}

.tab-switcher-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

.tab-switcher-grid::-webkit-scrollbar-thumb:active {
  background: rgba(255, 255, 255, 0.35);
}

/* Firefox modern scrollbar */
.tab-switcher-grid {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

@media (prefers-color-scheme: light) {
  .tab-switcher-grid::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.12);
  }
  
  .tab-switcher-grid::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.2);
  }
  
  .tab-switcher-grid::-webkit-scrollbar-thumb:active {
    background: rgba(0, 0, 0, 0.3);
  }
  
  .tab-switcher-grid {
    scrollbar-color: rgba(0, 0, 0, 0.12) transparent;
  }
}

/* Empty State */
.tab-switcher-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  color: var(--text-muted);
  font-size: 14px;
  text-align: center;
}

/* Tab Card */
.tab-card {
  background: var(--card-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  overflow: hidden;
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 170px;
  transition: all var(--transition-smooth);
  box-shadow: var(--shadow-card);
}

.tab-card:hover {
  transform: translateY(-3px);
  border-color: var(--border-hover);
  background: var(--card-hover);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.tab-card.selected {
  border-color: var(--accent);
  background: var(--card-selected);
  box-shadow: 0 0 0 2px var(--accent-glow), 0 4px 16px rgba(0, 0, 0, 0.2);
}

.tab-card.selected::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--accent-glow);
  pointer-events: none;
  z-index: 0;
}

/* Pinned indicator */
.tab-card.pinned::after {
  content: '📌';
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 12px;
  z-index: 5;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
}

/* Audio indicator */
.tab-audio-indicator {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 5;
  opacity: 0.9;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.tab-audio-indicator svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.tab-audio-indicator.muted {
  color: #ff5252;
}

/* Web Search Card */
.tab-card[data-web-search="1"] {
  width: 100% !important;
  height: 60px !important;
  flex-direction: row !important;
  align-items: center !important;
  padding: 0 18px !important;
  gap: 14px !important;
}

.tab-card[data-web-search="1"]:hover {
  transform: translateY(-2px);
}

/* Thumbnail Area */
.tab-thumbnail {
  flex: 1;
  min-height: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.08) 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-card[data-web-search="1"] .tab-thumbnail {
  flex: 0 0 36px;
  height: 36px;
  width: 36px;
  border-radius: var(--radius-md);
  background: var(--bg-glass);
}

.screenshot-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  opacity: 0.95;
  transition: all var(--transition-smooth);
}

.tab-card:hover .screenshot-img {
  opacity: 1;
  transform: scale(1.02);
}

/* Favicon Tile */
.favicon-tile {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--bg-glass) 0%, transparent 100%);
}

.tab-card[data-web-search="1"] .favicon-tile {
  background: transparent;
}

.favicon-large {
  width: 44px;
  height: 44px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  transition: transform var(--transition-smooth);
}

.tab-card:hover .favicon-large {
  transform: scale(1.08);
}

.tab-card[data-web-search="1"] .favicon-large {
  width: 26px;
  height: 26px;
}

.favicon-letter {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--bg-glass-hover);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
  transition: all var(--transition-smooth);
}

.tab-card:hover .favicon-letter {
  transform: scale(1.05);
  border-color: var(--border-hover);
}

/* Tab Info */
.tab-info {
  padding: 12px 14px;
  background: transparent;
  position: relative;
  z-index: 1;
}

.tab-card[data-web-search="1"] .tab-info {
  flex: 1 !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
}

.tab-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.tab-card[data-web-search="1"] .tab-header {
  margin: 0 !important;
  width: 100% !important;
}

.tab-favicon {
  width: 16px;
  height: 16px;
  opacity: 0.85;
  border-radius: 3px;
  flex-shrink: 0;
}

.tab-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  letter-spacing: -0.01em;
}

.tab-card.selected .tab-title {
  color: var(--accent-light);
}

.tab-card[data-web-search="1"] .tab-title {
  font-size: 15px;
  font-weight: 500;
}

.tab-url {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 26px;
  letter-spacing: -0.01em;
}

.tab-card[data-web-search="1"] .tab-url {
  display: none;
}

/* Close Button */
.tab-close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 300;
  opacity: 0;
  transform: scale(0.8);
  transition: all var(--transition-smooth);
  cursor: pointer;
  z-index: 10;
}

.tab-card:hover .tab-close-btn {
  opacity: 1;
  transform: scale(1);
}

.tab-close-btn:hover {
  background: var(--danger);
  transform: scale(1.1);
}

.tab-close-btn:active {
  transform: scale(0.95);
}

/* Mute Button */
.tab-mute-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 10;
  opacity: 0;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.tab-card:hover .tab-mute-btn,
.tab-mute-btn.muted {
  opacity: 0.9;
}

.tab-mute-btn:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
  transform: scale(1.1);
  opacity: 1;
}

.tab-mute-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.tab-mute-btn.muted {
  color: #ff5252;
  background: rgba(0, 0, 0, 0.8);
}

/* Footer/Help */
.tab-switcher-help {
  display: flex;
  gap: 24px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 12px;
  justify-content: center;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.tab-switcher-help span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  background: var(--bg-glass);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  font-family: "SF Mono", "Fira Code", monospace;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all var(--transition-smooth);
}

kbd:hover {
  background: var(--bg-glass-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

/* Animations */
@keyframes backdropFadeIn {
  from { 
    opacity: 0;
    backdrop-filter: blur(0);
  }
  to { 
    opacity: 1;
    backdrop-filter: blur(24px) saturate(180%);
  }
}

@keyframes containerSlideIn {
  from { 
    opacity: 0;
    transform: translateY(-20px) scale(0.96);
  }
  to { 
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Recent mode styles - Column Layout */
.tab-switcher-grid.recent-mode .tab-card {
  width: 100%;
  height: auto;
  min-height: 60px;
  flex-direction: row;
  align-items: center;
  padding: 14px 18px;
  gap: 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: none;
}

.tab-switcher-grid.recent-mode .tab-card:hover {
  transform: none;
  border-color: var(--border-hover);
  box-shadow: var(--shadow-card);
}

.tab-switcher-grid.recent-mode .tab-card.selected {
  border-color: var(--accent);
  background: var(--card-selected);
}

.tab-switcher-grid.recent-mode .tab-thumbnail {
  flex: 0 0 40px;
  height: 40px;
  width: 40px;
  min-height: 40px;
  border-radius: var(--radius-sm);
  background: var(--bg-glass);
}

.tab-switcher-grid.recent-mode .favicon-tile {
  border-radius: var(--radius-sm);
}

.tab-switcher-grid.recent-mode .favicon-large {
  width: 26px;
  height: 26px;
}

.tab-switcher-grid.recent-mode .favicon-letter {
  width: 40px;
  height: 40px;
  font-size: 17px;
  border-radius: var(--radius-sm);
}

.tab-switcher-grid.recent-mode .tab-info {
  flex: 1;
  padding: 0;
  min-width: 0;
}

.tab-switcher-grid.recent-mode .tab-header {
  margin-bottom: 3px;
}

.tab-switcher-grid.recent-mode .tab-title {
  font-size: 14px;
}

.tab-switcher-grid.recent-mode .tab-url {
  padding-left: 0;
  font-size: 12px;
}

.tab-switcher-grid.recent-mode .tab-close-btn {
  display: none;
}

/* Search mode styles - Column Layout (same as recent) */
.tab-switcher-grid.search-mode .tab-card {
  width: 100%;
  height: auto;
  min-height: 60px;
  flex-direction: row;
  align-items: center;
  padding: 14px 18px;
  gap: 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: none;
}

.tab-switcher-grid.search-mode .tab-card:hover {
  transform: none;
  border-color: var(--border-hover);
  box-shadow: var(--shadow-card);
}

.tab-switcher-grid.search-mode .tab-card.selected {
  border-color: var(--accent);
  background: var(--card-selected);
}

.tab-switcher-grid.search-mode .tab-thumbnail {
  flex: 0 0 36px;
  height: 36px;
  width: 36px;
  min-height: 36px;
  border-radius: var(--radius-sm);
  background: var(--bg-glass);
}

.tab-switcher-grid.search-mode .tab-info {
  flex: 1;
  padding: 0;
  min-width: 0;
}

.tab-switcher-grid.search-mode .tab-title {
  font-size: 14px;
}

.tab-switcher-grid.search-mode .tab-url {
  padding-left: 0;
  font-size: 12px;
  display: block;
}

/* Responsive */
@media (max-width: 768px) {
  .tab-switcher-container {
    padding: 16px;
    max-width: 98vw;
    max-height: 90vh;
  }
  
  .tab-switcher-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
  }
  
  .tab-card {
    height: 150px;
  }
  
  .tab-switcher-help {
    gap: 12px;
    font-size: 11px;
  }
  
  .recently-closed-btn {
    padding: 0 12px;
    font-size: 12px;
  }
}

/* History View */
.history-view {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    height: 100%;
    overflow: hidden;
    padding: 0 12px;
}

.history-column {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    padding-right: 4px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

.history-column::-webkit-scrollbar {
    width: 5px;
}

.history-column::-webkit-scrollbar-track {
    background: transparent;
    margin: 4px 0;
}

.history-column::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 100px;
    transition: background 0.2s ease;
}

.history-column::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
}

.history-column::-webkit-scrollbar-thumb:active {
    background: rgba(255, 255, 255, 0.35);
}

@media (prefers-color-scheme: light) {
    .history-column {
        scrollbar-color: rgba(0, 0, 0, 0.12) transparent;
    }
    
    .history-column::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.12);
    }
    
    .history-column::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.2);
    }
    
    .history-column::-webkit-scrollbar-thumb:active {
        background: rgba(0, 0, 0, 0.3);
    }
}

.history-column-header {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 8px;
    padding-left: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    position: sticky;
    top: 0;
    background: var(--bg-surface);
    z-index: 10;
    padding-top: 8px;
    padding-bottom: 8px;
}

.history-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: var(--radius-lg);
    background: var(--card-bg);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.history-favicon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
}

.history-item:hover {
    background: var(--card-hover);
    border-color: var(--border-hover);
}

.history-item.selected {
    background: var(--card-selected);
    border-color: var(--accent);
}

.history-item-content {
    flex: 1;
    min-width: 0;
}

.history-item-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
}

.history-item-url {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* History items container */
.history-items-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* ============================================================================
 * GROUP HEADER CARD - Tab Group Toggle Cards
 * These cards show the group name and allow expanding/collapsing tab groups.
 * Styled with explicit !important to ensure consistency across all websites.
 * ============================================================================ */

.tab-card.group-header-card {
  /* Override default card sizing - span full width */
  grid-column: 1 / -1 !important;
  width: 100% !important;
  height: 56px !important;
  min-height: 56px !important;
  max-height: 56px !important;
  
  /* Explicit flexbox layout */
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-start !important;
  
  /* Padding and gaps */
  padding: 0 !important;
  margin: 0 !important;
  gap: 0 !important;
  
  /* Appearance */
  border-radius: var(--radius-lg) !important;
  cursor: pointer !important;
  overflow: hidden !important;
  
  /* Ensure proper stacking */
  position: relative !important;
  z-index: 1 !important;
  
  /* Transition for hover effects */
  transition: all var(--transition-smooth) !important;
}

.tab-card.group-header-card:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25) !important;
}

.tab-card.group-header-card.selected {
  box-shadow: 0 0 0 2px var(--accent-glow), 0 4px 16px rgba(0, 0, 0, 0.2) !important;
}

/* Group Header Content Container */
.group-header-content {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  width: 100% !important;
  height: 100% !important;
  padding: 0 20px !important;
  box-sizing: border-box !important;
}

/* Group Header Left Side - Title and Count */
.group-header-left {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  min-width: 0 !important;
  flex: 1 !important;
}

.group-header-title {
  font-weight: 600 !important;
  font-size: 15px !important;
  color: var(--text-primary) !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  letter-spacing: -0.01em !important;
  margin: 0 !important;
  padding: 0 !important;
  line-height: 1.4 !important;
}

.group-header-count {
  font-size: 13px !important;
  font-weight: 400 !important;
  color: var(--text-secondary) !important;
  opacity: 0.7 !important;
  white-space: nowrap !important;
  margin: 0 !important;
  padding: 0 !important;
  line-height: 1.4 !important;
}

/* Group Header Right Side - State and Chevron */
.group-header-right {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  flex-shrink: 0 !important;
}

.group-header-state {
  font-size: 12px !important;
  font-weight: 500 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
  opacity: 0.9 !important;
  margin: 0 !important;
  padding: 0 !important;
  line-height: 1.4 !important;
}

.group-header-chevron {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 24px !important;
  height: 24px !important;
  color: currentColor !important;
  opacity: 0.8 !important;
  transition: transform var(--transition-fast) !important;
}

.group-header-chevron svg {
  width: 20px !important;
  height: 20px !important;
  stroke: currentColor !important;
  fill: none !important;
}

.tab-card.group-header-card:hover .group-header-chevron {
  opacity: 1 !important;
}

/* Collapsed state rotation */
.tab-card.group-header-card[data-collapsed="true"] .group-header-chevron {
  transform: rotate(-90deg) !important;
}

/* Hide default tab-card elements that don't apply to group headers */
.tab-card.group-header-card .tab-thumbnail,
.tab-card.group-header-card .tab-info,
.tab-card.group-header-card .tab-close-btn,
.tab-card.group-header-card .tab-mute-btn {
  display: none !important;
}

/* Responsive adjustments for group headers */
@media (max-width: 768px) {
  .tab-card.group-header-card {
    height: 48px !important;
    min-height: 48px !important;
    max-height: 48px !important;
  }
  
  .group-header-content {
    padding: 0 16px !important;
  }
  
  .group-header-title {
    font-size: 14px !important;
  }
  
  .group-header-count {
    font-size: 12px !important;
  }
  
  .group-header-state {
    font-size: 11px !important;
  }
}
`;function m(t){const a=performance.now(),r=e.domCache.grid;if(!r)return;if(r.innerHTML="",t.length===0){const c=document.createElement("div");c.className="tab-switcher-empty",c.textContent="No tabs found",r.appendChild(c);return}const n=document.createDocumentFragment();t.forEach((c,s)=>{const l=Q(c,s);c.isGroupHeader&&(l.dataset.isHeader="true"),l.dataset.tabIndex=String(s),n.appendChild(l)}),r.appendChild(n),R(!1);const o=performance.now()-a;console.log(`[PERF] Rendered ${t.length} tabs in ${o.toFixed(2)}ms`)}function b(t){const a=performance.now(),r=e.domCache.grid;if(r.innerHTML="",t.length===0){const i=document.createElement("div");i.className="tab-switcher-empty",i.textContent="No tabs found",r.appendChild(i);return}const n=e.virtualScroll.visibleCount,o=e.virtualScroll.bufferCount,c=Math.max(0,e.selectedIndex-o),s=Math.min(t.length,e.selectedIndex+n+o);e.virtualScroll.startIndex=c,e.virtualScroll.endIndex=s;const l=t.length*180;r.style.minHeight=`${l}px`;const d=document.createDocumentFragment();for(let i=c;i<s;i++){const h=t[i],f=Q(h,i);f.style.position="relative",f.style.top=`${i*180}px`,d.appendChild(f)}r.appendChild(d),se(),R(!1);const p=performance.now()-a;console.log(`[PERF] Virtual rendered ${s-c} of ${t.length} tabs in ${p.toFixed(2)}ms`)}function Q(t,a){if(t.isGroupHeader)return ne(t,a);const r=document.createElement("div");r.className="tab-card",t&&typeof t.id=="number"&&(r.dataset.tabId=String(t.id)),t?.sessionId&&(r.dataset.sessionId=t.sessionId,r.dataset.recent="1"),t?.isWebSearch&&(r.dataset.webSearch="1",r.dataset.searchQuery=t.searchQuery),r.dataset.tabIndex=String(a),r.setAttribute("role","option"),r.setAttribute("aria-selected",a===e.selectedIndex?"true":"false"),r.setAttribute("aria-label",`${t.title} - ${t.url}`),r.tabIndex=-1,r.style.transform="translate3d(0, 0, 0)";const n=t.screenshot&&typeof t.screenshot=="string"&&t.screenshot.length>0;n?r.classList.add("has-screenshot"):r.classList.add("has-favicon"),a===e.selectedIndex&&r.classList.add("selected"),t.pinned&&r.classList.add("pinned");let o=null,c="";if(t.groupId&&t.groupId!==-1&&e.groups){const i=e.groups.find(h=>h.id===t.groupId);i&&(o=J(i.color),c=i.title||"Group",r.dataset.groupId=String(i.id),r.style.borderLeft=`4px solid ${o}`)}const s=document.createElement("div");if(s.className="tab-thumbnail",!t.sessionId&&!t.isWebSearch){const i=document.createElement("button");i.className="tab-mute-btn",i.title=t.mutedInfo?.muted?"Unmute tab":"Mute tab",i.dataset.action="mute",i.dataset.tabId=String(t.id),t.mutedInfo?.muted?(i.classList.add("muted"),i.innerHTML='<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'):(i.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',t.audible&&(i.style.opacity="0.9")),s.appendChild(i)}if(t.sessionId){r.classList.add("recent-item");const i=$(t);s.appendChild(i)}else if(n){const i=document.createElement("img");i.className="screenshot-img",i.dataset.src=t.screenshot,i.alt=t.title,Math.abs(a-e.selectedIndex)<10&&(i.src=t.screenshot),s.appendChild(i)}else{const i=ie(t);if(i)s.appendChild(i),r.classList.add("has-placeholder");else{const h=$(t);s.appendChild(h)}}r.appendChild(s);const l=document.createElement("div");l.className="tab-info";const d=document.createElement("div");if(d.className="tab-header",t.favIconUrl&&(n||r.classList.contains("has-placeholder"))){const i=document.createElement("img");i.src=t.favIconUrl,i.className="tab-favicon",i.onerror=()=>{i.style.display="none"},d.appendChild(i)}const p=document.createElement("div");if(p.className="tab-title",p.textContent=t.title,p.title=t.title,d.appendChild(p),o){const i=document.createElement("span");i.className="group-pill",i.textContent=c,i.style.backgroundColor=o,i.style.opacity="0.3",i.style.color="#202124",i.style.fontSize="10px",i.style.fontWeight="600",i.style.padding="2px 6px",i.style.borderRadius="4px",i.style.marginLeft="8px",i.style.alignSelf="center",i.style.whiteSpace="nowrap",d.appendChild(i)}if(l.appendChild(d),n||r.classList.contains("has-placeholder")){const i=document.createElement("div");i.className="tab-url",i.textContent=t.url,i.title=t.url,l.appendChild(i)}if(r.appendChild(l),!t.sessionId&&!t.isWebSearch){const i=document.createElement("button");i.className="tab-close-btn",i.innerHTML="×",i.title="Close tab",i.dataset.action="close",t.id&&(i.dataset.tabId=String(t.id)),r.appendChild(i)}return r}function ne(t,a){const r=document.createElement("div");r.className="tab-card group-header-card";const n=t.groupId??-1,o=String(n);r.dataset.groupId=o,r.dataset.tabIndex=String(a);const c=n!==-1&&e.collapsedGroups.has(n);r.dataset.collapsed=c?"true":"false";const s=t.groupColor||"var(--border-subtle)";r.style.setProperty("--group-color",s),r.style.borderLeft=`6px solid ${s}`,r.style.border=`1px solid ${s}44`,r.style.borderLeftWidth="6px",r.style.background=`linear-gradient(to right, ${s}33, ${s}08)`,a===e.selectedIndex&&r.classList.add("selected");const l=document.createElement("div");l.className="group-header-content";const d=document.createElement("div");d.className="group-header-left";const p=document.createElement("span");p.className="group-header-title",p.textContent=t.groupTitle||"Untitled Group";const i=document.createElement("span");i.className="group-header-count";const h=e.currentTabs.filter(B=>B.groupId===n).length;i.textContent=`(${h} tabs)`,d.appendChild(p),d.appendChild(i);const f=document.createElement("div");f.className="group-header-right";const C=document.createElement("span");C.className="group-header-state",C.textContent=c?"Collapsed":"Expanded",C.style.color=s;const M=document.createElement("span");return M.className="group-header-chevron",M.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>',f.appendChild(C),f.appendChild(M),l.appendChild(d),l.appendChild(f),r.appendChild(l),r.onclick=B=>{B.stopPropagation(),n!==-1&&P(n)},r}function $(t){const a=document.createElement("div");if(a.className="favicon-tile",t.favIconUrl){const r=document.createElement("img");r.src=t.favIconUrl,r.className="favicon-large",r.onerror=()=>{r.style.display="none";const n=document.createElement("div");n.className="favicon-letter",n.textContent=(t.title||"T")[0].toUpperCase(),a.appendChild(n)},a.appendChild(r)}else{const r=document.createElement("div");r.className="favicon-letter",r.textContent=(t.title||"T")[0].toUpperCase(),a.appendChild(r)}return a}function ie(t){if(!t.url)return null;const r=["chrome://","edge://","devtools://","view-source:","about:"].some(h=>t.url.startsWith(h)),o=new URL(t.url).hostname;if(!r&&!o.includes("google.com"))return null;const c=document.createElement("div");c.className="tab-placeholder",c.style.width="100%",c.style.height="100%",c.style.display="flex",c.style.flexDirection="column",c.style.alignItems="center",c.style.justifyContent="center";let s="linear-gradient(135deg, #667eea 0%, #764ba2 100%)",l=o[0].toUpperCase(),d=o;t.url.startsWith("chrome://")?(s="linear-gradient(135deg, #2c3e50 0%, #3498db 100%)",d="Chrome System",l="⚙️"):o.includes("mail.google.com")?(s="linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)",l="✉️",d="Gmail"):o.includes("calendar.google.com")?(s="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",l="📅",d="Calendar"):o.includes("docs.google.com")&&(s="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",l="📝",d="Docs"),c.style.background=s;const p=document.createElement("div");p.textContent=l,p.style.fontSize="48px",p.style.marginBottom="8px",p.style.filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))";const i=document.createElement("div");return i.textContent=d,i.style.color="white",i.style.fontFamily="system-ui, sans-serif",i.style.fontWeight="600",i.style.fontSize="14px",i.style.textShadow="0 1px 2px rgba(0,0,0,0.3)",c.appendChild(p),c.appendChild(i),c}function D(t){if(!e.groups||e.groups.length===0)return t;const a=[],r=new Set,n=new Map;for(const o of t)o.groupId&&o.groupId!==-1&&(n.has(o.groupId)||n.set(o.groupId,[]),n.get(o.groupId).push(o));for(const[o,c]of n){if(r.has(o))continue;r.add(o);const s=e.groups.find(h=>h.id===o),l=s?J(s.color):"var(--border-subtle)",d=s?.title||"Group",p={id:-1*o,isGroupHeader:!0,groupId:o,groupColor:l,groupTitle:d,title:d,url:"",active:!1};a.push(p),e.collapsedGroups.has(o)||a.push(...c)}for(const o of t)(!o.groupId||o.groupId===-1)&&a.push(o);return a}function R(t){try{const a=e.domCache.grid;if(!a)return;a.querySelectorAll(".tab-card.selected").forEach(o=>{o.classList.remove("selected"),o.setAttribute("aria-selected","false")});const n=a.querySelector(`.tab-card[data-tab-index="${e.selectedIndex}"]`);if(!n)return;n.classList.add("selected"),n.setAttribute("aria-selected","true"),a.setAttribute("aria-activedescendant",n.id||`tab-card-${e.selectedIndex}`),n.id||(n.id=`tab-card-${e.selectedIndex}`),t&&requestAnimationFrame(()=>{n.scrollIntoView({behavior:"smooth",block:"nearest",inline:"nearest"})})}catch(a){console.error("[TAB SWITCHER] Error enforcing selection:",a)}}function E(){try{if(!e.domCache.grid)return;if(e.filteredTabs&&e.filteredTabs.length>50){const{startIndex:a,endIndex:r}=e.virtualScroll;(e.selectedIndex<a||e.selectedIndex>=r)&&b(e.filteredTabs)}R(!0)}catch(t){console.error("[TAB SWITCHER] Error in updateSelection:",t)}}function se(){e.intersectionObserver&&e.intersectionObserver.disconnect(),e.intersectionObserver=new IntersectionObserver(a=>{a.forEach(r=>{if(r.isIntersecting){const n=r.target;n.dataset.src&&!n.src&&(n.src=n.dataset.src,e.intersectionObserver.unobserve(n))}})},{rootMargin:"100px"}),e.domCache.grid.querySelectorAll("img[data-src]").forEach(a=>{e.intersectionObserver.observe(a)})}function ce(t){const a=e.domCache.grid;if(!a)return;a.innerHTML="",a.className="tab-switcher-grid search-mode";const r=document.createElement("div");r.className="history-view",e.history.active=!0,e.history.backEls=[],e.history.forwardEls=[];const n=document.createElement("div");n.className="history-column";const o=document.createElement("div");if(o.className="history-column-header",o.textContent="← BACK",n.appendChild(o),t.back&&t.back.length>0){const l=document.createElement("div");l.className="history-items-container",t.back.forEach((d,p)=>{const i=_(d,-(p+1));i.dataset.column="back",i.dataset.index=String(p),l.appendChild(i),e.history.backEls.push(i)}),n.appendChild(l)}else{const l=document.createElement("div");l.className="tab-switcher-empty",l.textContent="No back history",l.style.padding="20px",l.style.textAlign="center",l.style.color="var(--text-muted)",n.appendChild(l)}const c=document.createElement("div");c.className="history-column";const s=document.createElement("div");if(s.className="history-column-header",s.textContent="FORWARD →",c.appendChild(s),t.forward&&t.forward.length>0){const l=document.createElement("div");l.className="history-items-container",t.forward.forEach((d,p)=>{const i=_(d,p+1);i.dataset.column="forward",i.dataset.index=String(p),l.appendChild(i),e.history.forwardEls.push(i)}),c.appendChild(l)}else{const l=document.createElement("div");l.className="tab-switcher-empty",l.textContent="No forward history",l.style.padding="20px",l.style.textAlign="center",l.style.color="var(--text-muted)",c.appendChild(l)}r.appendChild(n),r.appendChild(c),a.appendChild(r),e.history.backEls.length>0?(e.history.column="back",e.history.index=0):e.history.forwardEls.length>0&&(e.history.column="forward",e.history.index=0),T()}function _(t,a){const r=typeof t=="string"?t:t.url,n=typeof t=="string"?t:t.title||t.url,o=document.createElement("div");o.className="history-item",o.tabIndex=0,o.dataset.delta=a,o.onclick=()=>{chrome.runtime.sendMessage({action:"NAVIGATE_HISTORY",delta:a}),u()},o.onkeydown=p=>{(p.key==="Enter"||p.key===" ")&&(p.preventDefault(),chrome.runtime.sendMessage({action:"NAVIGATE_HISTORY",delta:a}),u())};const c=document.createElement("img");c.className="history-favicon";try{const p=new URL(chrome.runtime.getURL("/_favicon/"));p.searchParams.set("pageUrl",r),p.searchParams.set("size","16"),c.src=p.toString()}catch{}const s=document.createElement("div");s.className="history-item-content";const l=document.createElement("div");l.className="history-item-title",l.textContent=n,l.title=n;const d=document.createElement("div");d.className="history-item-url";try{const p=new URL(r);d.textContent=p.hostname+p.pathname}catch{d.textContent=r}return d.title=r,s.appendChild(l),s.appendChild(d),o.appendChild(c),o.appendChild(s),o}function T(){const t=e.history.backEls||[],a=e.history.forwardEls||[];for(const c of t)c.classList.remove("selected");for(const c of a)c.classList.remove("selected");const r=e.history.column==="forward"?a:t;if(!r.length)return;const n=Math.min(Math.max(0,e.history.index),r.length-1);e.history.index=n;const o=r[n];o&&(o.classList.add("selected"),o.scrollIntoView({block:"nearest"}))}function le(){const t=e.history.backEls||[],a=e.history.forwardEls||[],n=(e.history.column==="forward"?a:t)[e.history.index];if(!n)return;const o=Number(n.dataset.delta);Number.isFinite(o)&&(chrome.runtime.sendMessage({action:"NAVIGATE_HISTORY",delta:o}),u())}function J(t){return{grey:"#bdc1c6",blue:"#8ab4f8",red:"#f28b82",yellow:"#fdd663",green:"#81c995",pink:"#ff8bcb",purple:"#c58af9",cyan:"#78d9ec",orange:"#fcad70"}[t]||t}function de(t){try{const a=t.target;if(a.dataset.action==="close"||a.classList.contains("tab-close-btn")){t.stopPropagation();const n=parseInt(a.dataset.tabId||a.parentElement.dataset.tabId),o=parseInt(a.dataset.tabIndex||a.parentElement.dataset.tabIndex);n&&!Number.isNaN(n)&&G(n,o);return}if(a.dataset.action==="mute"||a.closest(".tab-mute-btn")){t.stopPropagation();const n=a.closest(".tab-mute-btn"),o=parseInt(n.dataset.tabId);o&&!Number.isNaN(o)&&me(o,n);return}const r=a.closest(".tab-card");if(r){if(e.viewMode==="recent"||r.dataset.recent==="1"){const o=r.dataset.sessionId;o&&O(o);return}if(r.dataset.webSearch==="1"){const o=r.dataset.searchQuery;o&&(window.open(`https://www.google.com/search?q=${encodeURIComponent(o)}`,"_blank"),u());return}const n=parseInt(r.dataset.tabId);n&&!Number.isNaN(n)?z(n):console.error("[TAB SWITCHER] Invalid tab ID in card:",r)}}catch(a){console.error("[TAB SWITCHER] Error in handleGridClick:",a)}}function X(){return((e.domCache?.searchBox&&typeof e.domCache.searchBox.value=="string"?e.domCache.searchBox.value:"")||"").trim().startsWith(",")}function H(t){if(!e.isOverlayVisible)return;const a=t.target===e.domCache.searchBox,r=X()&&e.history.active,o=r&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"].includes(t.key);if(a&&t.key!=="Escape"&&!o)return;const c=performance.now();if(c-e.lastKeyTime<e.keyThrottleMs){t.preventDefault();return}e.lastKeyTime=c;try{if(r)switch(t.key){case"Escape":t.preventDefault(),u();return;case"Enter":t.preventDefault(),le();return;case"ArrowDown":{t.preventDefault();const s=e.history.column==="forward"?e.history.forwardEls:e.history.backEls;s.length&&(e.history.index=Math.min(e.history.index+1,s.length-1),T());return}case"ArrowUp":{t.preventDefault(),(e.history.column==="forward"?e.history.forwardEls:e.history.backEls).length&&(e.history.index=Math.max(e.history.index-1,0),T());return}case"ArrowLeft":{t.preventDefault(),e.history.column==="forward"&&e.history.backEls.length&&(e.history.column="back",e.history.index=Math.min(e.history.index,e.history.backEls.length-1),T());return}case"ArrowRight":{t.preventDefault(),e.history.column==="back"&&e.history.forwardEls.length&&(e.history.column="forward",e.history.index=Math.min(e.history.index,e.history.forwardEls.length-1),T());return}}switch(t.key){case"Escape":t.preventDefault(),u();break;case"Enter":if(t.preventDefault(),e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){const s=e.filteredTabs[e.selectedIndex];if(s){if(s.isGroupHeader){P(s.groupId);return}e.viewMode==="recent"&&s.sessionId?O(s.sessionId):s.id&&z(s.id)}}break;case"Tab":t.preventDefault(),t.shiftKey?I():k();break;case"ArrowRight":t.preventDefault(),Z();break;case"ArrowLeft":t.preventDefault(),ee();break;case"ArrowDown":t.preventDefault(),k();break;case"ArrowUp":t.preventDefault(),I();break;case"Delete":if(e.viewMode!=="recent"&&e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){t.preventDefault();const s=e.filteredTabs[e.selectedIndex];s?.id&&G(s.id,e.selectedIndex)}break;case"g":case"G":if(t.altKey&&(t.preventDefault(),e.viewMode!=="recent"&&e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length)){const s=e.filteredTabs[e.selectedIndex];s?.id&&fe(s.id)}break}}catch(s){console.error("[TAB SWITCHER] Error in handleKeyDown:",s)}}function N(){}function pe(t){try{if(X()&&e.history.active&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"].includes(t.key))return;if(["Delete","Tab","ArrowDown","ArrowUp","ArrowRight","ArrowLeft","Enter"].includes(t.key)){const o=performance.now();if(o-e.lastKeyTime<e.keyThrottleMs){t.preventDefault();return}e.lastKeyTime=o}if(t.key==="."&&(t.target.value||"").length===0){t.preventDefault(),e.viewMode==="recent"?L():V();return}if(t.key==="Backspace"){if((t.target.value||"").length===0&&e.viewMode==="recent"){t.preventDefault(),L();return}return}if(t.key==="Delete"){if(t.preventDefault(),e.viewMode!=="recent"&&e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){const o=e.filteredTabs[e.selectedIndex];o?.id&&G(o.id,e.selectedIndex)}return}if(t.key==="Tab"){t.preventDefault(),t.shiftKey?I():k();return}if(t.key==="ArrowDown"){t.preventDefault(),k();return}if(t.key==="ArrowUp"){t.preventDefault(),I();return}if(t.key==="ArrowRight"){t.preventDefault(),Z();return}if(t.key==="ArrowLeft"){t.preventDefault(),ee();return}if(t.key==="Enter"){if(t.preventDefault(),e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){const o=e.filteredTabs[e.selectedIndex];if(o.isGroupHeader){P(o.groupId);return}e.viewMode==="recent"&&o?.sessionId?O(o.sessionId):o?.isWebSearch?(window.open(`https://www.google.com/search?q=${encodeURIComponent(o.searchQuery)}`,"_blank"),u()):o?.id&&o.id>=0&&z(o.id)}return}}catch(a){console.error("[TAB SWITCHER] Error in handleSearchKeydown:",a)}}function A(){if(!e.domCache.grid)return 1;const t=e.domCache.grid,a=t.querySelectorAll(".tab-card");if(a.length===0)return 1;const r=window.getComputedStyle(t),n=parseFloat(r.columnGap)||0,o=t.clientWidth||t.offsetWidth||0,c=a[0].clientWidth||a[0].offsetWidth||0;return!o||!c?1:Math.max(1,Math.floor((o+n)/(c+n)))}function he(){try{if(!e.filteredTabs||e.filteredTabs.length===0){console.warn("[TAB SWITCHER] No tabs available for navigation");return}e.selectedIndex<0||e.selectedIndex>=e.filteredTabs.length?e.selectedIndex=0:(e.selectedIndex=e.selectedIndex+1,e.selectedIndex>=e.filteredTabs.length&&(e.selectedIndex=0)),E()}catch(t){console.error("[TAB SWITCHER] Error in selectNext:",t)}}function Z(){try{if(!e.filteredTabs||e.filteredTabs.length===0){console.warn("[TAB SWITCHER] No tabs available for navigation");return}const t=A(),a=e.selectedIndex+1;if(Math.floor(a/t)===Math.floor(e.selectedIndex/t))if(a<e.filteredTabs.length)e.selectedIndex=a;else{const r=Math.floor(e.selectedIndex/t)*t;e.selectedIndex=r}else{const r=Math.floor(e.selectedIndex/t)*t;e.selectedIndex=r}E()}catch(t){console.error("[TAB SWITCHER] Error in selectRight:",t)}}function ee(){try{if(!e.filteredTabs||e.filteredTabs.length===0){console.warn("[TAB SWITCHER] No tabs available for navigation");return}const t=A(),a=Math.floor(e.selectedIndex/t)*t;if(e.selectedIndex-a>0)e.selectedIndex=e.selectedIndex-1;else{const n=Math.min(a+t-1,e.filteredTabs.length-1);e.selectedIndex=n}E()}catch(t){console.error("[TAB SWITCHER] Error in selectLeft:",t)}}function k(){try{if(!e.filteredTabs||e.filteredTabs.length===0){console.warn("[TAB SWITCHER] No tabs available for navigation");return}const t=A(),a=Math.floor(e.selectedIndex/t),r=e.selectedIndex-a*t,n=(a+1)*t+r;n<e.filteredTabs.length?e.selectedIndex=n:e.selectedIndex=0,E()}catch(t){console.error("[TAB SWITCHER] Error in selectDown:",t)}}function I(){try{if(!e.filteredTabs||e.filteredTabs.length===0){console.warn("[TAB SWITCHER] No tabs available for navigation");return}const t=A(),a=Math.floor(e.selectedIndex/t),r=e.selectedIndex-a*t;if(a>0)e.selectedIndex=(a-1)*t+r;else{const o=(Math.ceil(e.filteredTabs.length/t)-1)*t+r;e.selectedIndex=Math.min(o,e.filteredTabs.length-1)}E()}catch(t){console.error("[TAB SWITCHER] Error in selectUp:",t)}}function ue(){try{document.activeElement&&document.activeElement!==document.body&&document.activeElement!==e.host&&document.activeElement.blur(),document.querySelectorAll("iframe").forEach(a=>{try{a.contentDocument?.activeElement&&a.contentDocument.activeElement.blur()}catch{}})}catch(t){console.debug("[TAB SWITCHER] Error blurring page elements:",t)}}function w(t){return t.target===e.host?!0:(t.composedPath?t.composedPath():[]).some(r=>r===e.host||r===e.shadowRoot||r===e.overlay)}function W(t){e.isOverlayVisible&&(w(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),t.target&&typeof t.target.blur=="function"&&t.target.blur(),e.domCache?.searchBox&&e.domCache.searchBox.focus()))}function g(t){if(e.isOverlayVisible&&!w(t)){if(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),e.domCache?.searchBox&&(e.domCache.searchBox.focus(),t.key&&t.key.length===1&&!t.ctrlKey&&!t.altKey&&!t.metaKey)){const a=e.domCache.searchBox,r=a.selectionStart||0,n=a.selectionEnd||0,o=a.value;a.value=o.slice(0,r)+t.key+o.slice(n),a.setSelectionRange(r+1,r+1),a.dispatchEvent(new Event("input",{bubbles:!0}))}return}}function v(t){if(e.isOverlayVisible&&!w(t))if(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),t.type==="beforeinput"&&t.data&&e.domCache?.searchBox){const a=e.domCache.searchBox;a.focus();const r=a.selectionStart||0,n=a.selectionEnd||0,o=a.value;a.value=o.slice(0,r)+t.data+o.slice(n),a.setSelectionRange(r+t.data.length,r+t.data.length),a.dispatchEvent(new Event("input",{bubbles:!0}))}else e.domCache?.searchBox&&e.domCache.searchBox.focus()}function x(t){e.isOverlayVisible&&(w(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault()))}function te(t){e.isOverlayVisible&&(w(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),t.target&&typeof t.target.blur=="function"&&t.target.blur(),e.domCache?.searchBox&&e.domCache.searchBox.focus()))}function S(t){e.isOverlayVisible&&(w(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault()))}function u(){try{if(!e.isOverlayVisible||e.isClosing)return;e.isClosing=!0,requestAnimationFrame(()=>{e.overlay&&(e.overlay.style.opacity="0"),e.closeTimeout&&clearTimeout(e.closeTimeout),e.closeTimeout=setTimeout(()=>{e.closeTimeout=null,e.isClosing=!1,e.overlay&&(e.overlay.style.display="none"),e.isOverlayVisible=!1,e.focusInterval&&(clearInterval(e.focusInterval),e.focusInterval=null),document.removeEventListener("keydown",H),document.removeEventListener("keyup",N),document.removeEventListener("focus",W,!0),document.removeEventListener("focusin",te,!0),document.removeEventListener("keydown",g,!0),document.removeEventListener("keypress",g,!0),document.removeEventListener("keyup",g,!0),document.removeEventListener("input",v,!0),document.removeEventListener("beforeinput",v,!0),document.removeEventListener("textInput",v,!0),document.removeEventListener("click",S,!0),document.removeEventListener("mousedown",S,!0),document.removeEventListener("compositionstart",x,!0),document.removeEventListener("compositionupdate",x,!0),document.removeEventListener("compositionend",x,!0),e.intersectionObserver&&(e.intersectionObserver.disconnect(),e.intersectionObserver=null)},200)})}catch(t){console.error("[TAB SWITCHER] Error in closeOverlay:",t),e.isOverlayVisible=!1,e.isClosing=!1,e.focusInterval&&(clearInterval(e.focusInterval),e.focusInterval=null);try{document.removeEventListener("keydown",H),document.removeEventListener("keyup",N),document.removeEventListener("focus",W,!0)}catch{}}}function z(t){try{if(!t||typeof t!="number"){console.error("[TAB SWITCHER] Invalid tab ID:",t);return}try{chrome.runtime.sendMessage({action:"switchToTab",tabId:t},()=>{chrome.runtime.lastError&&console.debug("[TAB SWITCHER] SW not ready:",chrome.runtime.lastError.message)})}catch(a){console.debug("[TAB SWITCHER] sendMessage warn:",a?.message||a)}u()}catch(a){console.error("[TAB SWITCHER] Exception in switchToTab:",a),u()}}function O(t){try{if(!t)return;try{chrome.runtime.sendMessage({action:"restoreSession",sessionId:t},()=>{chrome.runtime.lastError&&console.debug("[TAB SWITCHER] SW not ready (restoreSession):",chrome.runtime.lastError.message)})}catch(a){console.debug("[TAB SWITCHER] sendMessage warn:",a?.message||a)}u()}catch(a){console.error("[TAB SWITCHER] Exception in restoreSession:",a),u()}}function G(t,a){try{if(!t||typeof t!="number"){console.error("[TAB SWITCHER] Invalid tab ID for closing:",t);return}if(!e.currentTabs.some(n=>n&&n.id===t)){console.warn("[TAB SWITCHER] Tab no longer exists:",t),e.filteredTabs=e.filteredTabs.filter(n=>n&&n.id!==t),e.currentTabs=e.currentTabs.filter(n=>n&&n.id!==t),e.selectedIndex>=e.filteredTabs.length&&(e.selectedIndex=Math.max(0,e.filteredTabs.length-1)),e.filteredTabs.length>0?e.filteredTabs.length>50?b(e.filteredTabs):m(e.filteredTabs):u();return}chrome.runtime.sendMessage({action:"closeTab",tabId:t},n=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] Error closing tab:",chrome.runtime.lastError.message);return}n?.success&&(e.currentTabs=e.currentTabs.filter(o=>o&&o.id!==t),e.filteredTabs=e.filteredTabs.filter(o=>o&&o.id!==t),e.filteredTabs.length>0?(e.selectedIndex>=e.filteredTabs.length&&(e.selectedIndex=Math.max(0,e.filteredTabs.length-1)),e.filteredTabs.length>50?b(e.filteredTabs):m(e.filteredTabs),e.domCache.searchBox&&e.domCache.searchBox.focus()):u())})}catch(r){console.error("[TAB SWITCHER] Exception in closeTab:",r)}}function me(t,a){try{if(!t)return;chrome.runtime.sendMessage({action:"toggleMute",tabId:t},r=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] Error toggling mute:",chrome.runtime.lastError);return}if(r&&r.success){const n=r.muted;n?(a.classList.add("muted"),a.title="Unmute tab",a.innerHTML='<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'):(a.classList.remove("muted"),a.title="Mute tab",a.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>');const o=e.currentTabs.find(c=>c.id===t);o&&(o.mutedInfo||(o.mutedInfo={muted:!1}),o.mutedInfo.muted=n)}})}catch(r){console.error("[TAB SWITCHER] Exception in toggleMute:",r)}}function U(t){e.viewMode=t,e.domCache?.backBtn&&(e.domCache.backBtn.style.display=t==="recent"?"flex":"none"),e.domCache?.recentBtn&&(e.domCache.recentBtn.style.display=t==="recent"?"none":"inline-flex"),e.domCache?.searchBox&&(e.domCache.searchBox.placeholder=t==="recent"?"Search recently closed tabs...":"Search tabs by title or URL..."),e.domCache?.helpText&&(t==="recent"?e.domCache.helpText.innerHTML=`
        <span><kbd>Alt+Q</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Restore</span>
        <span><kbd>Backspace</kbd> Active Tabs</span>
        <span><kbd>Esc</kbd> Exit</span>
      `:e.domCache.helpText.innerHTML=`
        <span><kbd>Alt+Q</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Switch</span>
        <span><kbd>Delete</kbd> Close</span>
        <span><kbd>.</kbd> Recent Tabs</span>
        <span><kbd>/</kbd> History</span>
        <span><kbd>?</kbd> Web Search</span>
        <span><kbd>Esc</kbd> Exit</span>
      `)}function fe(t){try{if(!t||typeof t!="number")return;chrome.runtime.sendMessage({action:"createGroup",tabId:t},a=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] Error creating group:",chrome.runtime.lastError.message);return}a?.success&&u()})}catch(a){console.error("[TAB SWITCHER] Exception in createGroup:",a)}}function L(){if(e.viewMode==="active")return;U("active"),e.currentTabs=e.activeTabs||[];const t=D(e.currentTabs);e.filteredTabs=t,e.selectedIndex=0,e.domCache.grid&&(e.domCache.grid.classList.remove("recent-mode"),e.domCache.grid.classList.remove("search-mode")),e.filteredTabs.length>50?b(e.filteredTabs):m(e.filteredTabs),e.domCache.searchBox&&(e.domCache.searchBox.value="",e.domCache.searchBox.focus())}async function V(){if(e.viewMode==="recent")return;U("recent");let t=[];try{t=await new Promise(a=>{try{chrome.runtime.sendMessage({action:"getRecentlyClosed",maxResults:10},r=>{if(chrome.runtime.lastError){console.debug("[TAB SWITCHER] Runtime error:",chrome.runtime.lastError.message),a([]);return}r?.success?a(r.items||[]):a([])})}catch{a([])}})}catch(a){console.debug("[TAB SWITCHER] Failed to load recently closed:",a)}e.recentItems=t.map((a,r)=>({id:void 0,title:a.title,url:a.url,favIconUrl:a.favIconUrl,screenshot:null,sessionId:a.sessionId,index:r})),e.currentTabs=e.recentItems,e.filteredTabs=e.recentItems,e.selectedIndex=0,e.domCache.grid&&e.domCache.grid.classList.add("recent-mode"),m(e.filteredTabs),e.domCache.searchBox&&e.domCache.searchBox.focus()}function P(t){if(!t)return;e.collapsedGroups.has(t)?e.collapsedGroups.delete(t):e.collapsedGroups.add(t);const a=e.currentTabs,r=D(a);e.filteredTabs=r,r.length>50?b(r):m(r)}function be(){let t=null,a=0;const r=100,n=300,o=50;return c=>{const s=performance.now(),l=s-a,d=e.currentTabs.length>=o;t&&clearTimeout(t),!d&&l>=r?(a=s,q(c)):t=setTimeout(()=>{a=performance.now(),q(c)},d?n:r)}}function q(t){try{const a=t?.target?.value&&typeof t.target.value=="string"?t.target.value:e.domCache?.searchBox?.value??"",r=String(a).trim();if(r.startsWith(",")){e.history.active=!0,e.domCache.grid&&(e.domCache.grid.classList.add("search-mode"),e.domCache.grid.classList.remove("recent-mode")),e.domCache.helpText&&(e.domCache.helpText.innerHTML=`
            <span><kbd>,</kbd> History Mode</span>
            <span><kbd>Click</kbd> Navigate</span>
            <span><kbd>Backspace</kbd> Exit History</span>
            <span><kbd>Esc</kbd> Close</span>
          `),chrome.runtime.sendMessage({action:"GET_TAB_HISTORY"},s=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] History error:",chrome.runtime.lastError);return}console.log("[TAB SWITCHER] Received history:",s),ce(s||{back:[],forward:[]})});return}if(e.history.active=!1,e.history.backEls=[],e.history.forwardEls=[],r.startsWith("?")){const s=r.substring(1).trim(),l={id:"web-search",title:s?`Search Web for "${s}"`:"Type to search web...",url:s?`https://www.google.com/search?q=${encodeURIComponent(s)}`:"",favIconUrl:"https://www.google.com/favicon.ico",isWebSearch:!0,searchQuery:s};e.filteredTabs=[l],e.selectedIndex=0,e.domCache.grid&&(e.domCache.grid.classList.add("search-mode"),e.domCache.grid.classList.remove("recent-mode")),m(e.filteredTabs);return}e.domCache.grid&&e.domCache.grid.classList.remove("search-mode");const n=!!(t&&typeof t.inputType=="string"&&t.inputType==="deleteContentBackward");if(r==="."&&!n){e.domCache.searchBox.value="",e.viewMode==="recent"?L():V();return}if(!r){e.filteredTabs=e.currentTabs,e.selectedIndex=0,e.currentTabs.length>50?b(e.currentTabs):m(e.currentTabs);return}const c=e.currentTabs.map(s=>{const l=Y(s.title,r),d=Y(s.url,r),p=l.score>d.score?l:d;return{tab:s,match:p.match,score:p.score}}).filter(s=>s.match).sort((s,l)=>l.score-s.score).map(s=>s.tab);e.filteredTabs=c,e.selectedIndex=0,c.length>50?b(c):m(c)}catch(a){console.error("[TAB SWITCHER] Error in handleSearch:",a),e.filteredTabs=e.currentTabs,e.selectedIndex=0,m(e.currentTabs)}}function Y(t,a){if(!t)return{match:!1,score:0};const r=t.toLowerCase(),n=a.toLowerCase();if(n.length===0)return{match:!0,score:1};if(r===n)return{match:!0,score:100};if(r.startsWith(n))return{match:!0,score:80+n.length/r.length*10};if(r.includes(n))return{match:!0,score:50+n.length/r.length*10};let o=0,c=0,s=0,l=0,d=-1;for(;o<r.length&&c<n.length;){if(r[o]===n[c]){d===-1&&(d=o);let p=1;l>0&&(p+=2+l),(o===0||r[o-1]===" "||r[o-1]==="."||r[o-1]==="/"||r[o-1]==="-")&&(p+=3),s+=p,l++,c++}else l=0;o++}return c<n.length?{match:!1,score:0}:(s-=(r.length-n.length)*.1,d>0&&(s-=d*.5),{match:!0,score:Math.max(1,s)})}function ge(){try{if(!e.host||!e.host.isConnected){e.shadowRoot=null,e.styleElement=null;const t=document.getElementById(j);if(t)e.host=t;else{const a=document.createElement("tab-switcher-mount");a.id=j,a.style.cssText=`
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
        pointer-events: none !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        contain: layout style !important;
        isolation: isolate !important;
      `,(document.body||document.documentElement).appendChild(a),e.host=a}}if(e.shadowRoot||(e.host.shadowRoot?e.shadowRoot=e.host.shadowRoot:e.shadowRoot=e.host.attachShadow({mode:"open"})),!e.styleElement||!e.shadowRoot.contains(e.styleElement)){const t=document.createElement("style");t.textContent=oe,e.shadowRoot.appendChild(t),e.styleElement=t}return e.shadowRoot}catch(t){return console.error("[TAB SWITCHER] Failed to initialize shadow root:",t),null}}function ve(){if(e.overlay)return;const t=ge();if(!t)return;const a=document.createElement("div");a.id="visual-tab-switcher-overlay",a.className="tab-switcher-overlay",a.style.willChange="opacity";const r=document.createElement("div");r.className="tab-switcher-backdrop",a.appendChild(r);const n=document.createElement("div");n.className="tab-switcher-container",n.style.transform="translate3d(0, 0, 0)";const o=document.createElement("div");o.className="tab-switcher-search-row";const c=document.createElement("div");c.className="tab-switcher-search-wrap";const s=document.createElement("input");s.type="text",s.className="tab-switcher-search",s.placeholder="Search tabs by title or URL...",s.autocomplete="off";const l=document.createElement("button");l.type="button",l.className="recent-back-btn",l.title="Back to Active Tabs",l.textContent="←",l.addEventListener("click",()=>L());const d=document.createElement("button");d.className="recently-closed-btn",d.type="button",d.textContent="Recently closed tabs",d.addEventListener("click",()=>V());const p=document.createElement("div");p.className="search-icon",p.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',c.appendChild(l),c.appendChild(p),c.appendChild(s),o.appendChild(c),o.appendChild(d),n.appendChild(o);const i=document.createElement("div");i.className="tab-switcher-grid",i.id="tab-switcher-grid",i.setAttribute("role","listbox"),i.setAttribute("aria-label","Open tabs"),i.style.transform="translate3d(0, 0, 0)",n.appendChild(i);const h=document.createElement("div");h.className="tab-switcher-help",h.innerHTML=`
     <span><kbd>Alt+Q</kbd> Navigate</span>
     <span><kbd>Enter</kbd> Switch</span>
     <span><kbd>Delete</kbd> Close</span>
     <span><kbd>.</kbd> Recent Tabs</span>
     <span><kbd>/</kbd> History</span>
     <span><kbd>?</kbd> Web Search</span>
     <span><kbd>Esc</kbd> Exit</span>
   `,n.appendChild(h),a.appendChild(n),s.addEventListener("input",be()),s.addEventListener("keydown",pe),r.addEventListener("click",u),i.addEventListener("click",de),e.overlay=a,e.domCache={grid:i,searchBox:s,container:n,searchWrap:c,backBtn:l,recentBtn:d,helpText:h},t.appendChild(a),console.log("[PERF] Overlay created with GPU acceleration and event delegation")}function xe(t,a,r=[]){if(performance.now(),console.log(`[TAB SWITCHER] Opening with ${t.length} tabs and ${r.length} groups`),e.isOverlayVisible&&!e.isClosing)return;e.closeTimeout&&(clearTimeout(e.closeTimeout),e.closeTimeout=null),e.isClosing=!1,e.isOverlayVisible=!0,ve(),e.overlay&&(e.overlay.style.display="flex",e.overlay.style.opacity="0"),e.activeTabs=t,e.currentTabs=t,e.groups=r,e.filteredTabs=D(t),U("active");const n=t.findIndex(o=>o.id===a);t.length>1&&n===0?e.selectedIndex=1:(n>0,e.selectedIndex=0),e.filteredTabs.length>50?(console.log("[PERF] Using virtual scrolling for",e.filteredTabs.length,"tabs"),b(e.filteredTabs)):m(e.filteredTabs),e.overlay.style.display="flex",e.overlay.style.opacity="0",e.isOverlayVisible=!0,ue(),e.domCache.searchBox&&(e.domCache.searchBox.value="",e.domCache.searchBox.focus()),e.domCache.grid&&(e.domCache.grid.scrollTop=0),requestAnimationFrame(()=>{requestAnimationFrame(()=>{e.overlay&&(e.overlay.style.opacity="1")})}),document.addEventListener("keydown",H),document.addEventListener("keyup",N),document.addEventListener("focus",W,!0),document.addEventListener("focusin",te,!0),document.addEventListener("keydown",g,!0),document.addEventListener("keypress",g,!0),document.addEventListener("keyup",g,!0),document.addEventListener("input",v,!0),document.addEventListener("beforeinput",v,!0),document.addEventListener("textInput",v,!0),document.addEventListener("click",S,!0),document.addEventListener("mousedown",S,!0),document.addEventListener("compositionstart",x,!0),document.addEventListener("compositionupdate",x,!0),document.addEventListener("compositionend",x,!0),e.focusInterval&&clearInterval(e.focusInterval),e.focusInterval=setInterval(()=>{e.isOverlayVisible&&e.domCache.searchBox&&document.activeElement!==e.domCache.searchBox&&e.domCache.searchBox.focus()},100)}console.log("═══════════════════════════════════════════════════════");console.log("Visual Tab Switcher - Content Script Loaded");console.log("Features: Virtual Scrolling, Event Delegation, GPU Acceleration");console.log("Target: <16ms interactions, 60fps, lazy loading");console.log("═══════════════════════════════════════════════════════");chrome.runtime.onMessage.addListener((t,a,r)=>{if(t.action==="showTabSwitcher"){if(e.isOverlayVisible)return he(),R(!0),r({success:!0,advanced:!0}),!0;xe(t.tabs,t.activeTabId,t.groups),r({success:!0})}return!0});
})()
})()
