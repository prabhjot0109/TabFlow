# Quick Start Guide - Visual Tab Switcher

Get up and running in 3 minutes! ⚡

## TL;DR - Fastest Setup

1. **Generate Icons** → Open `icons/generate-icons.html` in Chrome → Download all 3 icons
2. **Load Extension** → Go to `chrome://extensions/` → Enable Developer Mode → Load Unpacked
3. **Use It** → Press `Alt+Q` to open tab switcher

Done! 🎉

---

## Detailed Quick Start

### Step 1: Get the Icons (2 minutes)

Icons are required for Chrome to load the extension.

**Easiest Method:**

```
1. Open this file in Chrome: icons/generate-icons.html
2. Click "Download 16x16"
3. Click "Download 48x48"
4. Click "Download 128x128"
5. Move all 3 PNG files to the icons/ folder
```

The icons folder should now contain:

- icon16.png
- icon48.png
- icon128.png
- generate-icons.html (the generator)
- icon.svg (source file)

### Step 2: Load in Chrome (1 minute)

```
1. Open Chrome
2. Type: chrome://extensions/
3. Toggle ON: "Developer mode" (top right)
4. Click: "Load unpacked"
5. Select this folder (the one with manifest.json)
6. Click: "Select Folder"
```

You should see "Visual Tab Switcher" appear in the list!

### Step 3: Try It! (30 seconds)

```
1. Open a few tabs (5-10 different websites)
2. Press Alt+Q
3. See the magic! ✨
```

The overlay appears with thumbnails of all your tabs.

---

## Basic Usage

### Keyboard Shortcuts

| Shortcut              | Action                 |
| --------------------- | ---------------------- |
| `Alt+Q`               | Open tab switcher      |
| `Tab` or `Arrow Keys` | Navigate between tabs  |
| `Enter`               | Switch to selected tab |
| `Delete`              | Close selected tab     |
| `Esc`                 | Close overlay          |

### Mouse Actions

- **Click thumbnail** → Switch to that tab
- **Click X button** → Close that tab
- **Click outside** → Close overlay

### Search

- Type anything to search tabs by title or URL
- Use arrow keys to navigate results
- Press Enter to switch

---

## Changing to Ctrl+Tab (Optional)

Chrome protects `Ctrl+Tab` by default. To use it:

```
1. Go to: chrome://extensions/shortcuts
2. Find: "Visual Tab Switcher"
3. Click in the shortcut box
4. Press: Ctrl+Tab
5. Done!
```

---

## Common Issues

**"Extension failed to load"**
→ Make sure the 3 icon PNG files exist in the icons/ folder

**"Shortcut doesn't work"**
→ Try `Alt+Q` first. Some pages (chrome:// URLs) block shortcuts

**"No screenshots showing"**
→ Normal on first use. Screenshots are captured when you open the switcher
→ Chrome:// pages can't be captured (security restriction)

**"Overlay not appearing"**
→ Refresh the current tab (F5) and try again
→ Check that the extension is enabled at chrome://extensions/

---

## What Next?

- ⚙️ Customize shortcuts at `chrome://extensions/shortcuts`
- 📖 Read full README.md for all features
- 🎨 Modify overlay.css to change the look
- 🐛 Report bugs on GitHub

---

## Features at a Glance

✅ Visual thumbnail previews  
✅ Keyboard & mouse navigation  
✅ Search/filter tabs  
✅ Close tabs directly  
✅ Recently used sorting  
✅ Pinned tab indicators  
✅ Works with 100+ tabs  
✅ Responsive design  
✅ Dark theme

---

## Need Help?

1. Check INSTALLATION.md for detailed setup
2. Check README.md for full documentation
3. Open GitHub issue if stuck

**Enjoy faster tab switching! 🚀**
