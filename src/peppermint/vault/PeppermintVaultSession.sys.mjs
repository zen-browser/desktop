/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { PeppermintVaultPassword } from "moz-src:///peppermint/vault/PeppermintVaultPassword.sys.mjs";
import { PeppermintVaultClipboard } from "moz-src:///peppermint/vault/PeppermintVaultClipboard.sys.mjs";

export const STATE_TOPIC = "peppermint-vault-state";

const AUTOLOCK_PREF = "peppermint.vault.autolock-minutes";
const STEPUP_PREF = "peppermint.vault.stepup-minutes";
const SLEEP_PREF = "peppermint.vault.lock-on-sleep";
const HIDDEN_PREF = "peppermint.vault.lock-on-hidden-minutes";

const MAX_BACKOFF_MS = 30000;

/** The idle service does not exist in every build (for example headless). */
function idleService() {
  try {
    return Cc["@mozilla.org/widget/useridleservice;1"].getService(
      Ci.nsIUserIdleService
    );
  } catch {
    return null;
  }
}

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  clearTimeout: "resource://gre/modules/Timer.sys.mjs",
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
});

export class VaultLockedError extends Error {
  name = "VaultLockedError";
}

export class VaultStepUpRequiredError extends Error {
  name = "VaultStepUpRequiredError";
}

/**
 * The one place that knows whether Vault is unlocked.
 *
 * Unlocked means the Primary Password was entered and the NSS token is still
 * logged in. Two tiers sit on top: the session (opening Vault, autofill),
 * which ends on idle, sleep or a hidden Vault tab, and the step-up (reveal,
 * copy, edit, delete), which asks for the password again after
 * peppermint.vault.stepup-minutes.
 */
class VaultSession {
  #unlocked = false;
  #lastAuth = 0;
  #failures = 0;
  #blockedUntil = 0;
  #started = false;
  #idleSeconds = 0;
  #pages = new Map();
  #hiddenTimer = null;
  #lastLockReason = null;
  #now = () => Date.now();

  QueryInterface = ChromeUtils.generateQI([
    "nsIObserver",
    "nsISupportsWeakReference",
  ]);

  get started() {
    return this.#started;
  }

  get lastLockReason() {
    return this.#lastLockReason;
  }

  get isUnlocked() {
    if (this.#unlocked && !PeppermintVaultPassword.isLoggedIn) {
      this.lock("token");
    }
    return this.#unlocked;
  }

  get retryAfterMs() {
    return Math.max(0, this.#blockedUntil - this.#now());
  }

  start() {
    if (this.#started) {
      return;
    }
    this.#started = true;
    Services.prefs.addObserver(AUTOLOCK_PREF, this);
    Services.obs.addObserver(this, "sleep_notification");
    Services.obs.addObserver(this, "quit-application-granted");
    Services.obs.addObserver(this, "passwordmgr-primary-pw-changed");
    this.#armIdle();
  }

  stop() {
    if (!this.#started) {
      return;
    }
    this.#started = false;
    this.#disarmIdle();
    this.#clearHiddenTimer();
    Services.prefs.removeObserver(AUTOLOCK_PREF, this);
    Services.obs.removeObserver(this, "sleep_notification");
    Services.obs.removeObserver(this, "quit-application-granted");
    Services.obs.removeObserver(this, "passwordmgr-primary-pw-changed");
    this.#pages.clear();
    this.lock("disabled");
  }

  /**
   * @param {string} password
   * @returns {{ ok: boolean, blocked?: boolean, retryAfterMs?: number }}
   */
  unlock(password) {
    const retryAfterMs = this.retryAfterMs;
    if (retryAfterMs) {
      return { ok: false, blocked: true, retryAfterMs };
    }
    return this.#authenticate(password);
  }

  /**
   * Re-enters the password for a step-up. A wrong password logs NSS out, so it
   * also ends the session.
   *
   * @param {string} password
   * @returns {{ ok: boolean, blocked?: boolean, retryAfterMs?: number }}
   */
  stepUp(password) {
    return this.unlock(password);
  }

  #authenticate(password) {
    if (!PeppermintVaultPassword.hasPassword) {
      return { ok: false, noPassword: true };
    }
    if (PeppermintVaultPassword.verify(password)) {
      this.#failures = 0;
      this.#blockedUntil = 0;
      this.#lastAuth = this.#now();
      this.#setState(true);
      return { ok: true };
    }
    this.#failures++;
    const backoff = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (this.#failures - 1));
    this.#blockedUntil = this.#now() + backoff;
    this.lock("failed-attempt");
    return { ok: false, retryAfterMs: backoff };
  }

  /**
   * @param {string} [reason]
   */
  lock(reason = "manual") {
    const wasUnlocked = this.#unlocked;
    PeppermintVaultClipboard.clearPending();
    if (this.#started || wasUnlocked) {
      PeppermintVaultPassword.logout();
    }
    this.#lastLockReason = reason;
    this.#lastAuth = 0;
    if (wasUnlocked) {
      this.#setState(false);
    }
  }

  get stepUpRequired() {
    if (!this.isUnlocked) {
      return true;
    }
    const minutes = Services.prefs.getIntPref(STEPUP_PREF, 5);
    return minutes > 0 && this.#now() - this.#lastAuth > minutes * 60000;
  }

  /**
   * Gate for reading the list (session tier).
   *
   * @throws {VaultLockedError}
   */
  ensureUnlocked() {
    if (!this.isUnlocked) {
      throw new VaultLockedError("Vault is locked");
    }
  }

  /**
   * Gate for reveal, copy, edit and delete (step-up tier).
   *
   * @throws {VaultLockedError|VaultStepUpRequiredError}
   */
  ensureRecentAuth() {
    this.ensureUnlocked();
    if (this.stepUpRequired) {
      throw new VaultStepUpRequiredError("Password required again");
    }
  }

  /**
   * Called by each open Vault page as its visibility changes. The session
   * locks when pages exist and none has been visible for the configured time.
   *
   * @param {string} pageId
   * @param {boolean} visible
   */
  setPageVisible(pageId, visible) {
    this.#pages.set(pageId, visible);
    this.#updateHiddenTimer();
  }

  removePage(pageId) {
    this.#pages.delete(pageId);
    this.#updateHiddenTimer();
  }

  #updateHiddenTimer() {
    this.#clearHiddenTimer();
    const minutes = Services.prefs.getIntPref(HIDDEN_PREF, 5);
    const anyVisible = [...this.#pages.values()].some(Boolean);
    if (!this.#unlocked || !this.#pages.size || anyVisible || minutes <= 0) {
      return;
    }
    this.#hiddenTimer = lazy.setTimeout(() => {
      this.#hiddenTimer = null;
      this.lock("hidden");
    }, minutes * 60000);
  }

  #clearHiddenTimer() {
    if (this.#hiddenTimer) {
      lazy.clearTimeout(this.#hiddenTimer);
      this.#hiddenTimer = null;
    }
  }

  #setState(unlocked) {
    this.#unlocked = unlocked;
    this.#updateHiddenTimer();
    Services.obs.notifyObservers(
      null,
      STATE_TOPIC,
      unlocked ? "unlocked" : "locked"
    );
  }

  #armIdle() {
    this.#disarmIdle();
    const minutes = Services.prefs.getIntPref(AUTOLOCK_PREF, 15);
    if (minutes <= 0) {
      return;
    }
    const idle = idleService();
    if (!idle) {
      return;
    }
    this.#idleSeconds = minutes * 60;
    idle.addIdleObserver(this, this.#idleSeconds);
  }

  #disarmIdle() {
    if (this.#idleSeconds) {
      idleService()?.removeIdleObserver(this, this.#idleSeconds);
      this.#idleSeconds = 0;
    }
  }

  observe(_subject, topic) {
    switch (topic) {
      case "idle":
        this.lock("idle");
        break;
      case "sleep_notification":
        if (Services.prefs.getBoolPref(SLEEP_PREF, true)) {
          this.lock("sleep");
        }
        break;
      case "quit-application-granted":
        PeppermintVaultClipboard.clearPending();
        break;
      case "nsPref:changed":
        this.#armIdle();
        break;
      case "passwordmgr-primary-pw-changed":
        if (!PeppermintVaultPassword.hasPassword) {
          this.lock("password-removed");
        }
        break;
    }
  }

  /** Test hooks. Only usable under automation. */
  get testing() {
    if (!Cu.isInAutomation) {
      throw new Error("Only available in automation");
    }
    return {
      setNow: fn => (this.#now = fn),
      resetFailures: () => {
        this.#failures = 0;
        this.#blockedUntil = 0;
      },
      markUnlocked: () => {
        this.#lastAuth = this.#now();
        this.#setState(true);
      },
      idleSeconds: () => this.#idleSeconds,
    };
  }
}

export const PeppermintVaultSession = new VaultSession();
