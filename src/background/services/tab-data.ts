import { PERF_CONFIG } from "../config";
import { LRUCache } from "../cache/lru-cache";
import { perfMetrics } from "../utils/performance";
import * as mediaTracker from "./media-tracker";
import * as tabTracker from "./tab-tracker";
import * as screenshot from "./screenshot";
import type { Group, Tab } from "../../shared/types";

const RECENT_PREVIEW_LIMIT = 30;

type BuildTabsOptions = {
  includeScreenshots?: boolean;
  recordCacheMetrics?: boolean;
};

type TabWithId = chrome.tabs.Tab & { id: number };

function ensureTabOpenOrder(tabs: TabWithId[]): void {
  const now = Date.now();
  tabs.forEach((tab, index) => {
    if (!tabTracker.getTabOpenTime(tab.id)) {
      tabTracker.setTabOpenTime(tab.id, now - (tabs.length - index) * 1000);
    }
  });
}

function toSharedTab(tab: TabWithId, screenshotData: string | null): Tab {
  const isPlaying = mediaTracker.isMediaPlaying(tab.id) || Boolean(tab.audible);

  return {
    id: tab.id,
    title: tab.title || "Untitled",
    url: tab.url,
    favIconUrl: tab.favIconUrl,
    screenshot: screenshotData,
    pinned: tab.pinned,
    index: tab.index,
    active: tab.active,
    audible: tab.audible,
    isPlaying,
    mutedInfo: tab.mutedInfo,
    groupId: tab.groupId,
    hasMedia: mediaTracker.hasMedia(tab.id) || isPlaying,
  };
}

async function getSortedWindowTabs(windowId: number): Promise<TabWithId[]> {
  const tabs = await chrome.tabs.query({ windowId });
  const tabsWithIds = tabs.filter(
    (tab): tab is TabWithId => typeof tab.id === "number",
  );

  ensureTabOpenOrder(tabsWithIds);
  return tabTracker.sortTabsByRecent(tabsWithIds);
}

export async function buildTabsForWindow(
  windowId: number,
  screenshotCache: LRUCache,
  options: BuildTabsOptions = {},
): Promise<Tab[]> {
  const { includeScreenshots = false, recordCacheMetrics = false } = options;
  const sortedTabs = await getSortedWindowTabs(windowId);

  return sortedTabs.map((tab, index) => {
    let screenshotData: string | null = null;
    const shouldAttachScreenshot =
      includeScreenshots &&
      index < RECENT_PREVIEW_LIMIT &&
      screenshot.isTabCapturable(tab);

    if (shouldAttachScreenshot) {
      const cached = screenshotCache.getIfFresh(
        tab.id,
        PERF_CONFIG.SCREENSHOT_CACHE_DURATION,
      );

      if (cached) {
        screenshotData = cached.data;
        if (recordCacheMetrics) perfMetrics.cacheHits++;
      } else if (recordCacheMetrics) {
        perfMetrics.cacheMisses++;
      }
    }

    return toSharedTab(tab, screenshotData);
  });
}

export async function buildGroupsForWindow(windowId: number): Promise<Group[]> {
  if (!chrome.tabGroups) {
    return [];
  }

  try {
    const groups = await chrome.tabGroups.query({ windowId });
    return groups.map((group) => ({
      id: group.id,
      title: group.title,
      color: group.color,
    }));
  } catch (error) {
    console.debug("[GROUPS] Failed to fetch groups:", error);
    return [];
  }
}

export async function buildFlowPayload(
  windowId: number,
  screenshotCache: LRUCache,
  options: Pick<BuildTabsOptions, "recordCacheMetrics"> = {},
): Promise<{ tabs: Tab[]; groups: Group[] }> {
  const [tabs, groups] = await Promise.all([
    buildTabsForWindow(windowId, screenshotCache, {
      includeScreenshots: true,
      recordCacheMetrics: options.recordCacheMetrics,
    }),
    buildGroupsForWindow(windowId),
  ]);

  return { tabs, groups };
}

export async function buildQuickSwitchPayload(
  windowId: number,
  screenshotCache: LRUCache,
): Promise<{ tabs: Tab[] }> {
  const tabs = await buildTabsForWindow(windowId, screenshotCache);
  return { tabs };
}
