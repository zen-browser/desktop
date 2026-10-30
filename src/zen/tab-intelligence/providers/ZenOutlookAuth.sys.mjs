// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const PREF_CLIENT_ID = "zen.tab-intelligence.outlook.oauth.client-id";
const PREF_CLIENT_SECRET = "zen.tab-intelligence.outlook.oauth.client-secret";
const PREF_REFRESH_TOKEN = "zen.tab-intelligence.outlook.oauth.refresh-token";
const PREF_USER_EMAIL = "zen.tab-intelligence.outlook.oauth.user-email";
const PREF_USER_NAME = "zen.tab-intelligence.outlook.oauth.user-name";

// Default public Microsoft Entra App Client ID for Zen Browser (can be overridden in settings)
const DEFAULT_CLIENT_ID = "zen-browser-outlook-client-id";

const OAUTH_AUTH_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const OAUTH_TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const OAUTH_USERINFO_ENDPOINT = "https://graph.microsoft.com/v1.0/me";

const OAUTH_SCOPES = [
  "offline_access",
  "User.Read",
  "Mail.Read",
  "Calendars.Read",
].join(" ");

function base64UrlEncode(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  globalThis.crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

class nsZenOutlookAuth {
  #accessToken = null;
  #tokenExpiresAt = 0;
  #listeners = new Set();
  #activeServer = null;
  #activeAuthTab = null;
  #currentCodeVerifier = null;
  #currentPort = 0;

  constructor() {}

  addListener(listener) {
    this.#listeners.add(listener);
  }

  removeListener(listener) {
    this.#listeners.delete(listener);
  }

  #notify(event, data) {
    for (const listener of this.#listeners) {
      try {
        if (typeof listener[event] === "function") {
          listener[event](data);
        }
      } catch (e) {
        console.error(`[ZenOutlookAuth] Listener error on ${event}:`, e);
      }
    }
  }

  getClientId() {
    const customId = Services.prefs.getStringPref(PREF_CLIENT_ID, "").trim();
    return customId || DEFAULT_CLIENT_ID;
  }

  getClientSecret() {
    return Services.prefs.getStringPref(PREF_CLIENT_SECRET, "").trim();
  }

  getRefreshToken() {
    return Services.prefs.getStringPref(PREF_REFRESH_TOKEN, "").trim();
  }

  getUserEmail() {
    return Services.prefs.getStringPref(PREF_USER_EMAIL, "").trim();
  }

  getUserName() {
    return Services.prefs.getStringPref(PREF_USER_NAME, "").trim();
  }

  isAuthenticated() {
    return this.getRefreshToken().length > 0;
  }

  async getValidAccessToken() {
    const now = Date.now();
    if (this.#accessToken && now < this.#tokenExpiresAt - 60000) {
      return this.#accessToken;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    return await this.#refreshAccessToken(refreshToken);
  }

  async #refreshAccessToken(refreshToken) {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    const params = new URLSearchParams();
    params.set("client_id", clientId);
    if (clientSecret) {
      params.set("client_secret", clientSecret);
    }
    params.set("refresh_token", refreshToken);
    params.set("grant_type", "refresh_token");
    params.set("scope", OAUTH_SCOPES);

    try {
      const res = await fetch(OAUTH_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.warn("[ZenOutlookAuth] Failed to refresh token:", errJson);
        if (errJson.error === "invalid_grant") {
          this.logout();
        }
        return null;
      }

      const data = await res.json();
      this.#accessToken = data.access_token;
      this.#tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      if (data.refresh_token) {
        Services.prefs.setStringPref(PREF_REFRESH_TOKEN, data.refresh_token);
      }
      return this.#accessToken;
    } catch (e) {
      console.warn("[ZenOutlookAuth] Network error during token refresh:", e);
      return null;
    }
  }

  async login(browserWindow = null) {
    let chromeWin = browserWindow?.gBrowser
      ? browserWindow
      : browserWindow?.browsingContext?.topChromeWindow ||
        Services.wm.getMostRecentWindow("navigator:browser");

    this.#cleanupActiveAuth();

    this.#currentCodeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(this.#currentCodeVerifier);

    try {
      this.#startLoopbackServer();
    } catch (e) {
      console.error("[ZenOutlookAuth] Failed to start loopback server:", e);
      return false;
    }

    const redirectUri = `http://localhost:${this.#currentPort}`;
    const clientId = this.getClientId();

    const authUrl = new URL(OAUTH_AUTH_ENDPOINT);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", OAUTH_SCOPES);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("response_mode", "query");
    authUrl.searchParams.set("prompt", "select_account");

    if (chromeWin?.gBrowser) {
      this.#activeAuthTab = chromeWin.gBrowser.addTrustedTab(authUrl.toString(), {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
      chromeWin.gBrowser.selectedTab = this.#activeAuthTab;
      chromeWin.focus();
    } else {
      console.error("[ZenOutlookAuth] No chrome browser window found to open auth tab");
      return false;
    }

    return true;
  }

  #startLoopbackServer() {
    this.#activeServer = Cc["@mozilla.org/network/server-socket;1"].createInstance(
      Ci.nsIServerSocket
    );
    this.#activeServer.init(-1, true, -1);
    this.#currentPort = this.#activeServer.port;

    const authInstance = this;
    const serverListener = {
      onSocketAccepted(serverSocket, transport) {
        const input = transport.openInputStream(0, 0, 0);
        const output = transport.openOutputStream(0, 0, 0);

        const reader = {
          onInputStreamReady(stream) {
            try {
              const scriptableIn = Cc[
                "@mozilla.org/scriptableinputstream;1"
              ].createInstance(Ci.nsIScriptableInputStream);
              scriptableIn.init(stream);
              const available = scriptableIn.available();
              if (available > 0) {
                const requestText = scriptableIn.read(available);
                const reqLineMatch = requestText.match(/GET\s+([^\s]+)\s+HTTP/i);
                if (reqLineMatch) {
                  const reqPath = reqLineMatch[1];
                  const url = new URL(reqPath, `http://127.0.0.1:${authInstance.#currentPort}`);
                  const code = url.searchParams.get("code");
                  const error = url.searchParams.get("error");

                  const html = authInstance.#renderCallbackHtml(error);
                  const response =
                    "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: text/html; charset=utf-8\r\n" +
                    "Content-Length: " +
                    new TextEncoder().encode(html).length +
                    "\r\n" +
                    "Connection: close\r\n\r\n" +
                    html;

                  output.write(response, response.length);
                  output.flush();

                  if (code) {
                    authInstance.#handleAuthorizationCode(code);
                  } else if (error) {
                    console.warn("[ZenOutlookAuth] OAuth error:", error);
                    authInstance.#notify("onAuthFailed", { error });
                  }
                }
              }
            } catch (err) {
              console.warn("[ZenOutlookAuth] Socket read error:", err);
            } finally {
              try {
                transport.close(0);
              } catch {}
              authInstance.#cleanupServer();
            }
          },
        };

        const asyncIn = input.QueryInterface(Ci.nsIAsyncInputStream);
        asyncIn.asyncWait(reader, 0, 0, Services.tm.currentThread);
      },
      onStopListening() {},
    };

    this.#activeServer.asyncListen(serverListener);
  }

  #cleanupServer() {
    if (this.#activeServer) {
      try {
        this.#activeServer.close();
      } catch {}
      this.#activeServer = null;
    }
  }

  #cleanupActiveAuth() {
    this.#cleanupServer();
    this.#currentCodeVerifier = null;
    this.#activeAuthTab = null;
  }

  #handleAuthorizationCode(code) {
    this.#exchangeCodeForTokens(code).catch(err => {
      console.error("[ZenOutlookAuth] Error during token exchange:", err);
      this.#notify("onAuthFailed", { error: err.message });
    });
  }

  async #exchangeCodeForTokens(code) {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const redirectUri = `http://localhost:${this.#currentPort}`;

    const params = new URLSearchParams();
    params.set("client_id", clientId);
    if (clientSecret) {
      params.set("client_secret", clientSecret);
    }
    params.set("code", code);
    params.set("code_verifier", this.#currentCodeVerifier);
    params.set("redirect_uri", redirectUri);
    params.set("grant_type", "authorization_code");
    params.set("scope", OAUTH_SCOPES);

    const res = await fetch(OAUTH_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.error("[ZenOutlookAuth] Token exchange failed:", errJson);
      throw new Error(errJson.error_description || errJson.error || "Échec échange de jeton");
    }

    const data = await res.json();
    this.#accessToken = data.access_token;
    this.#tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;

    if (data.refresh_token) {
      Services.prefs.setStringPref(PREF_REFRESH_TOKEN, data.refresh_token);
    }

    await this.#fetchUserInfo();

    if (this.#activeAuthTab && this.#activeAuthTab.isConnected) {
      try {
        const browserWin = this.#activeAuthTab.ownerGlobal;
        browserWin.gBrowser?.removeTab(this.#activeAuthTab);
      } catch {}
      this.#activeAuthTab = null;
    }

    this.#notify("onAuthStateChanged", { authenticated: true });
  }

  async #fetchUserInfo() {
    if (!this.#accessToken) return;
    try {
      const res = await fetch(OAUTH_USERINFO_ENDPOINT, {
        headers: { Authorization: `Bearer ${this.#accessToken}` },
      });
      if (res.ok) {
        const user = await res.json();
        const email = user.mail || user.userPrincipalName || "";
        const name = user.displayName || "";
        Services.prefs.setStringPref(PREF_USER_EMAIL, email);
        Services.prefs.setStringPref(PREF_USER_NAME, name);
      }
    } catch (e) {
      console.warn("[ZenOutlookAuth] Failed to fetch user info:", e);
    }
  }

  logout() {
    this.#accessToken = null;
    this.#tokenExpiresAt = 0;
    Services.prefs.clearUserPref(PREF_REFRESH_TOKEN);
    Services.prefs.clearUserPref(PREF_USER_EMAIL);
    Services.prefs.clearUserPref(PREF_USER_NAME);

    this.#notify("onAuthStateChanged", { authenticated: false });
  }

  #renderCallbackHtml(error = null) {
    const isSuccess = !error;
    const title = isSuccess ? "Connexion réussie !" : "Échec de connexion";
    const desc = isSuccess
      ? "Votre compte Outlook / Microsoft a été associé à Zen Browser avec succès. Vous pouvez fermer cet onglet."
      : `Une erreur est survenue lors de l'authentification : ${error || "Inconnu"}`;
    const color = isSuccess ? "#10b981" : "#ef4444";
    const icon = isSuccess ? "✓" : "✕";

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Zen Browser - Authentification Outlook</title>
  <style>
    body {
      background: #121214;
      color: #ededed;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: #1c1c20;
      border: 1px solid #2e2e34;
      border-radius: 16px;
      padding: 40px;
      max-width: 440px;
      text-align: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    }
    .icon {
      width: 56px;
      height: 56px;
      line-height: 56px;
      border-radius: 28px;
      background: ${color}20;
      color: ${color};
      font-size: 28px;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 12px;
    }
    p {
      color: #a1a1aa;
      font-size: 14px;
      line-height: 1.5;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${desc}</p>
  </div>
  <script>
    if (${isSuccess}) {
      setTimeout(() => {
        try { window.close(); } catch {}
      }, 1500);
    }
  </script>
</body>
</html>`;
  }
}

export const ZenOutlookAuth = new nsZenOutlookAuth();
