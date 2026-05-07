import assert from "node:assert/strict";
import test from "node:test";

import { releaseTabPayloadState } from "../src/content/memory.ts";

test("releaseTabPayloadState clears tab arrays that can retain screenshots", () => {
  const screenshot = "data:image/jpeg;base64," + "x".repeat(2048);
  const state = {
    currentTabs: [{ id: 1, screenshot }],
    activeTabs: [{ id: 1, screenshot }],
    filteredTabs: [{ id: 1, screenshot }],
    quickSwitchTabs: [{ id: 1, screenshot }],
    recentItems: [{ sessionId: "abc" }],
    groups: [{ id: 1, title: "Work", color: "blue" }],
    selectedIndex: 4,
    history: {
      active: true,
      backEls: [{}],
      forwardEls: [{}],
      column: "forward",
      index: 2,
    },
    webSearch: {
      active: true,
    },
  };

  releaseTabPayloadState(state);

  assert.deepEqual(state.currentTabs, []);
  assert.deepEqual(state.activeTabs, []);
  assert.deepEqual(state.filteredTabs, []);
  assert.deepEqual(state.quickSwitchTabs, []);
  assert.deepEqual(state.recentItems, []);
  assert.deepEqual(state.groups, []);
  assert.equal(state.selectedIndex, 0);
  assert.equal(state.history.active, false);
  assert.deepEqual(state.history.backEls, []);
  assert.deepEqual(state.history.forwardEls, []);
  assert.equal(state.history.column, "back");
  assert.equal(state.history.index, 0);
  assert.equal(state.webSearch.active, false);
});
