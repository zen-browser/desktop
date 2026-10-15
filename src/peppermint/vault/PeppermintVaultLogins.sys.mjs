/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { PeppermintVaultClipboard } from "moz-src:///peppermint/vault/PeppermintVaultClipboard.sys.mjs";
import { VaultSectionError } from "moz-src:///peppermint/vault/PeppermintVaultRegistry.sys.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  LoginHelper: "resource://gre/modules/LoginHelper.sys.mjs",
});

function hostOf(origin) {
  return URL.parse(origin)?.host.replace(/^www\./, "") ?? origin;
}

function webLink(origin) {
  const url = URL.parse(origin);
  return url && (url.protocol == "https:" || url.protocol == "http:")
    ? url.origin
    : null;
}

function toItem(login) {
  return {
    id: login.guid,
    title: hostOf(login.origin),
    link: webLink(login.origin),
    insecure: URL.parse(login.origin)?.protocol == "http:",
    values: { username: login.username },
    secrets: { password: true },
    lastUsed: login.timeLastUsed,
    changed: login.timePasswordChanged,
  };
}

const FILTERS = {
  all: () => true,
  insecure: item => item.insecure,
  "no-username": item => !item.values.username,
};

const SORTS = {
  title: (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  "recent-use": (a, b) => b.lastUsed - a.lastUsed,
  "recent-change": (a, b) => b.changed - a.changed,
};

async function findLogin(guid) {
  const logins = await Services.logins.searchLoginsAsync({ guid });
  if (logins.length != 1) {
    throw new VaultSectionError("not-found");
  }
  return logins[0];
}

function toSectionError(error) {
  if (error instanceof VaultSectionError) {
    return error;
  }
  if (error?.message?.includes("This login already exists")) {
    return new VaultSectionError("exists", {
      existingId: error.data?.toString(),
    });
  }
  if (error?.message?.includes("password")) {
    return new VaultSectionError("empty-password");
  }
  return new VaultSectionError("invalid", { message: error?.message });
}

/**
 * Saved website logins, backed by the Login Manager. Passwords never leave
 * this module except through getSecret() and getEditable(), which the
 * registry only lets through after a recent Primary Password entry.
 */
export const LoginsSection = {
  id: "logins",
  order: 10,
  titleL10nId: "peppermint-vault-section-logins",
  icon: "chrome://browser/skin/zen-icons/passwords.svg",

  fields: [
    {
      id: "username",
      kind: "text",
      labelL10nId: "peppermint-vault-field-username",
      copy: true,
    },
    {
      id: "password",
      kind: "secret",
      labelL10nId: "peppermint-vault-field-password",
      copy: true,
      reveal: true,
    },
  ],
  editFields: ["username", "password"],
  createFields: ["origin", "username", "password"],

  filters: [
    { id: "all", l10nId: "peppermint-vault-filter-all" },
    { id: "insecure", l10nId: "peppermint-vault-filter-insecure" },
    { id: "no-username", l10nId: "peppermint-vault-filter-no-username" },
  ],
  sorts: [
    { id: "title", l10nId: "peppermint-vault-sort-title" },
    { id: "recent-use", l10nId: "peppermint-vault-sort-recent-use" },
    { id: "recent-change", l10nId: "peppermint-vault-sort-recent-change" },
  ],

  isAvailable() {
    const policies = Services.policies.getActivePolicies();
    return policies?.PasswordManagerEnabled === false
      ? { available: false, reason: "policy" }
      : { available: true };
  },

  async list({ query = "", filter = "all", sort = "title" } = {}) {
    const needle = query.trim().toLowerCase();
    const matchesFilter = FILTERS[filter] ?? FILTERS.all;
    const logins = await lazy.LoginHelper.getAllUserFacingLogins();
    return logins
      .map(toItem)
      .filter(
        item =>
          matchesFilter(item) &&
          (!needle ||
            item.title.toLowerCase().includes(needle) ||
            item.values.username.toLowerCase().includes(needle))
      )
      .sort(SORTS[sort] ?? SORTS.title);
  },

  async getSecret(id, fieldId) {
    if (fieldId != "password") {
      throw new VaultSectionError("unknown-field");
    }
    if (!Services.policies.isAllowed("passwordReveal")) {
      throw new VaultSectionError("reveal-blocked");
    }
    return (await findLogin(id)).password;
  },

  async copy(id, fieldId) {
    const login = await findLogin(id);
    if (fieldId != "username" && fieldId != "password") {
      throw new VaultSectionError("unknown-field");
    }
    PeppermintVaultClipboard.copy(login[fieldId]);
  },

  async getEditable(id) {
    const login = await findLogin(id);
    return { username: login.username, password: login.password };
  },

  async create({ origin, username = "", password }) {
    const cleanOrigin = lazy.LoginHelper.getLoginOrigin(origin ?? "");
    if (!cleanOrigin) {
      throw new VaultSectionError("invalid-origin");
    }
    if (!password) {
      throw new VaultSectionError("empty-password");
    }
    const login = Cc["@mozilla.org/login-manager/loginInfo;1"].createInstance(
      Ci.nsILoginInfo
    );
    login.init(cleanOrigin, "", null, username, password, "", "");
    try {
      await Services.logins.addLoginAsync(login);
    } catch (error) {
      throw toSectionError(error);
    }
  },

  async update(id, { username, password }) {
    const existing = await findLogin(id);
    const modified = existing.clone();
    if (username !== undefined) {
      modified.username = username;
    }
    if (password !== undefined) {
      if (!password) {
        throw new VaultSectionError("empty-password");
      }
      modified.password = password;
    }
    try {
      await Services.logins.modifyLoginAsync(existing, modified);
    } catch (error) {
      throw toSectionError(error);
    }
  },

  async remove(id) {
    await Services.logins.removeLoginAsync(await findLogin(id));
  },
};
