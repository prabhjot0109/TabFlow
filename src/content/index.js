import "./utils/messaging.js";
import { state } from "./state.js";
import { showTabSwitcher } from "./ui/overlay.js";
import { selectNext } from "./input/keyboard.js";
import { enforceSingleSelection } from "./ui/rendering.js";

console.log("═══════════════════════════════════════════════════════");
console.log("Visual Tab Switcher - Content Script Loaded");
console.log("Features: Virtual Scrolling, Event Delegation, GPU Acceleration");
console.log("Target: <16ms interactions, 60fps, lazy loading");
console.log("═══════════════════════════════════════════════════════");

chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  if (request.action === "showTabSwitcher") {
    // If overlay already visible, treat repeated Alt+Q as cycle-next
    if (state.isOverlayVisible) {
      selectNext();
      // Ensure only one selection is highlighted
      enforceSingleSelection(true);
      sendResponse({ success: true, advanced: true });
      return true;
    }
    showTabSwitcher(request.tabs, request.activeTabId);
    sendResponse({ success: true });
  }
  return true;
});
