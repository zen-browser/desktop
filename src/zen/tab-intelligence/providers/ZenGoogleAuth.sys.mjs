// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const PREF_CLIENT_ID = "zen.tab-intelligence.google.oauth.client-id";
const PREF_CLIENT_SECRET = "zen.tab-intelligence.google.oauth.client-secret";
const PREF_REFRESH_TOKEN = "zen.tab-intelligence.google.oauth.refresh-token";
const PREF_USER_EMAIL = "zen.tab-intelligence.google.oauth.user-email";
const PREF_USER_NAME = "zen.tab-intelligence.google.oauth.user-name";

// Default public Google Cloud OAuth Client ID for Zen Browser
const DEFAULT_CLIENT_ID = "619080646197-vqlkm4l2h7a3nksrqk9i7983636fcm51.apps.googleusercontent.com";

const OAUTH_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const OAUTH_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";
const OAUTH_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
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

class nsZenGoogleAuth {
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
        console.error(`[ZenGoogleAuth] Listener error on ${event}:`, e);
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

    try {
      const res = await fetch(OAUTH_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.warn("[ZenGoogleAuth] Failed to refresh token:", errJson);
        if (errJson.error === "invalid_grant") {
          // Token revoked or expired
          this.logout();
        }
        return null;
      }

      const data = await res.json();
      this.#accessToken = data.access_token;
      this.#tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      return this.#accessToken;
    } catch (e) {
      console.warn("[ZenGoogleAuth] Network error during token refresh:", e);
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

    // Start local loopback server on an ephemeral port
    try {
      this.#startLoopbackServer();
    } catch (e) {
      console.error("[ZenGoogleAuth] Failed to start loopback server:", e);
      return false;
    }

    const redirectUri = `http://127.0.0.1:${this.#currentPort}`;
    const clientId = this.getClientId();

    const authUrl = new URL(OAUTH_AUTH_ENDPOINT);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", OAUTH_SCOPES);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");

    // Open tab for authorization
    if (chromeWin?.gBrowser) {
      this.#activeAuthTab = chromeWin.gBrowser.addTrustedTab(authUrl.toString(), {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
      chromeWin.gBrowser.selectedTab = this.#activeAuthTab;
      chromeWin.focus();
    } else {
      console.error("[ZenGoogleAuth] No chrome browser window found to open auth tab");
      return false;
    }

    return true;
  }

  #startLoopbackServer() {
    this.#activeServer = Cc["@mozilla.org/network/server-socket;1"].createInstance(
      Ci.nsIServerSocket
    );
    // Port -1 picks any available port; loopbackOnly = true
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
                    console.warn("[ZenGoogleAuth] OAuth error:", error);
                    authInstance.#notify("onAuthFailed", { error });
                  }
                }
              }
            } catch (err) {
              console.warn("[ZenGoogleAuth] Socket read error:", err);
            } finally {
              try {
                transport.close(0);
              } catch {}
              authInstance.#cleanupServer();
            }
          },
        };

        input.asyncWait(reader, 0, 0, Services.tm.mainThread);
      },
      onStopListening(serverSocket, status) {},
    };

    this.#activeServer.asyncListen(serverListener);
  }

  #renderCallbackHtml(error) {
    const isError = !!error;
    const title = isError ? "Connexion annulée" : "Connexion à Google réussie !";
    const message = isError
      ? "L'autorisation avec votre compte Google n'a pas pu aboutir."
      : "Votre compte Google est maintenant connecté à Zen. Vous pouvez fermer cet onglet.";
    const icon = isError ? "❌" : "✨";

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Zen Browser - Google Tab Intelligence</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #18181b;
      color: #f4f4f5;
    }
    .card {
      padding: 36px 40px;
      border-radius: 16px;
      background: #27272a;
      border: 1px solid rgba(255,255,255,0.1);
      max-width: 440px;
      text-align: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 10px; }
    p { color: #a1a1aa; font-size: 14px; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
  <script>
    setTimeout(() => {
      window.close();
    }, 2500);
  </script>
</body>
</html>`;
  }

  async #handleAuthorizationCode(code) {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const redirectUri = `http://127.0.0.1:${this.#currentPort}`;

    const params = new URLSearchParams();
    params.set("client_id", clientId);
    if (clientSecret) {
      params.set("client_secret", clientSecret);
    }
    params.set("code", code);
    params.set("code_verifier", this.#currentCodeVerifier);
    params.set("grant_type", "authorization_code");
    params.set("redirect_uri", redirectUri);

    try {
      const res = await fetch(OAUTH_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.error("[ZenGoogleAuth] Token exchange failed:", errJson);
        this.#notify("onAuthFailed", { error: errJson });
        return;
      }

      const tokenData = await res.json();
      this.#accessToken = tokenData.access_token;
      this.#tokenExpiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;

      if (tokenData.refresh_token) {
        Services.prefs.setStringPref(PREF_REFRESH_TOKEN, tokenData.refresh_token);
      }

      // Fetch user profile info
      await this.#fetchUserInfo(this.#accessToken);

      this.#notify("onAuthStateChanged", {
        authenticated: true,
        email: this.getUserEmail(),
        name: this.getUserName(),
      });

      // Automatically close the authorization tab after a small delay
      if (this.#activeAuthTab && this.#activeAuthTab.isConnected) {
        Services.tm.mainThread.setTimeout(() => {
          try {
            const browserWin = Services.wm.getMostRecentWindow("navigator:browser");
            browserWin?.gBrowser?.removeTab?.(this.#activeAuthTab);
          } catch {}
          this.#activeAuthTab = null;
        }, 1500);
      }
    } catch (e) {
      console.error("[ZenGoogleAuth] Error during token exchange:", e);
      this.#notify("onAuthFailed", { error: e });
    } finally {
      this.#cleanupActiveAuth();
    }
  }

  async #fetchUserInfo(accessToken) {
    try {
      const res = await fetch(OAUTH_USERINFO_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const info = await res.json();
        if (info.email) {
          Services.prefs.setStringPref(PREF_USER_EMAIL, info.email);
        }
        if (info.name) {
          Services.prefs.setStringPref(PREF_USER_NAME, info.name);
        }
      }
    } catch (e) {
      console.warn("[ZenGoogleAuth] Failed to fetch user info:", e);
    }
  }

  logout() {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      // Best effort revocation
      const params = new URLSearchParams();
      params.set("token", refreshToken);
      fetch(OAUTH_REVOKE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      }).catch(() => {});
    }

    this.#accessToken = null;
    this.#tokenExpiresAt = 0;
    Services.prefs.clearUserPref(PREF_REFRESH_TOKEN);
    Services.prefs.clearUserPref(PREF_USER_EMAIL);
    Services.prefs.clearUserPref(PREF_USER_NAME);

    this.#notify("onAuthStateChanged", { authenticated: false });
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
    this.#currentPort = 0;
  }
}

export const ZenGoogleAuth = new nsZenGoogleAuth();
