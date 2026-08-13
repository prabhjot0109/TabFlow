import assert from "node:assert/strict";
import test from "node:test";

import {
  hasMedia,
  isMediaPlaying,
  removeMediaTab,
  reportMediaState,
} from "../src/background/services/media-tracker.ts";

// media-tracker persists through chrome.storage.session behind a try/catch, so
// it runs unmodified here — the reference error is swallowed and the in-memory
// sets are what these tests care about.

test("a tab going quiet stops reporting playback but keeps its media flag", () => {
  reportMediaState(1, { hasMedia: true, isPlaying: true });
  assert.equal(hasMedia(1), true);
  assert.equal(isMediaPlaying(1), true);

  // This is the shape tabs.onUpdated sends when changeInfo.audible flips false.
  reportMediaState(1, { hasMedia: false, isPlaying: false });

  assert.equal(isMediaPlaying(1), false, "playback must stop being reported");
  assert.equal(
    hasMedia(1),
    true,
    "a silent tab still has a media element worth offering controls for",
  );

  removeMediaTab(1);
});

test("playback state toggles back on when audio resumes", () => {
  reportMediaState(2, { hasMedia: true, isPlaying: true });
  reportMediaState(2, { hasMedia: false, isPlaying: false });
  reportMediaState(2, { hasMedia: true, isPlaying: true });

  assert.equal(isMediaPlaying(2), true);

  removeMediaTab(2);
});

test("removing a tab clears both media and playback state", () => {
  reportMediaState(3, { hasMedia: true, isPlaying: true });
  removeMediaTab(3);

  assert.equal(hasMedia(3), false);
  assert.equal(isMediaPlaying(3), false);
});

test("an omitted isPlaying leaves existing playback state untouched", () => {
  reportMediaState(4, { hasMedia: true, isPlaying: true });
  reportMediaState(4, { hasMedia: true });

  assert.equal(isMediaPlaying(4), true);

  removeMediaTab(4);
});
