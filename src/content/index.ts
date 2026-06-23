import { state } from "./state";
import {
  showTabFlow,
  showQuickSwitch,
  closeQuickSwitch,
  advanceQuickSwitchSelection,
} from "./ui/overlay";
import { selectNext } from "./input/keyboard";
import { enforceSingleSelection } from "./ui/rendering";
import { closeOverlay } from "./actions";

type MediaPlaybackResponse = {
  success: boolean;
  hasMedia: boolean;
  playing: boolean;
  error?: string;
};

function getMediaElements(): HTMLMediaElement[] {
  return Array.from(
    document.querySelectorAll("video, audio"),
  ) as HTMLMediaElement[];
}

function isMediaPlaying(media: HTMLMediaElement): boolean {
  return !media.paused && !media.ended && media.readyState > 2;
}

function reportMediaPresence(hasMedia: boolean, isPlaying: boolean) {
  chrome.runtime.sendMessage(
    { action: "reportMediaPresence", hasMedia, isPlaying },
    () => {
      if (chrome.runtime.lastError) {
        // Ignore
      }
    },
  );
}

// Media detection to report to background
function detectMedia() {
  try {
    const mediaElements = getMediaElements();
    const hasMedia = mediaElements.length > 0;

    // Check if any media is currently playing
    const isPlaying = mediaElements.some((media) => isMediaPlaying(media));
    reportMediaPresence(hasMedia, isPlaying);
  } catch (e) {
    // Ignore
  }
}

async function toggleTabMediaPlayback(): Promise<MediaPlaybackResponse> {
  const mediaElements = getMediaElements();
  if (mediaElements.length === 0) {
    return {
      success: false,
      hasMedia: false,
      playing: false,
      error: "No media found in this tab",
    };
  }

  const currentlyPlaying = mediaElements.some((media) => isMediaPlaying(media));

  if (currentlyPlaying) {
    mediaElements.forEach((media) => media.pause());
    const playing = mediaElements.some((media) => isMediaPlaying(media));
    reportMediaPresence(true, playing);
    return { success: true, hasMedia: true, playing };
  }

  const playResults = await Promise.allSettled(
    mediaElements.map(async (media) => {
      try {
        await media.play();
      } catch {
        // Ignore individual play failures. We verify final state below.
      }
      return isMediaPlaying(media);
    }),
  );

  const playing =
    playResults.some(
      (result) => result.status === "fulfilled" && result.value,
    ) || mediaElements.some((media) => isMediaPlaying(media));

  reportMediaPresence(true, playing);

  return playing
    ? { success: true, hasMedia: true, playing: true }
    : {
      success: false,
      hasMedia: true,
      playing: false,
      error: "Playback was blocked by the page or browser",
    };
}

// Also detect media state changes (play/pause events)
function setupMediaEventListeners() {
  try {
    document.addEventListener("play", () => detectMedia(), true);
    document.addEventListener("playing", () => detectMedia(), true);
    document.addEventListener("pause", () => detectMedia(), true);
    document.addEventListener("ended", () => detectMedia(), true);
  } catch (e) {
    // Ignore
  }
}

setupMediaEventListeners();

function scheduleInitialMediaDetection() {
  const schedule = () => detectMedia();
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(schedule, { timeout: 2000 });
  } else {
    setTimeout(schedule, 1000);
  }
}

// Check on load (deferred for lower overhead)
if (document.readyState === "complete") {
  scheduleInitialMediaDetection();
} else {
  window.addEventListener("load", scheduleInitialMediaDetection, { once: true });
}

// ============================================================================
// AUTO-CLOSE ON FOCUS / VISIBILITY CHANGE
// Close the overlay as soon as the page loses focus (e.g. user switches apps)
// or the document becomes hidden (user switches tabs). This keeps the
// extension "fresh" when returning to the page.
// ============================================================================
const closeAnyOverlayIfOpen = () => {
  if (state.isOverlayVisible) closeOverlay();
  if (state.isQuickSwitchVisible) closeQuickSwitch();
};

window.addEventListener("blur", closeAnyOverlayIfOpen);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) closeAnyOverlayIfOpen();
});

chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  if (request.action === "showTabFlow") {
    // If overlay already visible, treat repeated Alt+W as cycle-next
    if (state.isOverlayVisible) {
      selectNext();
      // Ensure only one selection is highlighted
      enforceSingleSelection(true);
      sendResponse({ success: true, advanced: true });
      return true;
    }
    showTabFlow(request.tabs, request.activeTabId, request.groups);
    sendResponse({ success: true });
  } else if (request.action === "showQuickSwitch") {
    // Quick switch (Alt+Q) - Alt+Tab style without search bar
    if (state.isQuickSwitchVisible) {
      // Cycle to next tab
      advanceQuickSwitchSelection(1);
      sendResponse({ success: true, advanced: true });
      return true;
    }
    showQuickSwitch(request.tabs, request.activeTabId, request.groups);
    sendResponse({ success: true });
  } else if (request.action === "quickSwitchCycleIfOpen") {
    if (!state.isQuickSwitchVisible) {
      sendResponse({ success: true, advanced: false });
      return true;
    }
    advanceQuickSwitchSelection(1);
    sendResponse({ success: true, advanced: true });
    return true;
  } else if (request.action === "toggleTabMediaPlayback") {
    void toggleTabMediaPlayback()
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({
          success: false,
          hasMedia: getMediaElements().length > 0,
          playing: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return true;
  }
  return true;
});
