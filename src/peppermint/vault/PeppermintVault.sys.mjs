/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Peppermint Vault: a protected, dedicated page (about:vault) for the data
 * Peppermint keeps for autofill, starting with saved logins. Nothing changes
 * until the user opts in from the password settings. See
 * PeppermintVaultSession for locking and PeppermintVaultRegistry for how
 * sections plug in.
 */

import { PeppermintVaultPassword } from "moz-src:///peppermint/vault/PeppermintVaultPassword.sys.mjs";
import { PeppermintVaultRegistry } from "moz-src:///peppermint/vault/PeppermintVaultRegistry.sys.mjs";
import { PeppermintVaultSession } from "moz-src:///peppermint/vault/PeppermintVaultSession.sys.mjs";
import { LoginsSection } from "moz-src:///peppermint/vault/PeppermintVaultLogins.sys.mjs";

export const VAULT_URL = "about:vault";

export const PREFS = {
  enabled: "peppermint.vault.enabled",
  prompted: "peppermint.vault.prompted",
  allowLegacy: "peppermint.vault.allow-legacy-logins",
  restoreSidebar: "peppermint.vault.restore-password-sidebar",
};

const SIDEBAR_PREF = "browser.contextual-password-manager.enabled";
const LEGACY_LOGINS = /^about:logins(?:[?#]|$)/;

const lazy = {};
ChromeUtils.defineLazyGetter(
  lazy,
  "l10n",
  () => new Localization(["browser/peppermint-vault.ftl"], true)
);

class PeppermintVaultImpl {
  #started = false;
  #active = false;
  #windows = new WeakSet();

  /**
   * Called for every browser window.
   *
   * @param {Window} window
   */
  init(window) {
    if (!this.#started) {
      this.#started = true;
      PeppermintVaultRegistry.register(LoginsSection);
      Services.obs.addObserver(this, "passwordmgr-primary-pw-changed");
      if (Cu.isInAutomation) {
        return;
      }
    }
    this.#watchWindow(window);
    if (this.isEnabled && !this.#active) {
      this.#enter();
    }
  }

  get isEnabled() {
    return Services.prefs.getBoolPref(PREFS.enabled, false);
  }

  /**
   * @returns {"off"|"unavailable"|"needs-password"|"locked"|"unlocked"}
   */
  get state() {
    if (!this.isEnabled) {
      return "off";
    }
    if (!LoginsSection.isAvailable().available) {
      return "unavailable";
    }
    if (!PeppermintVaultPassword.hasPassword) {
      return "needs-password";
    }
    return PeppermintVaultSession.isUnlocked ? "unlocked" : "locked";
  }

  /**
   * Whether the user may turn Vault on at all, and why not.
   *
   * @returns {{ allowed: boolean, reason?: string }}
   */
  get canEnable() {
    if (!LoginsSection.isAvailable().available) {
      return { allowed: false, reason: "policy" };
    }
    if (
      !PeppermintVaultPassword.hasPassword &&
      !PeppermintVaultPassword.canSet
    ) {
      return { allowed: false, reason: "no-primary-password-policy" };
    }
    return { allowed: true };
  }

  /**
   * Shows the opt-in dialog, from the "Set up Vault" button in the password
   * settings. Asked once automatically; asking again from the button is
   * always allowed.
   *
   * @param {Window} window
   * @returns {Promise<boolean>} Whether the user chose to continue.
   */
  async promptOptIn(window) {
    const [title, message, proceed, notNow] = lazy.l10n.formatValuesSync(
      [
        "peppermint-vault-prompt-title",
        "peppermint-vault-prompt-message",
        "peppermint-vault-prompt-continue",
        "peppermint-vault-prompt-not-now",
      ].map(id => ({ id }))
    );
    Services.prefs.setBoolPref(PREFS.prompted, true);

    const flags =
      Services.prompt.BUTTON_POS_0_DEFAULT |
      (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) |
      (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1);
    const result = await Services.prompt.asyncConfirmEx(
      window.browsingContext,
      Services.prompt.MODAL_TYPE_INTERNAL_WINDOW,
      title,
      message,
      flags,
      proceed,
      notNow,
      null,
      null,
      false,
      { useTitle: true }
    );
    return result.get("buttonNumClicked") === 0;
  }

  /**
   * Opens Vault in a tab, which shows the setup steps while Vault is off.
   *
   * @param {Window} window
   * @param {object} [options]
   * @param {string} [options.filter]  Pre-fills the search field.
   */
  open(window, { filter = "" } = {}) {
    const url = filter
      ? `${VAULT_URL}?${new URLSearchParams({ filter })}`
      : VAULT_URL;
    window.openTrustedLinkIn(url, "tab");
  }

  /**
   * Called by the setup page once the Primary Password exists.
   *
   * @throws {Error} When there is still no Primary Password.
   */
  completeSetup() {
    if (!PeppermintVaultPassword.hasPassword) {
      throw new Error("A Primary Password is required");
    }
    Services.prefs.setBoolPref(PREFS.enabled, true);
    this.#enter();
  }

  /**
   * Turns Vault off again. Needs a recent Primary Password entry. Saved
   * logins and the Primary Password itself are left untouched.
   */
  disable() {
    PeppermintVaultSession.ensureRecentAuth();
    this.#leave();
    Services.prefs.setBoolPref(PREFS.enabled, false);
  }

  #enter() {
    this.#active = true;
    PeppermintVaultSession.start();
    if (Services.prefs.getBoolPref(SIDEBAR_PREF, false)) {
      Services.prefs.setCharPref(PREFS.restoreSidebar, "true");
      Services.prefs.setBoolPref(SIDEBAR_PREF, false);
    }
  }

  #leave() {
    this.#active = false;
    PeppermintVaultSession.stop();
    if (Services.prefs.getCharPref(PREFS.restoreSidebar, "") == "true") {
      Services.prefs.setBoolPref(SIDEBAR_PREF, true);
    }
    Services.prefs.setCharPref(PREFS.restoreSidebar, "");
  }

  #watchWindow(window) {
    if (this.#windows.has(window) || !window.gBrowser) {
      return;
    }
    this.#windows.add(window);
    // The request seen here is a stand-in for the content process one and
    // cannot be cancelled, so the redirect is a new load that replaces it.
    const listener = {
      QueryInterface: ChromeUtils.generateQI([
        "nsIWebProgressListener",
        "nsISupportsWeakReference",
      ]),
      onStateChange: (browser, progress, request, flags) => {
        const { STATE_START, STATE_IS_DOCUMENT } = Ci.nsIWebProgressListener;
        if (flags & STATE_START && flags & STATE_IS_DOCUMENT) {
          this.#redirectLegacy(browser, progress, request?.URI?.spec);
        }
      },
      onLocationChange: (browser, progress, _request, location) => {
        this.#redirectLegacy(browser, progress, location?.spec);
      },
    };
    window.gBrowser.addTabsProgressListener(listener);
  }

  #redirectLegacy(browser, progress, spec) {
    if (
      !spec ||
      !progress.isTopLevel ||
      !this.#active ||
      !LEGACY_LOGINS.test(spec) ||
      Services.prefs.getBoolPref(PREFS.allowLegacy, false)
    ) {
      return;
    }
    const filter = URL.parse(spec)?.searchParams.get("filter") ?? "";
    const target = filter
      ? `${VAULT_URL}?${new URLSearchParams({ filter })}`
      : VAULT_URL;
    browser.loadURI(Services.io.newURI(target), {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
  }

  observe(_subject, topic) {
    if (
      topic == "passwordmgr-primary-pw-changed" &&
      this.isEnabled &&
      !PeppermintVaultPassword.hasPassword
    ) {
      PeppermintVaultSession.lock("password-removed");
    }
  }

  QueryInterface = ChromeUtils.generateQI([
    "nsIObserver",
    "nsISupportsWeakReference",
  ]);

  /** Test hook: forget runtime state without touching prefs. */
  get testing() {
    if (!Cu.isInAutomation) {
      throw new Error("Only available in automation");
    }
    return {
      enter: () => this.#enter(),
      leave: () => this.#leave(),
      watchWindow: window => this.#watchWindow(window),
    };
  }
}

export const PeppermintVault = new PeppermintVaultImpl();
