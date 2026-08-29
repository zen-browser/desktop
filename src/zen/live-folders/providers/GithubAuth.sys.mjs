// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineLazyGetter(lazy, "l10n", () => new Localization(["browser/zen-live-folders.ftl"]));

const LoginInfo = Components.Constructor(
  "@mozilla.org/login-manager/loginInfo;1",
  Ci.nsILoginInfo,
  "init"
);

export class GithubTokenManager {
  static REALM = "zen-live-folder-github-pat";

  /**
   * Returns the stored PAT for the given origin, or null if none exists.
   *
   * @param {string} origin - The GitHub host origin (e.g. "https://github.com")
   * @returns {Promise<string|null>}
   */
  static async getToken(origin) {
    const logins = await Services.logins.searchLoginsAsync({
      origin,
      httpRealm: GithubTokenManager.REALM,
    });
    if (logins.length > 0) {
      return logins[0].password;
    }
    return null;
  }

  /**
   * Stores or updates a PAT for the given origin.
   *
   * @param {string} origin - The GitHub host origin
   * @param {string} token - The personal access token
   */
  static async setToken(origin, token) {
    const logins = await Services.logins.searchLoginsAsync({
      origin,
      httpRealm: GithubTokenManager.REALM,
    });

    if (logins.length > 0) {
      const oldLogin = logins[0];
      const newLoginData = oldLogin.clone();
      newLoginData.password = token;
      await Services.logins.modifyLoginAsync(oldLogin, newLoginData);
    } else {
      const loginInfo = new LoginInfo(
        origin,
        null, // formActionOrigin
        GithubTokenManager.REALM,
        "", // username
        token,
        "", // usernameField
        "" // passwordField
      );
      await Services.logins.addLoginAsync(loginInfo);
    }
  }

  /**
   * Removes the stored PAT for the given origin.
   *
   * @param {string} origin - The GitHub host origin
   */
  static async removeToken(origin) {
    const logins = await Services.logins.searchLoginsAsync({
      origin,
      httpRealm: GithubTokenManager.REALM,
    });
    if (logins.length > 0) {
      await Services.logins.removeLoginAsync(logins[0]);
    }
  }

  /**
   * Shows a password prompt for the user to enter a PAT, validates it,
   * stores it if valid, and returns whether a token was successfully stored.
   *
   * @param {Window} window - The browser window for the prompt
   * @param {string} origin - The GitHub host origin
   * @returns {Promise<boolean>}
   */
  static async promptForToken(window, origin) {
    const title = await lazy.l10n.formatValue("zen-live-folder-github-prompt-token");
    const passwordObj = { value: "" };
    const checkObj = { value: false };

    const ok = Services.prompt.promptPassword(
      window,
      title,
      title,
      passwordObj,
      null,
      checkObj
    );

    if (!ok) {
      return false;
    }

    const token = passwordObj.value.trim();
    if (!token) {
      return false;
    }

    await GithubTokenManager.setToken(origin, token);
    return true;
  }
}
