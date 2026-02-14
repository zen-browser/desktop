# Zen Tab Switcher Implementation Summary

## Overview
Arc-style visual tab switcher that appears on Ctrl+Tab with thumbnail previews, responsive design, and multiple filtering modes.

---

## Files Created

### 1. `src/zen/tabs/ZenTabSwitcher.mjs` (Main Manager Class)
**Purpose**: Core logic for tab switcher functionality

**Class Structure**:
```javascript
class nsZenTabSwitcher extends nsZenDOMOperatedFeature {
  // Private fields (ES2022 syntax with #)
  #isOpen                    // Boolean: switcher visibility state
  #currentIndex              // Number: currently selected tab index
  #tabList                   // Array: filtered tabs to display
  #maxVisibleTabs            // Number: responsive tab count (3-5)
  #thumbnailCache            // Map: tab thumbnails cache
  #ctrlPressed              // Boolean: tracks Ctrl key state
  #lazyPrefs                // Object: lazy-loaded preferences
}
```

**Key Methods**:
- `init()` - Sets up event listeners, preferences, UI references
- `open()` - Builds tab list, renders UI, shows overlay
- `close()` - Animates out, switches to selected tab
- `#buildTabList()` - Filters tabs based on mode preferences
- `#renderTabs()` - Creates DOM elements for each tab card
- `#getTabThumbnail()` - Captures/caches tab screenshots via canvas
- `#navigateForward/Backward()` - Cycles through tabs
- `#handleKeyDown/Up()` - Ctrl+Tab event handling

**Technical Details**:
- Uses `window.addEventListener("keydown/keyup", ...)` with `capture: true` to intercept before Firefox's default handlers
- Canvas rendering: `ctx.drawWindow()` captures 320x180px thumbnails at 16:9 aspect ratio
- Singleton pattern: `export var gZenTabSwitcher = new nsZenTabSwitcher()`

---

### 2. `src/zen/tabs/zen-tab-switcher.inc.xhtml` (UI Markup)
**Purpose**: XUL/HTML overlay structure

**DOM Hierarchy**:
```xml
#zen-tab-switcher-container (vbox) - Full-screen overlay
  └── #zen-tab-switcher-panel (vbox) - Centered panel
      └── #zen-tab-switcher-tabs (hbox) - Horizontal scrollable container
          └── .zen-tab-switcher-card (vbox) × N - Individual tab cards
              ├── .zen-tab-switcher-thumbnail (box) - Screenshot container
              │   └── image - Captured thumbnail or large favicon
              └── .zen-tab-switcher-info (hbox) - Bottom info bar
                  ├── .zen-tab-switcher-favicon (image) - 16x16 icon
                  └── .zen-tab-switcher-title (label) - Tab title
```

**XUL Elements Used**:
- `vbox/hbox` - Vertical/horizontal flex containers
- `box` - Generic container
- `image` - Icon/thumbnail display
- `label` - Text with `crop="end"` for ellipsis

---

### 3. `src/zen/tabs/zen-tab-switcher.css` (Styling)
**Purpose**: Arc-inspired design with animations and responsive breakpoints

**CSS Architecture**:
```css
:root {
  --zen-tab-switcher-card-width: 280px;     /* Base card dimensions */
  --zen-tab-switcher-card-height: 200px;
  --zen-tab-switcher-thumbnail-height: 158px; /* 16:9 ratio approx */
  --zen-tab-switcher-gap: 16px;
  --zen-tab-switcher-padding: 24px;
}
```

**Key Techniques**:
- **Overlay**: `position: fixed` fullscreen with `backdrop-filter: blur(8px)`
- **Centering**: Flexbox `align-items: center; justify-content: center`
- **Scrolling**: `overflow-x: auto; scrollbar-width: none` for hidden scrollbar
- **Selection**: Border color change + `transform: scale(1.05)` + box-shadow
- **Animations**: `@keyframes zen-tab-switcher-fade-in/out` with `scale(0.95)` effect

**Responsive Breakpoints**:
- `> 1200px`: 5 cards visible, 280px wide
- `800-1200px`: 4 cards visible, 240px wide  
- `< 800px`: 3 cards visible, 220px wide

**State Classes**:
- `.zen-tab-switcher-open` - Active state trigger
- `.zen-tab-switcher-selected` - Highlighted card
- `.zen-tab-switcher-pending` - Unloaded tab (opacity 0.6)

---

## Files Modified

### 4. `prefs/zen/zen.yaml` (Preferences)
**Added Settings**:
```yaml
- name: zen.tabs.tab-switcher.enabled
  value: true

- name: zen.tabs.tab-switcher.mode
  value: "loaded"  # Options: "loaded", "all", "recent"

- name: zen.tabs.tab-switcher.show-unloaded
  value: false

- name: zen.tabs.tab-switcher.use-recent-order
  value: false
```

**Preference Logic**:
- `enabled` - Master switch for feature
- `mode` - Legacy/unused (kept for future)
- `show-unloaded` - Include tabs with `pending` attribute
- `use-recent-order` - Use `ctrlTab._recentlyUsedTabs` vs visual order

---

### 5. `src/zen/tabs/jar.inc.mn` (JAR Manifest)
**Added Lines**:
```
content/browser/zen-components/ZenTabSwitcher.mjs          (../../zen/tabs/ZenTabSwitcher.mjs)
content/browser/zen-styles/zen-tab-switcher.css            (../../zen/tabs/zen-tab-switcher.css)
```

**Purpose**: Registers files in Firefox's JAR packaging system
- Maps source paths to chrome:// URLs
- `content/browser/zen-components/*` → `chrome://browser/content/zen-components/*`
- `content/browser/zen-styles/*` → `chrome://browser/content/zen-styles/*`

---

### 6. `src/zen/zen.globals.mjs` (Global Exports)
**Added**:
```javascript
"gZenTabSwitcher",
```

**Purpose**: Exposes singleton to window scope
- Makes `window.gZenTabSwitcher` available globally
- Used by other components and debug console

---

### 7. `src/browser/base/content/zen-tabbrowser-elements.inc.xhtml`
**Added**:
```html
#include ../../../zen/tabs/zen-tab-switcher.inc.xhtml
```

**Purpose**: Injects XUL overlay into browser.xhtml DOM tree
- Preprocessor directive (`#include`)
- Runs during Firefox build process
- Appears in compiled `browser.xhtml`

---

### 8. `src/browser/base/content/zen-assets.inc.xhtml`
**Added CSS Link**:
```html
<link rel="stylesheet" type="text/css" href="chrome://browser/content/zen-styles/zen-tab-switcher.css" />
```

**Added Script**:
```html
<script type="module" src="chrome://browser/content/zen-components/ZenTabSwitcher.mjs"></script>
```

**Purpose**: Loads resources during browser startup
- CSS loaded first (render-blocking)
- Script loaded as ES module (async)
- Auto-executes singleton creation at bottom of .mjs file

---

## Technical Architecture

### Event Flow
1. **User presses Ctrl+Tab**
2. `keydown` event captured by `#handleKeyDown()` (capture phase)
3. `event.preventDefault()` blocks Firefox's default tab switcher
4. First press: `open()` → build tab list → render UI → show overlay
5. Subsequent presses: `#navigateForward()` → update selection
6. **User releases Ctrl**
7. `keyup` event triggers `#handleKeyUp()`
8. `close()` → animate out → switch to `gBrowser.selectedTab`

### Tab Filtering Logic
```javascript
tabs.filter(tab => {
  if (tab.closing || tab.hidden) return false;              // Skip closed/hidden
  if (tab.hasAttribute("zen-empty-tab")) return false;      // Skip zen empty tabs
  if (!showUnloaded && tab.hasAttribute("pending")) return false; // Skip unloaded
  return true;
});
```

### Thumbnail Capture
```javascript
canvas.width = 320;
canvas.height = 180;  // 16:9 ratio
ctx.drawWindow(
  browser.contentWindow,
  0, 0, 320, 180,
  "rgb(255,255,255)",
  ctx.DRAWWINDOW_DRAW_CARET | 
  ctx.DRAWWINDOW_ASYNC_DECODE_IMAGES |
  ctx.DRAWWINDOW_USE_WIDGET_LAYERS
);
```
- Falls back to 48px favicon if capture fails
- Cached in `Map<tabId, dataUrl>`
- Cleared on tab open/close/modify events

### Responsive Calculation
```javascript
#calculateMaxVisibleTabs(width) {
  if (width < 800) return 3;
  if (width < 1200) return 4;
  return 5;
}
```
- Recalculated on window resize (if open)
- CSS max-width limits visible cards
- Horizontal scroll for overflow

---

## Integration Points

### Firefox Systems Used
- **XPCOMUtils**: `defineLazyPreferenceGetter()` for reactive prefs
- **gBrowser**: `tabs`, `selectedTab`, `tabContainer`
- **ctrlTab**: `_recentlyUsedTabs` array for MRU order
- **Canvas API**: `drawWindow()` for screenshots
- **Event System**: Capture phase interception

### Zen Systems Used
- **nsZenDOMOperatedFeature**: Base class from ZenCommonUtils.mjs
- **JAR manifest**: Build-time file registration
- **Global exports**: zen.globals.mjs pattern
- **XUL overlays**: .inc.xhtml preprocessing

---

## How to Undo Changes

### Quick Revert (Git)
```bash
# Revert all new files
git checkout HEAD -- src/zen/tabs/ZenTabSwitcher.mjs
git checkout HEAD -- src/zen/tabs/zen-tab-switcher.inc.xhtml
git checkout HEAD -- src/zen/tabs/zen-tab-switcher.css

# Revert modified files
git checkout HEAD -- prefs/zen/zen.yaml
git checkout HEAD -- src/zen/tabs/jar.inc.mn
git checkout HEAD -- src/zen/zen.globals.mjs
git checkout HEAD -- src/browser/base/content/zen-tabbrowser-elements.inc.xhtml
git checkout HEAD -- src/browser/base/content/zen-assets.inc.xhtml
```

### Manual Undo (if needed)

**Delete created files**:
```bash
rm src/zen/tabs/ZenTabSwitcher.mjs
rm src/zen/tabs/zen-tab-switcher.inc.xhtml
rm src/zen/tabs/zen-tab-switcher.css
```

**Revert `prefs/zen/zen.yaml`**:
- Remove lines 58-69 (tab switcher preferences)

**Revert `src/zen/tabs/jar.inc.mn`**:
- Remove line 7: `content/browser/zen-components/ZenTabSwitcher.mjs...`
- Remove line 9: `content/browser/zen-styles/zen-tab-switcher.css...`

**Revert `src/zen/zen.globals.mjs`**:
- Remove line 31: `"gZenTabSwitcher",`

**Revert `src/browser/base/content/zen-tabbrowser-elements.inc.xhtml`**:
- Remove line 10: `#include ../../../zen/tabs/zen-tab-switcher.inc.xhtml`

**Revert `src/browser/base/content/zen-assets.inc.xhtml`**:
- Remove line 23: `<link ... zen-tab-switcher.css" />`
- Remove line 50: `<script ... ZenTabSwitcher.mjs"></script>`

### Disable Without Removing Code
Set in `about:config`:
```
zen.tabs.tab-switcher.enabled = false
```

---

## Testing Checklist

### Basic Functionality
- [ ] Press Ctrl+Tab - switcher appears
- [ ] Hold Ctrl, press Tab multiple times - cycles through tabs
- [ ] Release Ctrl - switches to selected tab
- [ ] Press Ctrl+Shift+Tab - cycles backward

### Visual/Responsive
- [ ] Thumbnails appear (or fallback to large favicon)
- [ ] Cards show favicon + title at bottom
- [ ] Selected card has blue border + scale effect
- [ ] Resize window - card count adjusts (5→4→3)
- [ ] Horizontal scrolling works with many tabs

### Preference Testing
Set in `about:config`:
- [ ] `zen.tabs.tab-switcher.show-unloaded = true` - includes unloaded tabs
- [ ] `zen.tabs.tab-switcher.use-recent-order = true` - uses MRU order
- [ ] `zen.tabs.tab-switcher.enabled = false` - feature disabled

### Edge Cases
- [ ] Works with 0 tabs (shouldn't crash)
- [ ] Works with 1 tab (shows single card)
- [ ] Works with 100+ tabs (scrolling)
- [ ] Works with pinned tabs
- [ ] Works with hidden tabs (workspaces)
- [ ] Works with unloaded tabs
- [ ] Thumbnail cache clears on tab changes

---

## Known Limitations / Future Improvements

1. **Thumbnail Capture**: `drawWindow()` may fail for some content (permissions/CORS)
2. **Performance**: Large tab counts may slow rendering (consider virtualization)
3. **Accessibility**: No screen reader support yet
4. **Mouse Support**: Currently keyboard-only (could add click handlers)
5. **Animation**: Could add smoother card transitions when cycling
6. **Workspace Integration**: Doesn't filter by current workspace

---

## Build System Notes

### Rebuild Required
After changes, rebuild to regenerate JAR files:
```bash
./mach build
```

### Incremental Build
For faster iteration (CSS/JS only):
```bash
./mach build browser/
```

### Cache Clearing
If changes don't appear:
```bash
rm -rf obj-*/dist/bin/browser/chrome/browser.jar
./mach build browser/
```

---

## Debugging Tips

### Browser Console
```javascript
// Access manager
gZenTabSwitcher

// Check if initialized
console.log("Enabled:", Services.prefs.getBoolPref("zen.tabs.tab-switcher.enabled"))
console.log("Container exists:", !!document.getElementById("zen-tab-switcher-container"))

// Manually open (for testing)
gZenTabSwitcher.open()

// Check if ctrlTab is disabled
console.log("ctrlTab initialized:", !!ctrlTab._recentlyUsedTabs)

// Check preferences
Services.prefs.getBoolPref("zen.tabs.tab-switcher.enabled")
```

### Common Issues & Solutions

**Issue: Default Firefox Ctrl+Tab still appears**

**Solution:**
1. Check console logs - you should see "ZenTabSwitcher: Initializing..." on browser startup
2. Check if ctrlTab is disabled: Open Browser Console and run:
   ```javascript
   console.log("ctrlTab active:", !!ctrlTab._recentlyUsedTabs) // Should be false
   ```
3. Verify preference: `about:config` → `zen.tabs.tab-switcher.enabled` should be `true`
4. If still not working, manually disable ctrlTab:
   ```javascript
   ctrlTab.uninit()
   ```

**Issue: Panel doesn't appear**

**Solutions:**
1. Check if container exists:
   ```javascript
   console.log(document.getElementById("zen-tab-switcher-container"))
   ```
2. If null, the XHTMLoverlay might not be loaded - rebuild browser
3. Check console for "ZenTabSwitcher: UI elements not found" error

**Issue: No console logs appearing**

**Solution:**
- The script isn't loading - check for JavaScript errors in Browser Console (Ctrl+Shift+J)
- Verify file is registered in jar.inc.mn
- Rebuild: `./mach build browser/`

### DOM Inspector
1. Open Browser Toolbox (Ctrl+Alt+Shift+I)
2. Inspect `#zen-tab-switcher-container`
3. Check computed styles
4. Trigger with `gZenTabSwitcher.open()`

### Console Logs
Add to ZenTabSwitcher.mjs:
```javascript
open() {
  console.log("Opening tab switcher", this.#tabList);
  // ...
}
```

---

## Architecture Patterns Used

### Design Patterns
- **Singleton**: Single instance via module-level export
- **Lazy Loading**: Preferences loaded on first access
- **Caching**: Thumbnail Map with invalidation strategy
- **Event Delegation**: Single keydown/keyup listener for all tabs

### Firefox/Zen Patterns
- **Feature Base Class**: Extends `nsZenDOMOperatedFeature`
- **JAR Packaging**: Chrome URL registration
- **XUL Overlays**: Preprocessor includes
- **Preference System**: XPCOMUtils lazy getters
- **Global Exports**: zen.globals.mjs pattern

### JavaScript ES2022 Features
- **Private Fields**: `#` syntax for encapsulation
- **ES Modules**: `import/export` syntax
- **Optional Chaining**: `browser?.contentWindow`
- **Nullish Coalescing**: `value ?? default`

---

**Implementation Date**: February 14, 2026  
**Status**: Initial implementation complete, pending testing
