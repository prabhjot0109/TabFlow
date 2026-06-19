# Privacy Policy for Tab Flow

**Last Updated:** January 2026

## Overview

Tab Flow is a browser extension that helps you navigate between your open tabs quickly and visually. We built it with privacy as a core principle – your data stays on your device, and we don't collect or transmit any personal information.

## What Data We Access

To provide the tab switching functionality, Tab Flow accesses:

- **Tab Information:** Title, URL, and favicon of your open tabs (to display in the tab switcher)
- **Tab Screenshots:** A visual capture of the tab you're viewing, taken only at the moment you open the switcher (via the `activeTab` permission), to show thumbnail previews. Tab Flow captures only the tab you explicitly open the switcher from — never other tabs, and never silently in the background.
- **Tab Groups:** Names and colors of your Chrome tab groups (to organize the display)
- **Recently Closed Tabs:** Session information for tabs you've recently closed (to allow restoration)

## How We Store Data

All data is stored **locally on your device** using:

- **IndexedDB:** Tab screenshots are cached locally to improve performance
- **Chrome Storage API:** User preferences (like view mode) are stored locally

**We do not:**

- Send any data to external servers
- Use analytics or tracking services
- Share data with third parties
- Collect personally identifiable information
- Store your browsing history

## Data Retention

- **Screenshots:** Cached using an LRU (Least Recently Used) algorithm, automatically evicted as new tabs are captured. The cache defaults to roughly 50MB (configurable from 10–200MB in the options page).
- **Preferences:** Stored until you uninstall the extension or clear extension data.

## Permissions Explained

| Permission   | Why We Need It                                                        |
| ------------ | -------------------------------------------------------------------- |
| `tabs`       | Access tab titles, URLs, and favicons for display                              |
| `tabGroups`  | Read tab group information to organize the display                             |
| `activeTab`  | Inject the overlay into, and capture a preview of, the tab you're on — only when you press a shortcut |
| `storage`    | Save your preferences and cache screenshots locally                           |
| `scripting`  | Inject the tab switcher overlay into the active web page                       |
| `sessions`   | Access recently closed tabs for the restore feature                           |
| `favicon`    | Display website icons in the tab list                                          |

## No Broad Host Permissions

Tab Flow does **not** request `<all_urls>` or any broad "read and change data on all sites" access, so you won't see that warning at install. Instead it uses the `activeTab` permission: when you press a shortcut, Chrome grants Tab Flow temporary access to **only the tab you're currently on**, just long enough to draw the overlay and capture that one tab's preview. It has no standing access to any site.

We do **not** read, analyze, or store the content of web pages beyond capturing those preview screenshots.

## Limited Use Disclosure

Tab Flow's use of information received from Google APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/), including the Limited Use requirements.

Specifically:

- We only use the data to provide the tab switching functionality
- We do not transfer data to third parties
- We do not use data for advertising purposes
- We do not sell user data

## Your Control

You have full control over Tab Flow:

- **Uninstall:** Remove the extension at any time to delete all associated data
- **Clear Data:** Use Chrome's extension settings to clear stored data
- **Disable:** Temporarily disable the extension without losing your preferences

## Children's Privacy

Tab Flow does not knowingly collect any information from children under 13 years of age.

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last Updated" date at the top of this document. Significant changes will be noted in the extension's release notes.

## Open Source

Tab Flow is open source. You can review the complete source code at:
https://github.com/prabhjot0109/TabFlow

This transparency ensures you can verify exactly what the extension does with your data.

## Contact

If you have questions about this privacy policy or Tab Flow's data practices, please open an issue on our GitHub repository:
https://github.com/prabhjot0109/TabFlow/issues

---

**Summary:** Tab Flow stores tab data locally on your device to enable the tab switching feature. We don't collect, transmit, or sell any user data. Everything stays on your computer.
