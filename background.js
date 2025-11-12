// Background service worker for Visual Tab Switcher
let tabScreenshots = new Map(); // Cache for tab screenshots
let recentTabOrder = []; // Track recently used tabs
let screenshotTimestamps = new Map(); // Track when screenshots were taken
const SCREENSHOT_CACHE_DURATION = 300000; // 5 minutes (longer cache)
const MAX_CACHED_TABS = 20; // Limit cache size to most recent 20 tabs
const CAPTURE_DELAY = 100; // Small delay for tab to render
let isCapturing = false; // Prevent concurrent captures

// Listen for tab activation to track recent order
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  updateRecentTabOrder(activeInfo.tabId);
  
  // Automatically capture screenshot of newly activated tab
  // This builds the cache naturally as user browses
  if (isCapturing) return; // Skip if already capturing
  
  try {
    isCapturing = true;
    const tab = await chrome.tabs.get(activeInfo.tabId);
    
    // Check if tab is capturable
    if (!tab.discarded && 
        tab.url && 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('edge://') &&
        !tab.url.startsWith('about:')) {
      
      // Small delay to let page render
      await new Promise(resolve => setTimeout(resolve, CAPTURE_DELAY));
      
      const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "jpeg",
        quality: 60
      });
      
      tabScreenshots.set(activeInfo.tabId, screenshot);
      screenshotTimestamps.set(activeInfo.tabId, Date.now());
      
      console.debug(`Captured screenshot for tab ${activeInfo.tabId}`);
    }
  } catch (error) {
    // Silently fail - not critical
    console.debug(`Could not capture tab ${activeInfo.tabId}:`, error.message);
  } finally {
    isCapturing = false;
  }
});

// Update recent tab order
function updateRecentTabOrder(tabId) {
  // Remove if already exists
  recentTabOrder = recentTabOrder.filter(id => id !== tabId);
  // Add to front
  recentTabOrder.unshift(tabId);
  // Keep only last MAX_CACHED_TABS
  if (recentTabOrder.length > MAX_CACHED_TABS) {
    // Remove excess tabs from cache
    const removedTabs = recentTabOrder.slice(MAX_CACHED_TABS);
    removedTabs.forEach(id => {
      tabScreenshots.delete(id);
      screenshotTimestamps.delete(id);
    });
    recentTabOrder = recentTabOrder.slice(0, MAX_CACHED_TABS);
  }
}

// Listen for command to show tab switcher
chrome.commands.onCommand.addListener((command) => {
  if (command === "show-tab-switcher" || command === "cycle-next-tab") {
    handleShowTabSwitcher();
  }
});

// Handle showing the tab switcher
async function handleShowTabSwitcher() {
  try {
    // Get current window tabs
    const currentWindow = await chrome.windows.getCurrent();
    const tabs = await chrome.tabs.query({ windowId: currentWindow.id });
    
    // Sort tabs by recent order
    const sortedTabs = sortTabsByRecent(tabs);
    
    // INSTANT RESPONSE: Return tabs with only cached screenshots
    // No waiting, no capturing - overlay opens immediately
    const tabsWithScreenshots = sortedTabs.map(tab => ({
      id: tab.id,
      title: tab.title || "Untitled",
      url: tab.url,
      favIconUrl: tab.favIconUrl,
      screenshot: tabScreenshots.get(tab.id) || null, // Use cached or null
      pinned: tab.pinned,
      index: tab.index,
      active: tab.active
    }));
    
    // Get active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send message to content script to show overlay IMMEDIATELY
    try {
      await chrome.tabs.sendMessage(activeTab.id, {
        action: "showTabSwitcher",
        tabs: tabsWithScreenshots,
        activeTabId: activeTab.id
      });
    } catch (err) {
      console.log("Content script not ready, injecting...");
      // If content script not ready, inject it
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ["content.js"]
        });
        
        // Also inject CSS
        await chrome.scripting.insertCSS({
          target: { tabId: activeTab.id },
          files: ["overlay.css"]
        });
        
        // Try again after injection with a longer delay
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(activeTab.id, {
              action: "showTabSwitcher",
              tabs: tabsWithScreenshots,
              activeTabId: activeTab.id
            });
          } catch (retryErr) {
            console.error("Failed to show tab switcher after injection:", retryErr);
          }
        }, 200);
      } catch (injectErr) {
        console.error("Failed to inject content script:", injectErr);
        // Show alert to user
        if (injectErr.message.includes('cannot be scripted')) {
          console.warn('Cannot inject on this page (chrome:// or extension page). Try on a regular webpage.');
        }
      }
    }
  } catch (error) {
    console.error("Error showing tab switcher:", error);
  }
}

// Sort tabs by recent usage
function sortTabsByRecent(tabs) {
  return tabs.sort((a, b) => {
    const aIndex = recentTabOrder.indexOf(a.id);
    const bIndex = recentTabOrder.indexOf(b.id);
    
    if (aIndex === -1 && bIndex === -1) return a.index - b.index;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    
    return aIndex - bIndex;
  });
}

// Capture screenshots for tabs
// NOTE: This function is no longer used for showing overlay
// It can be used for on-demand capture if needed
async function captureTabScreenshots(tabs) {
  const tabsWithScreenshots = [];
  const currentTime = Date.now();
  
  for (const tab of tabs) {
    let screenshot = null;
    
    // Check if we have a cached screenshot that's still fresh
    if (tabScreenshots.has(tab.id)) {
      const timestamp = screenshotTimestamps.get(tab.id);
      if (timestamp && (currentTime - timestamp) < SCREENSHOT_CACHE_DURATION) {
        screenshot = tabScreenshots.get(tab.id);
      }
    }
    
    tabsWithScreenshots.push({
      id: tab.id,
      title: tab.title || "Untitled",
      url: tab.url,
      favIconUrl: tab.favIconUrl,
      screenshot: screenshot,
      pinned: tab.pinned,
      index: tab.index,
      active: tab.active
    });
  }
  
  return tabsWithScreenshots;
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "switchToTab") {
    chrome.tabs.update(request.tabId, { active: true })
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }
  
  if (request.action === "closeTab") {
    chrome.tabs.remove(request.tabId)
      .then(() => {
        // Remove from cache
        tabScreenshots.delete(request.tabId);
        screenshotTimestamps.delete(request.tabId);
        recentTabOrder = recentTabOrder.filter(id => id !== request.tabId);
        sendResponse({ success: true });
      })
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  if (request.action === "refreshTabList") {
    handleShowTabSwitcher();
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === "captureTabScreenshot") {
    // Request to capture a specific tab's screenshot
    (async () => {
      try {
        const tab = await chrome.tabs.get(request.tabId);
        const wasActive = tab.active;
        
        if (!wasActive) {
          await chrome.tabs.update(request.tabId, { active: true });
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: "jpeg",
          quality: 50
        });
        
        tabScreenshots.set(request.tabId, screenshot);
        screenshotTimestamps.set(request.tabId, Date.now());
        
        sendResponse({ success: true, screenshot: screenshot });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

// Clear old screenshots periodically
setInterval(() => {
  const currentTime = Date.now();
  for (const [tabId, timestamp] of screenshotTimestamps.entries()) {
    if (currentTime - timestamp > SCREENSHOT_CACHE_DURATION) {
      tabScreenshots.delete(tabId);
      screenshotTimestamps.delete(tabId);
      console.debug(`Cleaned up old screenshot for tab ${tabId}`);
    }
  }
}, 60000); // Clean up every minute

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabScreenshots.delete(tabId);
  screenshotTimestamps.delete(tabId);
  recentTabOrder = recentTabOrder.filter(id => id !== tabId);
  console.debug(`Cleaned up closed tab ${tabId}`);
});

// Log cache statistics
function logCacheStats() {
  console.log(`Screenshot cache: ${tabScreenshots.size} tabs, Recent order: ${recentTabOrder.length} tabs`);
}

// Log stats every 5 minutes in debug mode
if (chrome.runtime.getManifest().version.includes('dev')) {
  setInterval(logCacheStats, 300000);
}

console.log("Visual Tab Switcher background service worker loaded");
console.log(`Cache settings: Max ${MAX_CACHED_TABS} tabs, ${SCREENSHOT_CACHE_DURATION/1000}s duration`);
