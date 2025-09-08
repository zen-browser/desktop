# Adding Custom Keyboard Shortcuts to Zen Browser

This guide explains how to add custom keyboard shortcuts for custom actions in Zen Browser, using the pin/unpin tab toggle as an example.

## Overview

Zen Browser has a sophisticated keyboard shortcuts system that allows you to add custom shortcuts for any action. The system includes:

- Command definitions (XUL)
- Command handlers (JavaScript)
- Keyboard shortcut bindings
- Version migration system
- Localization support

## Steps to Add a Custom Keyboard Shortcut

### 1. Define the Command

Add your command to `src/browser/base/content/zen-commands.inc.xhtml`:

```xml
<command id="cmd_zenTogglePinTab" />
```

### 2. Implement the Command Handler

Add the command handler to `src/zen/common/zen-sets.js`:

```javascript
case 'cmd_zenTogglePinTab':
  const currentTab = gBrowser.selectedTab;
  if (currentTab) {
    if (currentTab.pinned) {
      gBrowser.unpinTab(currentTab);
    } else {
      gBrowser.pinTab(currentTab);
    }
  }
  break;
```

### 3. Add the Keyboard Shortcut

Add the shortcut to `src/zen/kbs/ZenKeyboardShortcuts.mjs` in the `zenGetDefaultShortcuts()` function:

```javascript
newShortcutList.push(
  new KeyShortcut(
    'zen-toggle-pin-tab',        // Unique ID
    'P',                         // Key
    '',                          // Keycode (empty if using key)
    ZEN_OTHER_SHORTCUTS_GROUP,   // Group
    nsKeyShortcutModifiers.fromObject({ accel: true, shift: true }), // Modifiers
    'cmd_zenTogglePinTab',       // Command ID
    'zen-toggle-pin-tab-shortcut' // Localization ID
  )
);
```

### 4. Add Version Migration

Update the version number and add migration in `ZenKeyboardShortcuts.mjs`:

```javascript
static LATEST_KBS_VERSION = 10; // Increment version

// In the migrate() function:
if (version < 10) {
  data.push(
    new KeyShortcut(
      'zen-toggle-pin-tab',
      'P', 
      '',
      ZEN_OTHER_SHORTCUTS_GROUP,
      nsKeyShortcutModifiers.fromObject({ accel: true, shift: true }),
      'cmd_zenTogglePinTab',
      'zen-toggle-pin-tab-shortcut'
    )
  );
}
```

### 5. Add Localization

Add the shortcut description to `locales/en-US/browser/browser/preferences/zen-preferences.ftl`:

```
zen-toggle-pin-tab-shortcut = Toggle Pin Tab
```

### 6. Create Tests

Create tests in `src/zen/tests/shortcuts/` to verify the functionality works correctly.

## Shortcut Groups

Available shortcut groups:
- `ZEN_COMPACT_MODE_SHORTCUTS_GROUP` - Compact mode features
- `ZEN_WORKSPACE_SHORTCUTS_GROUP` - Workspace management  
- `ZEN_SPLIT_VIEW_SHORTCUTS_GROUP` - Split view features
- `ZEN_OTHER_SHORTCUTS_GROUP` - General Zen features
- Standard groups: `windowAndTabManagement`, `navigation`, `searchAndFind`, etc.

## Key Modifiers

Available modifiers:
- `accel` - Ctrl on Windows/Linux, Cmd on macOS
- `ctrl` - Ctrl key specifically
- `alt` - Alt/Option key
- `shift` - Shift key
- `meta` - Windows key on Windows, Cmd on macOS

## Example: Pin Tab Toggle

The pin tab toggle shortcut (Ctrl+Shift+P) demonstrates a complete implementation:

- **Command**: `cmd_zenTogglePinTab`
- **Shortcut**: Ctrl+Shift+P (Cmd+Shift+P on macOS)
- **Function**: Toggles the pin state of the currently selected tab
- **Group**: `ZEN_OTHER_SHORTCUTS_GROUP`

This implementation follows all the patterns established in the codebase and integrates seamlessly with the existing keyboard shortcuts system.