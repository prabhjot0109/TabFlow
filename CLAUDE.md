# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                # or: bun install
npm run dev                # Vite watch build -> dist/ (reload extension card in chrome://extensions to pick up changes)
npm run build              # Production build -> dist/
npm run typecheck          # tsc --noEmit — the only static gate; no linter is configured
npm test                   # node --experimental-strip-types --test tests/*.test.mjs
node --experimental-strip-types --test tests/lru-cache.memory.test.mjs   # single test file
```

`tests/dist-assets.test.mjs` asserts against build output and skips itself when `dist/` is absent, so `npm test` works on a clean checkout — but run `npm run build` first if you want that check to actually execute.

Load the extension via `chrome://extensions` → Developer mode → Load unpacked → select `dist/` (not the repo root).

## Architecture

Manifest V3 extension, TypeScript strict, zero runtime dependencies, built by Vite + `@crxjs/vite-plugin`. `manifest.json` is the CRXJS source of truth; `vite.config.ts` adds the three standalone HTML pages as extra rollup inputs.

### Two invocation paths, three UI hosts

`chrome.commands` fires in `src/background/index.ts` → `handleShowTabFlow()` (Alt+W) or `handleQuickSwitch()` (Alt+Q). Both build a payload via `services/tab-data.ts` and then pick a host:

| Host | When | Entry |
| --- | --- | --- |
| Injected overlay | Normal http(s) page | `src/content/` injected into the page, Shadow DOM |
| Flow popup window | Protected page (`chrome://`, `chrome-extension://`, `edge://`, `devtools://`, `view-source:`) or content script unreachable | `src/flow/index.ts` |
| Quick Switch popup window | Same, for Alt+Q | `src/quick-switch/index.ts` |

**All three render the same overlay code.** `src/content/ui/overlay.ts` is imported by the popup pages too, via `src/shared/protected-popup.ts`, which factors out the shared popup lifecycle (session-storage payload → message fallback → render → shell layout). Changes to `overlay.ts` / `rendering.ts` must not assume page context (no `document.body` of a real site, no content-script-only APIs) or the popup fallbacks break silently.

### Content script injection is NOT declarative

`manifest.json` has **no `content_scripts` block** and no `<all_urls>` host permission — this is deliberate (see the privacy claims in README/PRIVACY). The content script is injected on demand from `src/background/handlers/messages.ts`:

```ts
import contentScriptPath from "../../content/index.ts?script";   // CRXJS emits the built filename
```

`sendMessageWithRetryResponse()` tries `chrome.tabs.sendMessage` first; on "Could not establish connection" it calls `tryInjectContentScript()` and then `sendMessageAfterInjection()`, which polls up to 6×25ms because `executeScript` resolves before the script's `onMessage` listener necessarily registers. If injection is impossible, the caller falls back to a popup window. To add another injectable script, add another `?script` import — do not add `content_scripts` to the manifest.

The content script guards against double-evaluation with a `window.__tabFlowContentScriptLoaded` flag (module scope is per-injection, so the flag has to live on `window`). All side effects go in `initializeContentScript()` — adding a top-level side effect outside it defeats the guard.

### Permissions

At install: no host permissions, `activeTab` only. `*://*/*` is declared under `optional_host_permissions` and requested from the options page toggle — `chrome.permissions.request` needs a user gesture, which a service worker or commands handler does not have, so it cannot be requested from the background. `src/shared/host-access.ts` owns this; the background caches the answer via `trackBroadHostAccess()` because `tabs.onActivated` can't await a permission check, and opens the options page once on `onInstalled` so the toggle is discoverable.

`manifest.json` pins `minimum_chrome_version: "121"`, which is where `tabs.Tab.lastAccessed` landed. `sortTabsByRecent` depends on it — that assumption replaced ~205 lines of self-managed recency tracking, so don't reintroduce a fallback without also lowering the pin.

Behaviour differs by grant, and both paths must keep working:

| | Default (`activeTab`) | Opted in |
|---|---|---|
| Previews | Only the tab the switcher was invoked from | Plus each tab shortly after it's activated |
| Media controls | Only the invoked tab | Any tab |

### Screenshot capture invariants

`captureVisibleTab` can only ever photograph the **foreground** tab of a window — broad host access does not enable reading background tabs, it enables capturing on activation so coverage accumulates. There are two capture entry points, both in `src/background/index.ts`:

- `captureInvokedTab()` — at command-invocation time. Must stay **awaited before the overlay is shown**, or the screenshot contains our own overlay. Uses `{ immediate: true }` to skip the settle delay.
- `captureActivatedTab()` — debounced 400ms after `tabs.onActivated`, and a no-op without broad host access.

Both funnel through `captureTabScreenshot()`, which reserves a slot from `CaptureThrottle` (Chrome rejects past ~2 calls/sec) and then **re-checks that the tab is still active**, since a queued capture would otherwise file the wrong page under that tab id.

Freshness and eviction are deliberately separate concerns: `getIfFresh()` answers "is a re-capture warranted?" and never deletes; `get()` is what the UI path uses so a stale thumbnail still renders instead of a blank card. Deleting on staleness is what previously made the IndexedDB cache useless across restarts.

### Message layer

`src/background/handlers/messages.ts` is a closed protocol. Adding an action means updating **three** places or it is rejected as "Invalid message format": the `MessageAction` union, the `IncomingMessage` union, and the `MESSAGE_ACTIONS` runtime `Set` (plus the `switch`). Every handler responds with `{ success, error? }`; the listener in `background/index.ts` returns `true` to keep the async channel open.

### Caching

`src/background/cache/lru-cache.ts` is an in-memory `Map` fronting IndexedDB (`cache/indexed-db.ts`). Notable:
- `ready` is a promise for the IndexedDB restore; callers race it against a timeout rather than blocking overlay open.
- The storage backend is constructor-injected (`PersistentCacheStorage`), which is how the tests exercise it in plain Node with a fake.
- `SCREENSHOT_PROFILE_VERSION` in `background/index.ts` — bump it when capture parameters change so stale screenshots are purged on next start.
- Budgets and quality tiers live in `src/background/config.ts` (`PERF_CONFIG`); the options page overrides `cacheMaxTabs` / `cacheMaxMB` / `qualityTier` through `chrome.storage.local`.

### Overlay internals (`src/content/`)

- `state.ts` — one mutable `state` singleton shared by every module (DOM cache, virtual-scroll window, view mode, history/web-search sub-states). `memory.ts#releaseTabPayloadState` clears the arrays that retain base64 screenshots; call it when tearing down.
- `ui/overlay.ts` — Shadow DOM host (`tab-flow-host`), overlay creation, quick-switch selection cycling.
- `ui/rendering.ts` — `createTabCard` builds every card in the extension, for **both** the main overlay and Quick Switch (which passes a `TabCardOptions` object for the four things that differ). These were separate implementations that drifted; don't fork it again. Switches to virtual rendering above 50 tabs **in list layout only** — grid view renders every card, which is why the FLIP animation is capped at `FLIP_MAX_CARDS`: it measures every card twice per render and renders happen on every keystroke.
- `ui/styles.ts` — imports `styles.css?inline` so the CSS ships as a separate file but can be injected into the Shadow root. The panel is deliberately **opaque with no `backdrop-filter`**: blurring the live page re-samples it every frame and forces extra compositing layers, and the per-card variant meant one such layer per media button. Don't reintroduce it.
- `ui/panel-layout.ts` + `shared/panel.ts` — `EXTENSION_PANEL` drives both the overlay's CSS custom properties and the popup window's `chrome.windows.create` bounds, so injected and popup UIs are pixel-identical. Change sizes there, not in CSS.
- `input/search.ts` — fuzzy matcher plus mode prefixes parsed from the query (`;` history, `.` recently closed, `Tab` web search); throttled under 50 tabs, debounced + `requestIdleCallback` above.
- `input/focus.ts` — locks page interaction while the overlay is open and restores it on close (`state.pageLock`).

Only one overlay may be on screen at a time: `showQuickSwitch` closes the main overlay and `showTabFlow` closes Quick Switch. Both are modal `<dialog>`s in the same shadow root and Quick Switch keeps an Alt-release listener on `document`, so a missing guard means releasing Alt switches tabs underneath the other UI.

### Repeated-shortcut semantics

Pressing the same shortcut while the UI is already open **cycles the selection** instead of reopening. This is implemented at several layers and all of them must stay in sync: background fast paths in `handleQuickSwitch`/`handleShowTabFlow`, the `quickSwitchCycleIfOpen` probe (80 ms race), the content listener in `src/content/index.ts`, and the `FlowPopupCycleNext` / `QuickSwitchPopupCycleNext` broadcasts consumed by the popup pages.

## Conventions

- Tests run through Node's native type stripping, so **any `.ts` file reachable from `tests/` must use explicit `.ts` extensions in its relative imports** (see `lru-cache.ts` importing `./indexed-db.ts`). Elsewhere in `src/`, extensionless imports are the norm.
- Build DOM with `createElement`/`textContent`, not `innerHTML`, for anything containing tab titles or URLs.
- Both background and content modules gate verbose logging behind a local `DEBUG_LOGGING` const; keep new logging behind it and use `console.debug` for expected-failure paths.
- `docs/` is gitignored — scratch analysis lives there and is not part of the repo.
