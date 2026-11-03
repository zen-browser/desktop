// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
  clearTimeout: "resource://gre/modules/Timer.sys.mjs",
});

const LOGIN_ORIGIN = "chrome://zen-integrations";
const CONSENT_TIMEOUT = 5 * 60 * 1000;
const EXPIRY_MARGIN = 60 * 1000;

function toBase64URL(bytes) {
  return bytes.toBase64({ alphabet: "base64url", omitPadding: true });
}

function randomString() {
  return toBase64URL(crypto.getRandomValues(new Uint8Array(32)));
}

async function getChallenge(verifier) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return toBase64URL(new Uint8Array(digest));
}

/**
 * OAuth 2.0 client for installed apps (authorization code flow with PKCE).
 *
 * The refresh token is kept in the login manager. A plain "connected" pref
 * sits next to it so we never touch the login manager for users who did not
 * connect an account. Dispatches "change" when the account gets connected or
 * disconnected.
 */
export class ZenOAuthClient extends EventTarget {
  #config;
  #accessToken = null;
  #expiresAt = 0;
  #refreshing = null;

  /**
   * @param {object} config
   * @param {string} config.id - Provider id, used for prefs and the login.
   * @param {string} config.authURL - Authorization endpoint.
   * @param {string} config.tokenURL - Token endpoint.
   * @param {string} config.redirectURI - Loopback address. Intercepted before connection.
   * @param {string[]} config.scopes
   * @param {object} [config.authParams] - Extra authorization parameters.
   */
  constructor(config) {
    super();
    this.#config = config;
  }

  #pref(name) {
    return `zen.integrations.${this.#config.id}.${name}`;
  }

  /**
   * Whether this build ships the credentials needed to connect an account.
   *
   * @returns {boolean}
   */
  get isAvailable() {
    return !!Services.prefs.getStringPref(this.#pref("client-id"), "");
  }

  get isConnected() {
    return Services.prefs.getBoolPref(this.#pref("connected"), false);
  }

  /**
   * Asks the user for consent in a tab and stores the resulting grant.
   *
   * @returns {Promise<boolean>} Whether the account got connected.
   */
  async connect() {
    const window = Services.wm.getMostRecentWindow("navigator:browser");
    if (!this.isAvailable || !window) {
      return false;
    }

    const verifier = randomString();
    const state = randomString();
    const url = new URL(this.#config.authURL);
    url.search = new URLSearchParams({
      client_id: Services.prefs.getStringPref(this.#pref("client-id")),
      redirect_uri: this.#config.redirectURI,
      response_type: "code",
      scope: this.#config.scopes.join(" "),
      state,
      code_challenge: await getChallenge(verifier),
      code_challenge_method: "S256",
      ...this.#config.authParams,
    });

    const redirect = await this.#waitForRedirect(window, url);
    const code = redirect?.searchParams.get("code");
    if (!code || redirect.searchParams.get("state") !== state) {
      return false;
    }

    const data = await this.#requestToken({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: this.#config.redirectURI,
    });
    if (!data.refresh_token) {
      return false;
    }
    await this.#saveRefreshToken(data.refresh_token);
    this.#setConnected(true);
    return true;
  }

  async disconnect() {
    this.#accessToken = null;
    const login = await this.#findLogin();
    if (login) {
      Services.logins.removeLogin(login);
    }
    this.#setConnected(false);
  }

  /**
   * @returns {Promise<string|null>} A valid access token, or null when no
   *   account is connected.
   */
  async getAccessToken() {
    if (this.#accessToken && Date.now() < this.#expiresAt - EXPIRY_MARGIN) {
      return this.#accessToken;
    }
    if (!this.isConnected) {
      return null;
    }
    // Several callers may ask at once, only refresh a single time.
    this.#refreshing ??= this.#refresh().finally(() => {
      this.#refreshing = null;
    });
    return this.#refreshing;
  }

  async #refresh() {
    const login = await this.#findLogin();
    if (!login) {
      this.#setConnected(false);
      return null;
    }
    const data = await this.#requestToken({
      grant_type: "refresh_token",
      refresh_token: login.password,
    });
    // Some providers rotate the refresh token.
    if (data.refresh_token && data.refresh_token !== login.password) {
      await this.#saveRefreshToken(data.refresh_token);
    }
    return data.access_token;
  }

  async #requestToken(params) {
    const body = new URLSearchParams({
      client_id: Services.prefs.getStringPref(this.#pref("client-id")),
      ...params,
    });
    const secret = Services.prefs.getStringPref(
      this.#pref("client-secret"),
      ""
    );
    if (secret) {
      body.set("client_secret", secret);
    }

    const response = await fetch(this.#config.tokenURL, {
      method: "POST",
      body,
    });
    const data = await response.json();
    if (!response.ok) {
      if (data.error === "invalid_grant") {
        await this.disconnect();
      }
      throw new Error(`Token request failed: ${data.error}`);
    }

    this.#accessToken = data.access_token;
    this.#expiresAt = Date.now() + data.expires_in * 1000;
    return data;
  }

  /**
   * Opens the consent page and resolves with the redirect URL once the
   * provider sends the user back, or null if they gave up.
   */
  #waitForRedirect(window, url) {
    const { gBrowser } = window;
    const tab = gBrowser.addTrustedTab(url.href);
    gBrowser.selectedTab = tab;

    return new Promise(resolve => {
      let timer = null;
      const finish = redirect => {
        Services.obs.removeObserver(observer, "http-on-modify-request");
        tab.removeEventListener("TabClose", onTabClose);
        lazy.clearTimeout(timer);
        if (redirect && tab.isConnected) {
          gBrowser.removeTab(tab);
        }
        resolve(redirect);
      };
      const onTabClose = () => finish(null);
      const observer = {
        observe: subject => {
          const { URI } = subject.QueryInterface(Ci.nsIHttpChannel);
          if (URI.spec.startsWith(this.#config.redirectURI)) {
            subject.cancel(Cr.NS_BINDING_ABORTED);
            finish(new URL(URI.spec));
          }
        },
      };

      Services.obs.addObserver(observer, "http-on-modify-request");
      tab.addEventListener("TabClose", onTabClose);
      timer = lazy.setTimeout(() => finish(null), CONSENT_TIMEOUT);
    });
  }

  async #findLogin() {
    const logins = await Services.logins.searchLoginsAsync({
      origin: LOGIN_ORIGIN,
      httpRealm: this.#config.id,
    });
    return logins[0] ?? null;
  }

  async #saveRefreshToken(token) {
    const login = Cc["@mozilla.org/login-manager/loginInfo;1"].createInstance(
      Ci.nsILoginInfo
    );
    login.init(
      LOGIN_ORIGIN,
      null,
      this.#config.id,
      this.#config.id,
      token,
      "",
      ""
    );

    const existing = await this.#findLogin();
    if (existing) {
      Services.logins.modifyLogin(existing, login);
    } else {
      await Services.logins.addLoginAsync(login);
    }
  }

  #setConnected(connected) {
    Services.prefs.setBoolPref(this.#pref("connected"), connected);
    this.dispatchEvent(new Event("change"));
  }
}
