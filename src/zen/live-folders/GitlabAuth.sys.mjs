// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const HTTP_REALM = "zen-live-folder-gitlab-pat";
const USERNAME = "zen";

function originForHost(host) {
  return `https://${host}`;
}

function buildLoginInfo(host, token) {
  const login = Cc["@mozilla.org/login-manager/loginInfo;1"].createInstance(
    Ci.nsILoginInfo
  );
  login.init(originForHost(host), null, HTTP_REALM, USERNAME, token, "", "");
  return login;
}

export const GitlabAuth = {
  async getToken(host) {
    if (!host) {
      return null;
    }
    const logins = await Services.logins.searchLoginsAsync({
      origin: originForHost(host),
      httpRealm: HTTP_REALM,
    });
    return logins[0]?.password ?? null;
  },

  async setToken(host, token) {
    if (!host || !token) {
      return;
    }
    await this.removeToken(host);
    await Services.logins.addLoginAsync(buildLoginInfo(host, token));
  },

  async removeToken(host) {
    if (!host) {
      return;
    }
    const logins = await Services.logins.searchLoginsAsync({
      origin: originForHost(host),
      httpRealm: HTTP_REALM,
    });
    for (const login of logins) {
      Services.logins.removeLogin(login);
    }
  },
};
