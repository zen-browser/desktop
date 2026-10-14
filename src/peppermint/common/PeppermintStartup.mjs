// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Single entry point for everything Peppermint starts alongside Zen. Zen's
 * ZenStartup calls early() before the layout is built and late() after it, so
 * adding or removing a Peppermint feature never touches Zen's own files.
 */

// Each feature starts independently: one failing never blocks the others.
function start(name, run) {
  try {
    run();
  } catch (error) {
    console.error(`${name} failed to start`, error);
  }
}

export const PeppermintStartup = {
  early() {
    start("ZenTabUnloader", () =>
      ChromeUtils.importESModule(
        "resource:///modules/zen/ZenTabUnloader.sys.mjs"
      ).ZenTabUnloader.start()
    );
    start("Peppermint actions", () =>
      ChromeUtils.importESModule(
        "moz-src:///peppermint/common/PeppermintActions.sys.mjs"
      ).registerPeppermintActions()
    );
  },

  late(window) {
    start("Notepad watcher", () =>
      ChromeUtils.importESModule(
        "resource:///actors/ZenNotepadParent.sys.mjs"
      ).watchMintDocuments(window)
    );
    start("ZenAdblock", () =>
      ChromeUtils.importESModule(
        "resource:///modules/zen/adblock/ZenAdblockManager.sys.mjs"
      ).gZenAdblock.init()
    );
    start("ZenCookieConsent", () =>
      ChromeUtils.importESModule(
        "resource:///modules/zen/cookieconsent/ZenCookieConsentManager.sys.mjs"
      ).gZenCookieConsent.init()
    );
    start("PeppermintReader", () =>
      ChromeUtils.importESModule(
        "moz-src:///peppermint/reader/PeppermintReader.sys.mjs"
      ).PeppermintReader.init(window)
    );
    start("ZenUnderpowered", () =>
      ChromeUtils.importESModule(
        "moz-src:///peppermint/underpowered/ZenUnderpowered.sys.mjs"
      ).ZenUnderpowered.init()
    );
  },
};
