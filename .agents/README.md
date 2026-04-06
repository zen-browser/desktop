# Zen Browser - Project Organization for AI Agents

Welcome to the Zen Browser repository. Zen is a specialized fork of Firefox, focusing on unique features like vertical tabs, workspaces (spaces), and a highly customizable UI.

This guide helps AI agents understand the repository's structure and how to contribute effectively to Zen-specific features.

---

## 📂 Core Directory Structure

### 1. `src/zen/` (Zen-Specific Features)

This is the most important directory for Zen-specific logic. It contains modular implementations for various features:

- `tabs/`: Tab management logic, including pinned tabs and Zen-specific tab behaviors.
- `spaces/`: Implementation of Zen Workspaces (called "Spaces").
- `glance/`: The "Glance" quick tab preview feature.
- `compact-mode/`: UI and logic for compact browser mode.
- `common/`: Shared utilities, UI managers (`ZenUIManager.mjs`), and startup logic (`ZenStartup.mjs`).
- `folders/` & `live-folders/`: Tab grouping and organization features.
- `split-view/`: Logic for the split-screen view.
- `mods/`: Zen Mods system for browser customization.
- `urlbar/`: Customizations to the browser's address bar.

### 2. `src/browser/` (Firefox Patches & Base UI)

Contains patches and modifications to the base Firefox browser components.

- Often contains `.xhtml` or `.mjs` files that override or extend original Firefox behavior.
- Use this to modify existing Firefox elements (like the main browser window).

### 3. `prefs/` (Preference Management)

Zen uses a YAML-based system to manage browser preferences.

- `prefs/zen/`: Contains `.yaml` files defining Zen-specific settings.
- **Workflow**:
  1. Define a preference in a `.yaml` file.
  2. Access it in code using `Services.prefs.getBoolPref('zen.xxx', defaultValue)`.

### 4. `engine/` (The Firefox Engine)

Contains the actual Firefox source code used as the base.

- **Note**: Modifying files directly in `engine/` is for creating patches.
- **Workflow**:
  1. Modify code in `engine/`.
  2. Run `npm run export <path>` to generate a patch.
  3. Run `npm run import` to sync.

### 5. `locales/` (Localization)

Zen uses Fluent (`.ftl`) files for localization.

- Check `locales/` for feature-specific strings.
- Example: Adding a tooltip or menu item requires a entry in the relevant `.ftl` file.

---

## 🛠 Common Patterns for Agents

### 1. Interacting with Tabs

Zen logic often wraps standard `gBrowser` calls. Look for `ZenPinnedTabManager.mjs` or similar managers in `src/zen/tabs/`.

### 2. UI Injection

Zen frequently injects elements into the Firefox UI via JavaScript during startup or on specific events. Check `ZenUIManager.mjs` in `src/zen/common/` for shared UI manipulation methods.

### 3. Asynchronous APIs

Many Zen features use `.mjs` modules and rely on asynchronous initialization. Always check if a singleton or manager needs to be awaited or if it's already initialized during `ZenStartup`.


---

## 🌎 Project Globals

Zen Browser and Firefox provide several global objects essential for development. These are primarily accessible through the browser's `window` context.

### Standard Firefox Globals

- **`gBrowser`**: The primary interface for interacting with the browser's tabs. It allows adding, removing, and duplicating tabs, along with accessing the `selectedTab`.
- **`Services`**: A centralized object providing access to numerous Firefox services:
  - `Services.prefs`: Interface for reading and writing user preferences.
  - `Services.wm`: Accesses the Window Manager for interacting with browser windows.
  - `Services.obs`: Used for observing or notifying about internal system events.
- **`SessionStore`**: Managed tab and window state persistence, allowing you to restore tab data across sessions.
- **`PlacesUtils`**: Utilities for history, bookmarks, and finding favicons (e.g., `PlacesUtils.favicons`).
- **`ChromeUtils`**: Primarily used for importing ES modules (`.sys.mjs` or `.mjs`) into the current context.
- **`TabContextMenu`**: Essential for menu-driven features, as it identifies which tab triggered a context menu action.

### Zen-Specific Globals

- **`gZenWorkspaces`**: Manages Zen Workspaces (called "Spaces"). This includes switching workspaces, assignment of tabs, and workspace metadata.
- **`gZenUIManager`**: The core manager for Zen’s custom UI. It handles notifications (toasts), updates to custom toolbars, and layout animations.
- **`gZenGlanceManager`**: Manages the lifecycle and state of "Glance" quick previews.
- **`gZenFolders`**: Orchestrates the logic for organizing tabs into hierarchical folders within the tab bar.
- **`gZenEmojiPicker`**: Global utility for opening and interacting with the emoji/icon picker, frequently used for customizing workspace and tab icons.
- **`gZenVerticalTabsManager`**: Handles interactions and logic specific to the vertical tab implementation.
- **`gZenCommonActions`**: Includes utility functions for frequently performed actions across Zen features (e.g., `copyTabURLToClipboard`).
- **`gZenStartup`**: Manages the initialization sequence of Zen-specific features when the browser starts.

---

## 🔗 Useful Resources

- [Zen Browser Docs](https://docs.zen-browser.app/)
- [Zen Browser Code Structure & Prefs](https://docs.zen-browser.app/contribute/desktop/code-structure-and-prefs)
- [Searchfox (Firefox Source Code Search)](https://searchfox.org/)

## Aditional notes

- When searching something inside the project, always remember the size of the /engine path. Only search inside /engine if you know what you are doing.
