/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export const MIN_PASSWORD_LENGTH = 8;

export const PRIMARY_PASSWORD_CHANGED_TOPIC = "passwordmgr-primary-pw-changed";

function token() {
  return Cc["@mozilla.org/security/internalkeytoken;1"].createInstance(
    Ci.nsIPKCS11Token
  );
}

function sdr() {
  return Cc["@mozilla.org/security/sdr;1"].getService(Ci.nsISecretDecoderRing);
}

/**
 * Thin, test-friendly wrapper over the Primary Password (the PKCS#11 internal
 * key token). Vault never stores the password; it only verifies it.
 */
export const PeppermintVaultPassword = {
  get hasPassword() {
    return token().hasPassword;
  },

  get isLoggedIn() {
    const internal = token();
    return !internal.hasPassword || internal.isLoggedIn;
  },

  get canSet() {
    return Services.policies.isAllowed("createMasterPassword");
  },

  get canRemove() {
    return Services.policies.isAllowed("removeMasterPassword");
  },

  /**
   * Checks a candidate password. NSS first logs the token out and then logs in
   * with the candidate, so an already logged in token never lets a wrong
   * password through, and a wrong attempt leaves the token logged out.
   *
   * @param {string} password
   * @returns {boolean}
   */
  verify(password) {
    return sdr().login(password);
  },

  logout() {
    sdr().logout();
  },

  /**
   * @param {string} password
   * @returns {{ ok: boolean, reason?: "empty" | "too-short" }}
   */
  validateNew(password) {
    if (!password) {
      return { ok: false, reason: "empty" };
    }
    if ([...password].length < MIN_PASSWORD_LENGTH) {
      return { ok: false, reason: "too-short" };
    }
    return { ok: true };
  },

  /**
   * Rough strength from 0 (empty) to 4, using the same ingredients as the
   * Primary Password dialog: length, digits, symbols and mixed case.
   *
   * @param {string} password
   * @returns {number}
   */
  strength(password) {
    if (!password) {
      return 0;
    }
    const length = [...password].length;
    const classes = [
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /[0-9]/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ].filter(Boolean).length;
    let score = 0;
    if (length >= MIN_PASSWORD_LENGTH) {
      score++;
    }
    if (length >= 12) {
      score++;
    }
    if (classes >= 3) {
      score++;
    }
    if (classes >= 2 && length >= 16) {
      score++;
    }
    return Math.min(score, 4);
  },

  /**
   * Sets, or changes, the Primary Password.
   *
   * @param {string} oldPassword  Empty when none is set yet.
   * @param {string} newPassword
   * @throws When the old password is wrong or NSS refuses the change.
   */
  async change(oldPassword, newPassword) {
    await token().changePassword(oldPassword, newPassword);
    Services.obs.notifyObservers(null, PRIMARY_PASSWORD_CHANGED_TOPIC);
  },

  /**
   * @param {Error} error
   * @returns {boolean} Whether error means the old password was wrong.
   */
  isBadPasswordError(error) {
    const service = Cc["@mozilla.org/nss_errors_service;1"].getService(
      Ci.nsINSSErrorsService
    );
    const SEC_ERROR_BAD_PASSWORD = 15;
    return (
      error?.result ==
      service.getXPCOMFromNSSError(
        Ci.nsINSSErrorsService.NSS_SEC_ERROR_BASE + SEC_ERROR_BAD_PASSWORD
      )
    );
  },
};
