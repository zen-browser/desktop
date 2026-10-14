/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const PREF_UNDERPOWERED = "zen.underpowered.enabled";
const PREF_ADBLOCK = "zen.adblock.enabled";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  PeppermintReader: "moz-src:///peppermint/reader/PeppermintReader.sys.mjs",
  noteURL: "resource:///modules/zen/notepad/ZenNotepadMarkdown.mjs",
  gZenCookieConsent:
    "resource:///modules/zen/cookieconsent/ZenCookieConsentManager.sys.mjs",
});

ChromeUtils.defineLazyGetter(lazy, "l10n", () => {
  return new Localization(["browser/zen-command-palette.ftl"], true);
});

function togglePref(name) {
  Services.prefs.setBoolPref(name, !Services.prefs.getBoolPref(name, false));
}

function cookieConsent() {
  lazy.gZenCookieConsent.init();
  return lazy.gZenCookieConsent;
}

function action(id, labelId, icon, command, isAvailable = () => true) {
  return {
    commandId: `peppermint:${id}`,
    icon,
    extraPayload: {},
    isAvailable,
    command,
    get label() {
      return lazy.l10n.formatValueSync(labelId);
    },
  };
}

const ACTIONS = [
  action(
    "toggle-underpowered",
    "zen-action-toggle-underpowered",
    "chrome://browser/skin/zen-icons/battery-low.svg",
    () => togglePref(PREF_UNDERPOWERED)
  ),
  action(
    "open-notepad",
    "zen-action-open-notepad",
    "chrome://browser/skin/zen-icons/tab.svg",
    window => {
      window.openTrustedLinkIn(lazy.noteURL(crypto.randomUUID()), "tab");
    }
  ),
  action(
    "toggle-reader-mode",
    "zen-action-toggle-reader-mode",
    "chrome://browser/skin/zen-icons/reader-mode.svg",
    window => window.document.getElementById("View:ReaderView")?.doCommand(),
    window => !window.document.getElementById("reader-mode-button")?.hidden
  ),
  action(
    "save-article-offline",
    "zen-action-save-article-offline",
    "chrome://browser/skin/zen-icons/downloads.svg",
    window => lazy.PeppermintReader.toggleSaveCurrent(window),
    window => lazy.PeppermintReader.canSaveCurrent(window)
  ),
  action(
    "open-saved-articles",
    "zen-action-open-saved-articles",
    "chrome://browser/skin/zen-icons/reader-mode.svg",
    window => lazy.PeppermintReader.openSavedArticles(window)
  ),
  action(
    "manage-url-snippets",
    "zen-action-manage-url-snippets",
    "chrome://browser/skin/zen-icons/link.svg",
    window => window.openPreferences("paneZenUrlSnippets")
  ),
  action(
    "toggle-adblock",
    "zen-action-toggle-adblock",
    "chrome://browser/skin/zen-icons/extension.svg",
    () => togglePref(PREF_ADBLOCK)
  ),
  action(
    "clear-cookie-exceptions",
    "zen-action-clear-cookie-exceptions",
    "chrome://browser/skin/zen-icons/history.svg",
    () => cookieConsent().clearPaused(),
    () => cookieConsent().hasPaused()
  ),
];

let registered = false;

/**
 * Add Peppermint commands to Zen's command palette. The palette reads
 * `globalActions` on every query, so pushing here is enough.
 */
export function registerPeppermintActions() {
  if (registered) {
    return;
  }
  registered = true;
  const { globalActions } = ChromeUtils.importESModule(
    "resource:///modules/ZenUBGlobalActions.sys.mjs"
  );
  globalActions.push(...ACTIONS);
}

/**
 * @returns {object[]} The actions this module registers
 */
export function peppermintActions() {
  return ACTIONS;
}
