import { state } from "./state";
import * as handlers from "./input/keyboard";
import * as focus from "./input/focus";
import {
  cleanupTabRendering,
  renderTabsStandard,
  renderTabsVirtual,
  shouldUseVirtualRendering,
  createMediaIcon,
} from "./ui/rendering";
import { releaseTabPayloadState } from "./memory";
import { fuzzyMatch } from "./input/search";

function updateToggleButton(
  btnElement: HTMLElement,
  {
    title,
    pressed,
    iconName,
  }: { title: string; pressed: boolean; iconName: "play" | "pause" | "mute" | "unmute" }
) {
  btnElement.setAttribute("aria-label", title);
  btnElement.setAttribute("aria-pressed", String(pressed));
  btnElement.setAttribute("title", title);
  btnElement.replaceChildren(createMediaIcon(iconName));
}

function getEffectivePlaybackState(tab: {
  isPlaying?: boolean;
  audible?: boolean;
}): boolean {
  return Boolean(tab.isPlaying ?? tab.audible);
}

function updateTrackedTabState(
  tabId: number,
  updater: (tab: (typeof state.currentTabs)[number]) => void
) {
  const seen = new Set<object>();

  [state.currentTabs, state.filteredTabs, state.activeTabs].forEach((tabs) => {
    tabs.forEach((tab) => {
      if (!tab || tab.id !== tabId || seen.has(tab)) {
        return;
      }

      seen.add(tab);
      updater(tab);
    });
  });
}

function syncTabCardMediaState(tabId: number) {
  const tab =
    state.currentTabs.find((candidate) => candidate.id === tabId) ||
    state.filteredTabs.find((candidate) => candidate.id === tabId) ||
    state.activeTabs.find((candidate) => candidate.id === tabId);
  const grid = state.domCache.grid;

  if (!tab || !grid) {
    return;
  }

  const card = grid.querySelector(
    `.tab-card[data-tab-id="${tabId}"]`,
  ) as HTMLElement | null;
  if (!card) {
    return;
  }

  const isPlaying = getEffectivePlaybackState(tab);
  const isMuted = Boolean(tab.mutedInfo?.muted);
  const isAudible = Boolean(tab.audible);
  const hasMedia = Boolean(tab.hasMedia || isPlaying || isMuted);

  card.classList.toggle("has-media", hasMedia);
  card.classList.toggle("is-playing", isPlaying);
  card.classList.toggle("is-audible", isAudible);
  card.classList.toggle("is-muted", isMuted);

  const playBtn = card.querySelector(".tab-play-btn") as HTMLElement | null;
  if (playBtn) {
    playBtn.classList.toggle("playing", isPlaying);
    updateToggleButton(playBtn, {
      title: isPlaying ? "Pause tab" : "Play tab",
      pressed: isPlaying,
      iconName: isPlaying ? "pause" : "play",
    });
  }

  const muteBtn = card.querySelector(".tab-mute-btn") as HTMLElement | null;
  if (muteBtn) {
    muteBtn.classList.toggle("muted", isMuted);
    updateToggleButton(muteBtn, {
      title: isMuted ? "Unmute tab" : "Mute tab",
      pressed: isMuted,
      iconName: isMuted ? "mute" : "unmute",
    });
  }
}

function createKbd(text: string): HTMLElement {
  const kbd = document.createElement("kbd");
  kbd.textContent = text;
  return kbd;
}

export function renderHelpText(
  helpText: HTMLElement | undefined,
  items: Array<{ keys: string[]; action: string }>
) {
  if (!helpText) return;
  helpText.replaceChildren();
  items.forEach((item) => {
    const span = document.createElement("span");
    item.keys.forEach((key) => {
      span.appendChild(createKbd(key));
      span.appendChild(document.createTextNode(" "));
    });
    span.appendChild(document.createTextNode(item.action));
    helpText.appendChild(span);
  });
}

function cleanupGlobalListeners() {
  document.removeEventListener("keydown", handlers.handleKeyDown, true);
  document.removeEventListener("keyup", handlers.handleKeyUp, true);
  document.removeEventListener("focus", focus.handleGlobalFocus, true);
  document.removeEventListener("focusin", focus.handleGlobalFocusIn, true);
  document.removeEventListener("keydown", focus.handleGlobalKeydown, true);
  document.removeEventListener("keypress", focus.handleGlobalKeydown, true);
  document.removeEventListener("keyup", focus.handleGlobalKeydown, true);
  document.removeEventListener("input", focus.handleGlobalInput, true);
  document.removeEventListener("beforeinput", focus.handleGlobalInput, true);
  document.removeEventListener("textInput", focus.handleGlobalInput, true);
  document.removeEventListener("click", focus.handleGlobalClick, true);
  document.removeEventListener("mousedown", focus.handleGlobalClick, true);
  document.removeEventListener("compositionstart", focus.handleGlobalComposition, true);
  document.removeEventListener("compositionupdate", focus.handleGlobalComposition, true);
  document.removeEventListener("compositionend", focus.handleGlobalComposition, true);
}

export function closeOverlay() {
  try {
    if (!state.isOverlayVisible) return;

    // If already closing, don't restart logic, but ensure we don't break
    if (state.isClosing) return;

    state.isClosing = true;
    if (state.closeTimeout) {
      clearTimeout(state.closeTimeout);
      state.closeTimeout = null;
    }

    // Immediately restore page interaction and remove the overlay from the top layer.
    focus.unlockPageInteraction();
    if (state.overlay) {
      state.overlay.style.visibility = "hidden";
      state.overlay.style.pointerEvents = "none";

      if (state.overlay instanceof HTMLDialogElement) {
        if (state.overlay.open) {
          state.overlay.close();
        } else {
          state.overlay.removeAttribute("open");
        }
      }
    }
    state.isOverlayVisible = false;
    state.isClosing = false;

    // Clear focus enforcement interval
    if (state.focusInterval) {
      clearInterval(state.focusInterval);
      state.focusInterval = null;
    }

    // Cleanup
    state.lastFullscreenElement = null;
    cleanupGlobalListeners();

    if (state.intersectionObserver) {
      state.intersectionObserver.disconnect();
      state.intersectionObserver = null;
    }

    // Clean up resize observer
    if (state.resizeObserver) {
      state.resizeObserver.disconnect();
      state.resizeObserver = null;
    }

    cleanupTabRendering();
    releaseTabPayloadState(state);
  } catch (error) {
    console.error("[Tab Flow] Error in closeOverlay:", error);
    // Force cleanup even on error
    state.isOverlayVisible = false;
    state.isClosing = false;
    focus.unlockPageInteraction();
    if (state.focusInterval) {
      clearInterval(state.focusInterval);
      state.focusInterval = null;
    }
    // Try to remove listeners anyway
    try {
      cleanupGlobalListeners();
      cleanupTabRendering();
      releaseTabPayloadState(state);
    } catch { }
  }
}

export function switchToTab(tabId: number) {
  try {
    if (!tabId || typeof tabId !== "number") {
      console.error("[Tab Flow] Invalid tab ID:", tabId);
      return;
    }

    try {
      chrome.runtime.sendMessage({ action: "switchToTab", tabId }, () => {
        if (chrome.runtime.lastError) {
          console.debug(
            "[Tab Flow] SW not ready:",
            chrome.runtime.lastError.message
          );
        }
      });
    } catch (msgErr: any) {
      console.debug("[Tab Flow] sendMessage warn:", msgErr?.message || msgErr);
    }
    closeOverlay();
  } catch (error) {
    console.error("[Tab Flow] Exception in switchToTab:", error);
    closeOverlay();
  }
}

export function restoreSession(sessionId: string) {
  try {
    if (!sessionId) return;
    try {
      chrome.runtime.sendMessage(
        { action: "restoreSession", sessionId },
        () => {
          if (chrome.runtime.lastError) {
            console.debug(
              "[Tab Flow] SW not ready (restoreSession):",
              chrome.runtime.lastError.message
            );
          }
        }
      );
    } catch (msgErr: any) {
      console.debug("[Tab Flow] sendMessage warn:", msgErr?.message || msgErr);
    }
    closeOverlay();
  } catch (error) {
    console.error("[Tab Flow] Exception in restoreSession:", error);
    closeOverlay();
  }
}

function removeTabFromAllLists(tabId: number): void {
  state.currentTabs = state.currentTabs.filter((tab) => tab && tab.id !== tabId);
  state.filteredTabs = state.filteredTabs.filter((tab) => tab && tab.id !== tabId);
  state.activeTabs = state.activeTabs.filter((tab) => tab && tab.id !== tabId);
}

export function closeTab(tabId: number) {
  try {
    if (!tabId || typeof tabId !== "number") {
      console.error("[Tab Flow] Invalid tab ID for closing:", tabId);
      return;
    }

    const tabExists = state.currentTabs.some((tab) => tab && tab.id === tabId);
    if (!tabExists) {
      console.warn("[Tab Flow] Tab no longer exists:", tabId);
      removeTabFromAllLists(tabId);

      if (state.selectedIndex >= state.filteredTabs.length) {
        state.selectedIndex = Math.max(0, state.filteredTabs.length - 1);
      }

      if (state.filteredTabs.length > 0) {
        if (shouldUseVirtualRendering(state.filteredTabs.length)) {
          renderTabsVirtual(state.filteredTabs);
        } else {
          renderTabsStandard(state.filteredTabs);
        }
      } else {
        closeOverlay();
      }
      return;
    }

    chrome.runtime.sendMessage(
      {
        action: "closeTab",
        tabId: tabId,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Tab Flow] Error closing tab:",
            chrome.runtime.lastError.message
          );
          return;
        }

        if (response?.success) {
          removeTabFromAllLists(tabId);

          if (state.filteredTabs.length > 0) {
            if (state.selectedIndex >= state.filteredTabs.length) {
              state.selectedIndex = Math.max(0, state.filteredTabs.length - 1);
            }

            if (shouldUseVirtualRendering(state.filteredTabs.length)) {
              renderTabsVirtual(state.filteredTabs);
            } else {
              renderTabsStandard(state.filteredTabs);
            }

            if (state.domCache.searchBox) {
              state.domCache.searchBox.focus();
            }
          } else {
            closeOverlay();
          }
        }
      }
    );
  } catch (error) {
    console.error("[Tab Flow] Exception in closeTab:", error);
  }
}

export function duplicateTab(tabId: number) {
  try {
    if (!tabId || typeof tabId !== "number") {
      console.error("[Tab Flow] Invalid tab ID for duplication:", tabId);
      return;
    }

    chrome.runtime.sendMessage(
      { action: "duplicateTab", tabId },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Tab Flow] Error duplicating tab:",
            chrome.runtime.lastError.message
          );
          return;
        }
        if (response?.success) {
          const selectedTabId = state.filteredTabs[state.selectedIndex]?.id;
          chrome.runtime.sendMessage({ action: "getTabsForFlow" }, (getRes) => {
            if (chrome.runtime.lastError) {
              console.error(
                "[Tab Flow] Error getting tabs for Flow after duplication:",
                chrome.runtime.lastError.message
              );
              return;
            }
            if (getRes?.success && Array.isArray(getRes.tabs)) {
              state.activeTabs = getRes.tabs;
              state.currentTabs = getRes.tabs;
              state.groups = getRes.groups || [];

              // Re-apply current search query if any
              const query = state.domCache.searchBox?.value?.trim() || "";
              if (query) {
                const scoredTabs = state.currentTabs.map((tab) => {
                  const titleMatch = fuzzyMatch(tab.title, query);
                  const urlMatch = fuzzyMatch(tab.url, query);
                  const bestMatch = titleMatch.score > urlMatch.score ? titleMatch : urlMatch;
                  return { tab, match: bestMatch.match, score: bestMatch.score };
                });

                state.filteredTabs = scoredTabs
                  .filter((item) => item.match)
                  .sort((a, b) => b.score - a.score)
                  .map((item) => item.tab);
              } else {
                state.filteredTabs = state.currentTabs;
              }

              // Restore selected index
              if (typeof selectedTabId === "number") {
                const newIndex = state.filteredTabs.findIndex((tab) => tab.id === selectedTabId);
                if (newIndex !== -1) {
                  state.selectedIndex = newIndex;
                } else {
                  state.selectedIndex = Math.min(state.selectedIndex, state.filteredTabs.length - 1);
                }
              } else {
                state.selectedIndex = Math.min(state.selectedIndex, state.filteredTabs.length - 1);
              }
              if (state.selectedIndex < 0) {
                state.selectedIndex = 0;
              }

              // Re-render
              if (shouldUseVirtualRendering(state.filteredTabs.length)) {
                renderTabsVirtual(state.filteredTabs);
              } else {
                renderTabsStandard(state.filteredTabs);
              }
            }
          });
        }
      }
    );
  } catch (error) {
    console.error("[Tab Flow] Exception in duplicateTab:", error);
  }
}

export function toggleMute(tabId: number, btnElement: HTMLElement) {
  try {
    if (!tabId) return;

    chrome.runtime.sendMessage({ action: "toggleMute", tabId }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Tab Flow] Error toggling mute:",
          chrome.runtime.lastError
        );
        return;
      }

      if (response && response.success) {
        const isMuted = response.muted;
        btnElement.classList.toggle("muted", Boolean(isMuted));

        updateTrackedTabState(tabId, (tab) => {
          tab.mutedInfo = {
            ...(tab.mutedInfo || {}),
            muted: Boolean(isMuted),
          };
          tab.hasMedia = Boolean(tab.hasMedia || isMuted);

          if (typeof response.audible === "boolean") {
            tab.audible = response.audible;
          }
        });
        syncTabCardMediaState(tabId);
      }
    });
  } catch (error) {
    console.error("[Tab Flow] Exception in toggleMute:", error);
  }
}

export function togglePlayPause(tabId: number, btnElement: HTMLElement) {
  try {
    if (!tabId) return;

    chrome.runtime.sendMessage(
      { action: "togglePlayPause", tabId },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Tab Flow] Error toggling play/pause:",
            chrome.runtime.lastError
          );
          return;
        }

        if (response && typeof response.playing === "boolean") {
          const isPlaying = response.playing;

          btnElement.classList.toggle("playing", Boolean(isPlaying));
          updateTrackedTabState(tabId, (tab) => {
            tab.hasMedia =
              typeof response.hasMedia === "boolean"
                ? response.hasMedia
                : Boolean(tab.hasMedia || isPlaying);
            tab.isPlaying = isPlaying;
            if (!isPlaying) {
              tab.audible = false;
            }
          });
          syncTabCardMediaState(tabId);
        }
      }
    );
  } catch (error) {
    console.error("[Tab Flow] Exception in togglePlayPause:", error);
  }
}

export function setViewMode(mode: "active" | "recent") {
  state.viewMode = mode;
  if (state.domCache?.searchBox) {
    state.domCache.searchBox.placeholder =
      mode === "recent"
        ? "Search recently closed tabs..."
        : "Search tabs by title or URL...";
  }

  // Update section title based on mode
  if (state.domCache?.sectionTitle) {
    state.domCache.sectionTitle.textContent =
      mode === "recent" ? "Recently Closed" : "Opened Tabs";
  }

  // Update tab hint visibility
  if (state.domCache?.tabHint) {
    state.domCache.tabHint.classList.toggle("hidden", mode === "recent");
  }

  if (state.domCache?.helpText) {
    if (mode === "recent") {
      renderHelpText(state.domCache.helpText, [
        { keys: ["Alt+W", "↑↓"], action: "Navigate" },
        { keys: ["Enter"], action: "Restore" },
        { keys: ["Backspace"], action: "Active Tabs" },
        { keys: ["Esc"], action: "Exit" },
      ]);
    } else {
      renderHelpText(state.domCache.helpText, [
        { keys: ["Alt+W", "↑↓"], action: "Navigate" },
        { keys: ["Enter"], action: "Switch Tab" },
        { keys: ["Delete"], action: "Close" },
        { keys: ["`"], action: "Duplicate" },
        { keys: ["."], action: "Recent Tabs" },
        { keys: [";"], action: "Tab History" },
        { keys: ["Esc"], action: "Exit" },
      ]);
    }
  }
}

export function createGroup(tabId: number) {
  try {
    if (!tabId || typeof tabId !== "number") return;

    chrome.runtime.sendMessage({ action: "createGroup", tabId }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Tab Flow] Error creating group:",
          chrome.runtime.lastError.message
        );
        return;
      }
      if (response?.success) {
        closeOverlay();
      }
    });
  } catch (error) {
    console.error("[Tab Flow] Exception in createGroup:", error);
  }
}

export function switchToActive() {
  if (state.viewMode === "active") return;
  setViewMode("active");
  state.currentTabs = state.activeTabs || [];
  state.filteredTabs = state.currentTabs;

  state.selectedIndex = 0;
  if (state.domCache.grid) {
    state.domCache.grid.classList.remove("recent-mode");
    state.domCache.grid.classList.remove("search-mode");
    state.domCache.grid.scrollTop = 0;
  }
  if (shouldUseVirtualRendering(state.filteredTabs.length)) {
    renderTabsVirtual(state.filteredTabs);
  } else {
    renderTabsStandard(state.filteredTabs);
  }
  if (state.domCache.searchBox) {
    state.domCache.searchBox.value = "";
    state.domCache.searchBox.focus();
  }
}

export async function switchToRecent() {
  if (state.viewMode === "recent") return;
  setViewMode("recent");
  let items: any[] = [];
  try {
    items = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { action: "getRecentlyClosed", maxResults: 10 },
          (res) => {
            if (chrome.runtime.lastError) {
              console.debug(
                "[Tab Flow] Runtime error:",
                chrome.runtime.lastError.message
              );
              resolve([]);
              return;
            }
            if (res?.success) resolve(res.items || []);
            else resolve([]);
          }
        );
      } catch {
        resolve([]);
      }
    });
  } catch (e) {
    console.debug("[Tab Flow] Failed to load recently closed:", e);
  }
  state.recentItems = items.map((it, idx) => ({
    id: undefined, // Recent items don't have tab IDs
    title: it.title,
    url: it.url,
    favIconUrl: it.favIconUrl,
    screenshot: null,
    sessionId: it.sessionId,
    index: idx,
  }));
  state.currentTabs = state.recentItems;
  state.filteredTabs = state.recentItems; // No grouping for recent items usually
  state.selectedIndex = 0;
  if (state.domCache.grid) {
    state.domCache.grid.classList.add("recent-mode");
    state.domCache.grid.scrollTop = 0;
  }
  renderTabsStandard(state.filteredTabs);
  if (state.domCache.searchBox) state.domCache.searchBox.focus();
}

// toggleGroupCollapse removed as headers/collapsing are no longer used
