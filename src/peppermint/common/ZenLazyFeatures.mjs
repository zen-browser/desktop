// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Loads secondary browser-window features after first paint.
 *
 * Startup, workspaces, the UI manager, vertical tabs and compact mode stay
 * in ZenPreloadedScripts. Everything else is a lazy window getter, or it is
 * imported on the first event that needs it. Stylesheets for those features
 * are inserted with the module, not during HTML parse.
 *
 * Tab drag-and-drop stays eager: the tab strip constructs `ZenDragAndDrop`
 * while the document is still parsing.
 */

const STYLE = {
  welcome: "chrome://browser/content/zen-styles/zen-welcome.css",
  homepage: "chrome://browser/content/zen-styles/zen-homepage.css",
  media: "chrome://browser/content/zen-styles/zen-media-controls.css",
  downloads:
    "chrome://browser/content/zen-styles/zen-download-box-animation.css",
  gradient: "chrome://browser/content/zen-styles/zen-gradient-generator.css",
  glance: "chrome://browser/content/zen-styles/zen-glance.css",
};

const FEATURES = [
  {
    id: "bookmarks",
    global: "ZenWorkspaceBookmarksStorage",
    subscript:
      "chrome://browser/content/zen-components/ZenSpaceBookmarksStorage.js",
  },
  {
    id: "shortcuts",
    global: "gZenKeyboardShortcutsManager",
    module: "chrome://browser/content/zen-components/ZenKeyboardShortcuts.mjs",
  },
  {
    id: "session-store",
    global: "gZenSessionStore",
    module: "chrome://browser/content/zen-components/ZenSessionStore.mjs",
    when: "layout",
  },
  {
    id: "mods",
    global: "gZenMods",
    module: "chrome://browser/content/zen-components/ZenMods.mjs",
    when: "layout",
  },
  {
    id: "pinned",
    global: "gZenPinnedTabManager",
    module: "chrome://browser/content/zen-components/ZenPinnedTabManager.mjs",
    when: "content",
  },
  {
    id: "renamer",
    global: "gZenTabRenamer",
    module: "resource:///modules/zen/ZenTabRenamer.mjs",
    when: "content",
  },
  {
    id: "folders",
    global: "gZenFolders",
    module: "chrome://browser/content/zen-components/ZenFolders.mjs",
    when: "content",
  },
  {
    id: "glance",
    global: "gZenGlanceManager",
    module: "chrome://browser/content/zen-components/ZenGlanceManager.mjs",
    styles: ["glance"],
    when: "content",
  },
  {
    id: "splitter",
    global: "gZenViewSplitter",
    module: "chrome://browser/content/zen-components/ZenViewSplitter.mjs",
    when: "content",
  },
  {
    id: "homepage",
    global: "gZenHomepage",
    module: "resource:///modules/zen/homepage/ZenHomepage.mjs",
    styles: ["homepage"],
    manualInit: true,
  },
  {
    id: "media",
    global: "gZenMediaController",
    module: "chrome://browser/content/zen-components/ZenMediaController.mjs",
    styles: ["media"],
  },
  {
    id: "emoji",
    global: "gZenEmojiPicker",
    module: "chrome://browser/content/zen-components/ZenEmojiPicker.mjs",
  },
  {
    id: "downloads",
    module: "chrome://browser/content/zen-components/ZenDownloadAnimation.mjs",
    styles: ["downloads"],
    when: "idle",
  },
  {
    id: "share",
    global: "gZenShareManager",
    module: "resource:///modules/zen/share/ZenShareManager.mjs",
    when: "idle",
  },
];

const byId = new Map(FEATURES.map(feature => [feature.id, feature]));
const insertedStyles = new Set();

function ensureStyle(href) {
  if (!href || insertedStyles.has(href)) {
    return;
  }
  if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) {
    insertedStyles.add(href);
    return;
  }
  insertedStyles.add(href);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  (document.querySelector("linkset") || document.documentElement).appendChild(
    link
  );
}

function load(id) {
  const feature = byId.get(id);
  if (!feature || feature.loaded) {
    return feature?.global ? window[feature.global] : undefined;
  }
  feature.loaded = true;
  // The module assigns `window[global] = ...` in strict mode. An accessor
  // without a setter would throw, so drop the lazy getter first.
  if (feature.global) {
    delete window[feature.global];
  }
  const pendingInit = [];
  const previousHold = api.holdInit;
  const previousTake = api.takeInit;
  api.holdInit = true;
  api.takeInit = fn => pendingInit.push(fn);
  try {
    for (const name of feature.styles || []) {
      ensureStyle(STYLE[name]);
    }
    if (feature.subscript) {
      Services.scriptloader.loadSubScript(feature.subscript, window);
    } else {
      ChromeUtils.importESModule(feature.module, { global: "current" });
    }
    for (const init of pendingInit) {
      init();
    }
    if (feature.manualInit) {
      window[feature.global]?.init?.();
    }
  } catch (error) {
    console.error(`ZenLazyFeatures: failed to load ${id}`, error);
  } finally {
    api.holdInit = previousHold;
    api.takeInit = previousTake;
  }
  return feature.global ? window[feature.global] : undefined;
}

function defineLazy(feature) {
  Object.defineProperty(window, feature.global, {
    configurable: true,
    enumerable: true,
    get() {
      return load(feature.id);
    },
  });
}

function loadGroup(when) {
  for (const feature of FEATURES) {
    if (feature.when === when) {
      load(feature.id);
    }
  }
}

function whenDelayedStartupFinished(callback) {
  if (window.gBrowserInit?.delayedStartupFinished) {
    callback();
    return;
  }
  const observer = {
    observe(subject, topic) {
      if (topic !== "browser-delayed-startup-finished" || subject !== window) {
        return;
      }
      Services.obs.removeObserver(observer, topic);
      callback();
    },
  };
  Services.obs.addObserver(observer, "browser-delayed-startup-finished");
}

function prefetchAfterStartup() {
  whenDelayedStartupFinished(() => {
    ChromeUtils.idleDispatch(() => {
      loadGroup("idle");
      if (!byId.get("media").loaded) {
        for (const tab of window.gBrowser?.tabs || []) {
          if (tab.hasAttribute("soundplaying")) {
            load("media");
            break;
          }
        }
      }
      try {
        // Motion is ~141KB and was parsed on the first animation.
        void window.gZenUIManager?.motion;
      } catch (error) {
        console.error("ZenLazyFeatures: motion prefetch failed", error);
      }
    });
  });
}

const api = {
  pastLayout: false,
  pastContent: false,
  holdInit: false,
  takeInit() {},
  load,
  isLoaded(id) {
    return !!byId.get(id)?.loaded;
  },
  style(name) {
    ensureStyle(STYLE[name]);
  },
};

window.gZenLazyFeatures = api;

document.addEventListener(
  "MozBeforeInitialXULLayout",
  () => {
    api.pastLayout = true;
  },
  { capture: true, once: true }
);
document.addEventListener(
  "DOMContentLoaded",
  () => {
    api.pastContent = true;
  },
  { capture: true, once: true }
);

for (const feature of FEATURES) {
  if (feature.global) {
    defineLazy(feature);
  }
}

document.addEventListener(
  "MozBeforeInitialXULLayout",
  () => loadGroup("layout"),
  { once: true }
);
document.addEventListener("DOMContentLoaded", () => loadGroup("content"), {
  once: true,
});

document.addEventListener(
  "popupshowing",
  event => {
    const id = event.target?.id;
    if (id === "PanelUI-zen-gradient-generator") {
      ensureStyle(STYLE.gradient);
      return;
    }
    if (id !== "PanelUI-zen-emojis-picker" || byId.get("emoji").loaded) {
      return;
    }
    load("emoji");
    try {
      window.gZenEmojiPicker?.handleEvent?.(event);
    } catch (error) {
      console.error("ZenLazyFeatures: emoji picker failed to open", error);
    }
  },
  true
);

window.addEventListener(
  "TabAttrModified",
  event => {
    if (byId.get("media").loaded) {
      return;
    }
    if (!event.detail?.changed?.includes("soundplaying")) {
      return;
    }
    load("media");
    if (!event.target?.hasAttribute?.("soundplaying")) {
      return;
    }
    try {
      window.gZenMediaController?.onAudioPlaybackStarted?.(
        event.target.linkedBrowser
      );
    } catch (error) {
      console.error("ZenLazyFeatures: media controls failed to start", error);
    }
  },
  true
);

prefetchAfterStartup();
