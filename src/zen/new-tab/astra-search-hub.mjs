/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Astra Search Hub page controller.
 *
 * Privacy: no Discovery Stream, no telemetry pings, no tippytop, no search
 * suggestions (keystrokes never leave the device). The only network request
 * is the user's explicit Search / shortcut navigation.
 *
 * Trust badges (product defaults + this page):
 * - Confidential Search: no suggestions/telemetry; query sent only on submit
 *   to the user's already-chosen default engine.
 * - Tracker Blocking: privacy.trackingprotection.enabled (strict ETP default).
 * - Site Encryption: dom.security.https_only_mode default.
 */

import {
  addShortcut,
  loadShortcuts,
  MAX_SHORTCUTS,
  removeShortcut,
  resolveShortcutIcon,
} from "chrome://browser/content/zen-newtab/AstraSearchHubShortcuts.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
});

function getChromeWindow() {
  return (
    window.browsingContext?.topChromeWindow ||
    window.docShell?.chromeEventHandler?.ownerGlobal ||
    Services.wm.getMostRecentWindow("navigator:browser")
  );
}

function setL10n(el, id, fallback) {
  if (!el) {
    return;
  }
  if (id && document.l10n) {
    try {
      document.l10n.setAttributes(el, id);
      return;
    } catch {
      // Fall through to plain text.
    }
  }
  if (fallback) {
    el.textContent = fallback;
  }
}

function renderIconNode(icon, className) {
  const wrap = document.createElement("span");
  wrap.className = className;
  if (icon?.type === "image" && icon.src) {
    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    if (
      icon.src.startsWith("chrome://") ||
      icon.src.startsWith("data:image/")
    ) {
      img.src = icon.src;
      wrap.appendChild(img);
      return wrap;
    }
  }
  const mono = document.createElement("span");
  mono.className = "hub-monogram";
  mono.textContent = (icon?.monogram || icon?.text || "?").slice(0, 2);
  wrap.appendChild(mono);
  return wrap;
}

async function openHttps(url, where = "current") {
  let uri;
  try {
    uri = Services.io.newURI(url);
  } catch {
    return;
  }
  if (uri.scheme !== "https") {
    return;
  }
  const chromeWin = getChromeWindow();
  if (typeof chromeWin?.openTrustedLinkIn === "function") {
    chromeWin.openTrustedLinkIn(uri.spec, where, {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
    return;
  }
  window.location.href = uri.spec;
}

function looksLikeUrl(query) {
  const q = query.trim();
  if (!q || q.includes(" ")) {
    return false;
  }
  try {
    const flags =
      Ci.nsIURIFixup.FIXUP_FLAG_FIX_SCHEME_TYPOS |
      Ci.nsIURIFixup.FIXUP_FLAG_ALLOW_KEYWORD_LOOKUP;
    const info = Services.uriFixup.getFixupURIInfo(q, flags);
    if (info.keywordAsSent) {
      return false;
    }
    const scheme = info.fixedURI?.scheme;
    return scheme === "https" || scheme === "http";
  } catch {
    return /^(https:\/\/|www\.)/i.test(q) || /\.[a-z]{2,}(\/.*)?$/i.test(q);
  }
}

async function submitSearch(query) {
  const q = query.trim();
  if (!q) {
    return;
  }
  const chromeWin = getChromeWindow();
  if (looksLikeUrl(q)) {
    try {
      const info = Services.uriFixup.getFixupURIInfo(
        q,
        Ci.nsIURIFixup.FIXUP_FLAG_FIX_SCHEME_TYPOS
      );
      const spec = info.fixedURI?.spec;
      if (spec) {
        if (typeof chromeWin?.openTrustedLinkIn === "function") {
          chromeWin.openTrustedLinkIn(spec, "current");
          return;
        }
        window.location.href = spec;
        return;
      }
    } catch {
      // Fall through to default search engine.
    }
  }

  const isPrivate = !!(
    chromeWin && lazy.PrivateBrowsingUtils.isWindowPrivate(chromeWin)
  );
  await Services.search.init();
  const engine = isPrivate
    ? await Services.search.getDefaultPrivate()
    : await Services.search.getDefault();
  if (!engine) {
    return;
  }
  const submission = engine.getSubmission(q, null, "homepage");
  if (!submission?.uri) {
    return;
  }
  if (typeof chromeWin?.openTrustedLinkIn === "function") {
    chromeWin.openTrustedLinkIn(submission.uri.spec, "current", {
      postData: submission.postData,
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
    return;
  }
  window.location.href = submission.uri.spec;
}

function openSettings() {
  const chromeWin = getChromeWindow();
  if (typeof chromeWin?.openPreferences === "function") {
    chromeWin.openPreferences("paneZenLooks");
    return;
  }
  if (typeof chromeWin?.openTrustedLinkIn === "function") {
    chromeWin.openTrustedLinkIn("about:preferences#paneZenLooks", "tab");
  }
}

async function paintShortcuts() {
  const dock = document.getElementById("hub-dock-list");
  const grid = document.getElementById("hub-grid");
  if (!dock || !grid) {
    return;
  }
  dock.replaceChildren();
  grid.replaceChildren();
  const shortcuts = loadShortcuts();
  for (const shortcut of shortcuts) {
    const icon = await resolveShortcutIcon(shortcut);
    dock.appendChild(makeDockButton(shortcut, icon));
    grid.appendChild(makeGridButton(shortcut, icon));
  }
  grid.appendChild(makeAddTile());
}

function bindShortcutOpen(el, shortcut) {
  el.addEventListener("click", event => {
    event.preventDefault();
    openHttps(shortcut.url, "current");
  });
  el.addEventListener("auxclick", event => {
    if (event.button === 1) {
      event.preventDefault();
      openHttps(shortcut.url, "tab");
    }
  });
  el.addEventListener("contextmenu", event => {
    event.preventDefault();
    if (window.confirm(`Remove “${shortcut.name}”?`)) {
      removeShortcut(shortcut.id);
      paintShortcuts();
    }
  });
}

function makeDockButton(shortcut, icon) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hub-dock-item";
  btn.title = shortcut.name;
  btn.setAttribute("aria-label", shortcut.name);
  btn.appendChild(renderIconNode(icon, "hub-dock-icon"));
  bindShortcutOpen(btn, shortcut);
  return btn;
}

function makeGridButton(shortcut, icon) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hub-grid-item";
  btn.title = shortcut.name;
  btn.appendChild(renderIconNode(icon, "hub-grid-icon"));
  const label = document.createElement("span");
  label.className = "hub-grid-label";
  label.textContent = shortcut.name;
  btn.appendChild(label);
  bindShortcutOpen(btn, shortcut);
  return btn;
}

function makeAddTile() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hub-add-tile";
  setL10n(btn, "astra-search-hub-add-tile", "Add");
  const plus = document.createElement("span");
  plus.className = "hub-add-plus";
  plus.textContent = "+";
  plus.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.className = "hub-grid-label";
  setL10n(label, "astra-search-hub-add", "Add");
  btn.replaceChildren(plus, label);
  btn.addEventListener("click", () => openAddDialog());
  return btn;
}

function openAddDialog() {
  if (loadShortcuts().length >= MAX_SHORTCUTS) {
    window.alert("Shortcut limit reached.");
    return;
  }
  const dialog = document.getElementById("hub-add-dialog");
  const error = document.getElementById("hub-add-error");
  const name = document.getElementById("hub-add-name");
  const url = document.getElementById("hub-add-url");
  error.hidden = true;
  error.textContent = "";
  name.value = "";
  url.value = "https://";
  dialog.showModal();
  name.focus();
}

function initAddDialog() {
  const dialog = document.getElementById("hub-add-dialog");
  const form = document.getElementById("hub-add-form");
  const error = document.getElementById("hub-add-error");
  document.getElementById("hub-add-cancel").addEventListener("click", () => {
    dialog.close();
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    const name = document.getElementById("hub-add-name").value;
    const url = document.getElementById("hub-add-url").value;
    try {
      addShortcut({ name, url });
      dialog.close();
      paintShortcuts();
    } catch (err) {
      error.hidden = false;
      error.textContent =
        err?.message === "limit"
          ? "Shortcut limit reached."
          : "Enter a valid https:// address.";
    }
  });
}

function initSearch() {
  const form = document.getElementById("hub-search");
  const input = document.getElementById("hub-search-input");
  form.addEventListener("submit", event => {
    event.preventDefault();
    submitSearch(input.value);
  });
  input.focus();
}

function initSettings() {
  document.getElementById("hub-settings").addEventListener("click", () => {
    openSettings();
  });
}

function applyTrustVisibility() {
  const row = document.querySelector(".hub-trust");
  if (!row) {
    return;
  }
  const items = [...row.children];
  const flags = [
    true, // Confidential Search is a property of this page.
    Services.prefs.getBoolPref("privacy.trackingprotection.enabled", true),
    Services.prefs.getBoolPref("dom.security.https_only_mode", true),
  ];
  items.forEach((item, index) => {
    item.hidden = !flags[index];
  });
}

document.addEventListener(
  "DOMContentLoaded",
  () => {
    applyTrustVisibility();
    initSearch();
    initSettings();
    initAddDialog();
    paintShortcuts().catch(error => {
      console.error("[AstraSearchHub] paint failed:", error);
    });
  },
  { once: true }
);
