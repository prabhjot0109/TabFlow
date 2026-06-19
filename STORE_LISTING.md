# Chrome Web Store Listing Reference

Copy/paste material for the Developer Dashboard submission. Keep this in sync
with `manifest.json` and `PRIVACY.md`.

## Single purpose

Tab Flow is a visual tab switcher. It lets users find and switch between open
browser tabs using a keyboard-driven overlay with thumbnail previews, fuzzy
search, and an Alt+Tab-style quick switcher.

## Permission justifications

Paste each into the matching "justification" field on the dashboard.

- **`tabs`** — Reads the title, URL, and favicon of open tabs to render them in
  the switcher, and tracks recent access order so the most relevant tabs appear
  first.
- **`tabGroups`** — Reads Chrome tab group names and colors so grouped tabs are
  displayed under their group in the overlay.
- **`activeTab`** — When the user presses a shortcut, grants temporary access to
  the current tab to (a) inject the switcher overlay and (b) capture a single
  screenshot of that tab for its preview tile. No standing or broad host access.
- **`scripting`** — Injects the content script that renders the overlay on the
  active tab when a shortcut is pressed.
- **`storage`** — Stores user preferences (quality tier, cache limits, default
  view) and the local screenshot cache. All local; nothing is transmitted.
- **`sessions`** — Powers the "recently closed tabs" feature: lists recently
  closed tabs/windows and restores the one the user selects.
- **`favicon`** — Displays site favicons next to tabs in the list.

## Host permissions

None. Tab Flow declares **no** host permissions and does **not** request
`<all_urls>`. Thumbnail previews are captured with `chrome.tabs.captureVisibleTab`
under the `activeTab` grant — i.e. only the tab the user is on, only when they
invoke the switcher. This avoids the broad "read and change data on all sites"
install warning and keeps review friction low.

## Data usage / privacy practices

- **Data collected:** None is collected or transmitted off-device.
- **Stored locally only:** Tab metadata (title/URL/favicon), preview screenshots
  (IndexedDB), and user preferences (chrome.storage).
- Does **not** sell or transfer user data to third parties.
- Does **not** use data for purposes unrelated to the single purpose above.
- Does **not** use data for creditworthiness or lending.
- Complies with the Limited Use requirements of the Chrome Web Store User Data
  Policy.

## Remote code

None. All code is bundled in the package. CSP: `script-src 'self'; object-src 'self';`.

## Privacy policy URL

https://github.com/prabhjot0109/TabFlow/blob/main/PRIVACY.md
