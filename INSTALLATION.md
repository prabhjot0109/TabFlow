# Installation & Setup Guide

## Prerequisites

- Google Chrome browser (version 88 or higher)
- Basic understanding of Chrome extensions

## Step-by-Step Installation

### 1. Generate Icon Files

Before loading the extension, you need to create the icon files:

**Option A: Using the Icon Generator (Recommended)**

1. Open `icons/generate-icons.html` in Chrome
2. You'll see three canvases showing the icons
3. Click each "Download" button to save the icons:
   - Download icon16.png
   - Download icon48.png
   - Download icon128.png
4. Move the downloaded PNG files to the `icons/` folder

**Option B: Convert SVG to PNG (Manual)**

1. Open `icons/icon.svg` in an image editor (GIMP, Photoshop, Inkscape, etc.)
2. Export/Save as PNG at these sizes:
   - 16×16 pixels → `icon16.png`
   - 48×48 pixels → `icon48.png`
   - 128×128 pixels → `icon128.png`
3. Save all files in the `icons/` folder

**Option C: Use Online Tools**

1. Visit https://www.aconvert.com/image/svg-to-png/
2. Upload `icons/icon.svg`
3. Convert to PNG at 128×128 (you can also specify 16×16 and 48×48)
4. Download and rename files as needed
5. Place in `icons/` folder

### 2. Load Extension in Chrome

1. **Open Chrome Extensions Page**

   - Navigate to `chrome://extensions/`
   - OR: Click menu (⋮) → Extensions → Manage Extensions

2. **Enable Developer Mode**

   - Toggle the "Developer mode" switch in the top-right corner

3. **Load the Extension**

   - Click "Load unpacked" button
   - Navigate to your extension folder
   - Select the folder containing `manifest.json`
   - Click "Select Folder"

4. **Verify Installation**
   - You should see "Visual Tab Switcher" in your extensions list
   - The extension icon should appear in your Chrome toolbar
   - Status should show as "Enabled"

### 3. Configure Keyboard Shortcuts (Optional)

The default shortcut is `Alt+Q`, but you can customize it:

1. **Open Shortcuts Page**

   - Navigate to `chrome://extensions/shortcuts`
   - OR: From extensions page, click "Keyboard shortcuts" in the menu (☰)

2. **Find Visual Tab Switcher**

   - Scroll to find "Visual Tab Switcher"

3. **Set Custom Shortcut**

   - Click in the shortcut field next to "Show visual tab switcher"
   - Press your desired key combination
   - Recommended: `Ctrl+Tab` (Chrome's default for tab switching)
   - Note: Chrome protects some shortcuts - you can only override them from this page

4. **Save**
   - Click outside the field or press Enter to save

### 4. Grant Permissions

When first using the extension, Chrome may prompt for permissions:

- ✅ **tabs**: Read tab information
- ✅ **activeTab**: Capture tab screenshots
- ✅ **storage**: Cache screenshots temporarily
- ✅ **<all_urls>**: Inject overlay on all pages

Click "Allow" or "Grant" when prompted.

## Testing the Extension

### Basic Functionality Test

1. **Open Multiple Tabs**

   - Open 5-10 different websites
   - Mix of different types (news, social media, etc.)

2. **Activate Tab Switcher**

   - Press `Alt+Q` (or your configured shortcut)
   - Overlay should appear with thumbnails

3. **Test Keyboard Navigation**

   - Press `Tab` or `Arrow Keys` to navigate
   - Selected tab should be highlighted
   - Press `Enter` to switch to selected tab

4. **Test Mouse Navigation**

   - Press `Alt+Q` again
   - Click on any thumbnail
   - Should switch to that tab instantly

5. **Test Search**

   - Press `Alt+Q` again
   - Start typing a page title or URL
   - Tabs should filter in real-time
   - Navigate with arrows and press Enter

6. **Test Tab Close**
   - Press `Alt+Q`
   - Hover over a thumbnail
   - Click the X button
   - OR: Select a tab and press `Delete`
   - Tab should close

### Advanced Testing

1. **Many Tabs Test** (Performance)

   - Open 30+ tabs
   - Activate switcher
   - Should load smoothly within 2-3 seconds
   - Grid should be scrollable

2. **Pinned Tabs Test**

   - Pin 2-3 tabs (Right-click → Pin)
   - Activate switcher
   - Pinned tabs should show 📌 indicator

3. **Screenshot Cache Test**

   - Open tab switcher
   - Close it immediately
   - Open it again quickly (within 30 seconds)
   - Screenshots should load instantly (from cache)

4. **Edge Cases**
   - Test on `chrome://` pages (won't show screenshots)
   - Test on file:// URLs
   - Test with incognito tabs (if extension enabled in incognito)
   - Test with very long tab titles

## Troubleshooting

### Issue: Extension not appearing

**Solution:**

- Check that Developer mode is enabled
- Refresh the extensions page (`chrome://extensions/`)
- Check console for errors (click "Errors" button on extension card)

### Issue: Keyboard shortcut not working

**Solution:**

- Go to `chrome://extensions/shortcuts`
- Check for conflicts with other extensions
- Try a different shortcut temporarily
- Ensure the current tab is not a `chrome://` page (protected)

### Issue: Screenshots not showing

**Solution:**

- Check permissions are granted
- Some pages (chrome://, chrome-extension://) cannot be captured
- Try refreshing tabs
- Check browser console for errors (F12)

### Issue: Overlay not appearing

**Solution:**

- Refresh the current tab
- Check that content script injected: Open DevTools → Console
- Look for "Visual Tab Switcher content script loaded"
- Some sites with strict CSP may block it

### Issue: Performance lag with many tabs

**Solution:**

- Close unnecessary tabs
- Clear browser cache
- Screenshots are captured on-demand, so first load may be slower
- Subsequent loads use cached screenshots

## Uninstalling

If you need to remove the extension:

1. Go to `chrome://extensions/`
2. Find "Visual Tab Switcher"
3. Click "Remove"
4. Confirm removal

This will:

- Remove the extension from Chrome
- Clear all cached data
- Remove keyboard shortcuts
- Delete stored screenshots

## Updating

To update to a new version:

1. **Pull latest code** (if using git):

   ```bash
   git pull origin main
   ```

2. **Reload extension**:

   - Go to `chrome://extensions/`
   - Find "Visual Tab Switcher"
   - Click the reload icon (🔄)

3. **Verify update**:
   - Check version number in extension card
   - Test new features

## Development Mode

If you're developing or customizing the extension:

### Enable Verbose Logging

1. Open `background.js`
2. Find `console.log` statements
3. Add more logging as needed
4. Reload extension

### Inspect Background Service Worker

1. Go to `chrome://extensions/`
2. Find "Visual Tab Switcher"
3. Click "service worker" link
4. DevTools opens for background script

### Inspect Content Script

1. Open any web page
2. Press F12 (DevTools)
3. Check Console for content script logs
4. Check Elements tab for overlay HTML

### Debug Screenshot Capture

1. Open background service worker console
2. Activate tab switcher
3. Watch for screenshot capture logs
4. Check for errors or rate limiting

## Performance Tips

1. **Screenshot Quality**: Default is 50%. Can be adjusted in `background.js`
2. **Cache Duration**: Default is 30 seconds. Configurable in `background.js`
3. **Grid Columns**: Auto-adjusts based on screen size. Can be customized in `overlay.css`
4. **Max Cached Tabs**: Default is 50 recent tabs. Configurable in `background.js`

## Support

For issues or questions:

1. Check this guide first
2. Review main README.md
3. Check GitHub Issues
4. Create new issue with details

## Next Steps

After installation:

1. ⭐ Star the repo if you find it useful
2. 🐛 Report bugs via GitHub Issues
3. 💡 Suggest features
4. 🤝 Contribute improvements

Happy tab switching! 🚀
