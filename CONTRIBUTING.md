# Contributing to Visual Tab Switcher

First off, thank you for considering contributing to Visual Tab Switcher! 🎉

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Guidelines](#coding-guidelines)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

This project adheres to a simple code of conduct:

- Be respectful and considerate
- Welcome newcomers and help them learn
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## How Can I Contribute?

### 🐛 Reporting Bugs

Found a bug? Please create an issue with:

- **Clear title**: Describe the issue briefly
- **Steps to reproduce**: How can we recreate the bug?
- **Expected behavior**: What should happen?
- **Actual behavior**: What actually happens?
- **Environment**: Chrome version, OS, extension version
- **Screenshots**: If applicable

**Example:**

```
Title: Screenshot not captured for YouTube tabs

Steps:
1. Open YouTube video tab
2. Open tab switcher (Alt+Q)
3. Notice YouTube tab has no screenshot

Expected: Screenshot of YouTube page
Actual: "No Preview" placeholder

Environment: Chrome 120, Windows 11, Extension v1.0.0
```

### 💡 Suggesting Features

Have an idea? Create an issue with:

- **Clear description**: What feature do you want?
- **Use case**: Why is this useful?
- **Proposed solution**: How would it work?
- **Alternatives**: Other ways to solve this?
- **Mockups**: Visual examples if applicable

### 🔧 Code Contributions

1. **Fork the repository**
2. **Create a branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Test thoroughly**
5. **Commit**: `git commit -m "Add amazing feature"`
6. **Push**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

## Development Setup

### Prerequisites

- Git
- Google Chrome (latest version)
- Code editor (VS Code recommended)
- Basic knowledge of JavaScript and Chrome Extension APIs

### Setup Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/prabhjot0109/tab_switcher_extension.git
   cd tab_switcher_extension
   ```

2. **Generate icons**

   - Open `icons/generate-icons.html` in Chrome
   - Download all icon sizes
   - Place in `icons/` folder

3. **Load extension in Chrome**

   - Navigate to `chrome://extensions/`
   - Enable Developer Mode
   - Click "Load unpacked"
   - Select the project folder

4. **Make your changes**

   - Edit files as needed
   - Reload extension to test changes

5. **Test thoroughly**
   - Test with multiple tabs (10+, 50+, 100+)
   - Test keyboard shortcuts
   - Test search functionality
   - Test on different websites
   - Check console for errors

### File Structure

```
├── manifest.json          # Extension configuration
├── background.js          # Service worker (tab management, screenshots)
├── content.js             # Content script (overlay UI, keyboard handling)
├── overlay.css            # Styles for the overlay
├── popup.html             # Extension popup (info page)
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   ├── icon.svg
│   └── generate-icons.html
└── README.md              # Documentation
```

## Coding Guidelines

### JavaScript Style

- Use modern ES6+ syntax
- Use `const` and `let`, avoid `var`
- Use arrow functions for callbacks
- Add comments for complex logic
- Use meaningful variable names

**Example:**

```javascript
// Good
const captureTabScreenshot = async (tabId) => {
  try {
    const screenshot = await chrome.tabs.captureVisibleTab(windowId, {
      format: "jpeg",
      quality: 50,
    });
    return screenshot;
  } catch (error) {
    console.error(`Failed to capture tab ${tabId}:`, error);
    return null;
  }
};

// Avoid
var x = function (y) {
  // unclear what x and y are
  return chrome.tabs.captureVisibleTab(y);
};
```

### CSS Style

- Use meaningful class names
- Group related properties
- Add comments for sections
- Use CSS variables for colors
- Mobile-first responsive design

**Example:**

```css
/* Good */
.tab-card {
  /* Layout */
  display: flex;
  flex-direction: column;

  /* Appearance */
  background: #2d2d2d;
  border: 2px solid #404040;
  border-radius: 8px;

  /* Interaction */
  cursor: pointer;
  transition: all 0.2s ease;
}

/* Avoid */
.tc {
  background: #2d2d2d;
  cursor: pointer;
  display: flex;
  border: 2px solid #404040;
  /* unclear organization */
}
```

### Manifest Changes

- Follow Manifest V3 specifications
- Test permissions carefully
- Document any new permissions
- Keep permissions minimal

### Performance Considerations

- Optimize screenshot capture (use caching)
- Avoid blocking the main thread
- Minimize DOM manipulations
- Use event delegation where possible
- Test with 100+ tabs

### Accessibility

- Ensure keyboard navigation works
- Use semantic HTML
- Add ARIA labels where needed
- Test with screen readers if possible

## Testing Your Changes

### Manual Testing Checklist

- [ ] Extension loads without errors
- [ ] Keyboard shortcuts work
- [ ] Mouse interactions work
- [ ] Search/filter works
- [ ] Tab closing works
- [ ] Screenshots capture correctly
- [ ] Overlay displays properly
- [ ] Responsive on different screen sizes
- [ ] Works with many tabs (50+)
- [ ] No console errors
- [ ] Performance is acceptable

### Browser Console

1. **Background Script Console:**

   - Go to `chrome://extensions/`
   - Click "service worker" under extension
   - Check for errors

2. **Content Script Console:**
   - Open any tab
   - Press F12
   - Check console for errors

### Test Scenarios

1. **Basic Usage:**

   - Open 10 tabs
   - Activate switcher
   - Navigate with keyboard
   - Switch tabs

2. **Heavy Load:**

   - Open 50+ tabs
   - Activate switcher
   - Check performance
   - Look for lag or errors

3. **Edge Cases:**
   - Test on chrome:// pages
   - Test with incognito tabs
   - Test with pinned tabs
   - Test with no tabs

## Submitting Changes

### Pull Request Process

1. **Update documentation** if needed
2. **Test thoroughly** on multiple scenarios
3. **Write clear commit messages**
4. **Reference related issues** in PR description
5. **Provide screenshots/GIFs** if UI changes
6. **Wait for review** - be patient!

### Commit Message Format

```
<type>: <subject>

<body (optional)>

<footer (optional)>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**

```
feat: Add multi-window support

Added option to show tabs from all windows instead of just current window.
Users can toggle this in the overlay header.

Closes #42
```

```
fix: Screenshot not capturing on first load

Changed screenshot capture timing to wait for tab to render fully
before capturing. Added 50ms delay after tab activation.

Fixes #38
```

### Pull Request Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

Describe how you tested this

## Screenshots (if applicable)

Add screenshots or GIFs

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No new warnings
- [ ] Added tests if applicable
- [ ] All tests pass
```

## Questions?

Feel free to:

- Open an issue for discussion
- Ask in pull request comments
- Reach out via GitHub discussions

## Recognition

Contributors will be:

- Listed in README.md
- Credited in release notes
- Mentioned in CHANGELOG.md

Thank you for contributing! 🙏
