/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  PeppermintVaultSession,
  STATE_TOPIC,
} from "moz-src:///peppermint/vault/PeppermintVaultSession.sys.mjs";

/**
 * Error with a stable code that the page maps to a translated message.
 */
export class VaultSectionError extends Error {
  name = "VaultSectionError";

  /**
   * @param {string} code  For example "exists", "invalid" or "not-found".
   * @param {object} [details]
   */
  constructor(code, details = {}) {
    super(details.message ?? code);
    this.code = code;
    this.details = details;
  }
}

/**
 * Authentication a section call needs. "session" is enough to see the list;
 * "stepup" needs the Primary Password to have been entered recently.
 */
const TIER_SESSION = "session";
const TIER_STEPUP = "stepup";

const METHOD_TIERS = {
  describe: TIER_SESSION,
  list: TIER_SESSION,
  getSecret: TIER_STEPUP,
  getEditable: TIER_STEPUP,
  copy: null,
  create: TIER_STEPUP,
  update: TIER_STEPUP,
  remove: TIER_STEPUP,
};

const REQUIRED_STRING = ["id", "titleL10nId"];
const REQUIRED_FUNCTIONS = ["list", "copy", "getSecret"];

const sections = new Map();

function validate(section) {
  for (const key of REQUIRED_STRING) {
    if (typeof section?.[key] != "string" || !section[key]) {
      throw new Error(`Vault section needs a string "${key}"`);
    }
  }
  for (const key of REQUIRED_FUNCTIONS) {
    if (typeof section[key] != "function") {
      throw new Error(`Vault section "${section.id}" needs ${key}()`);
    }
  }
  if (!Array.isArray(section.fields) || !section.fields.length) {
    throw new Error(`Vault section "${section.id}" needs fields`);
  }
  const ids = new Set();
  for (const field of section.fields) {
    if (!field.id || ids.has(field.id)) {
      throw new Error(`Vault section "${section.id}" has a bad field id`);
    }
    ids.add(field.id);
  }
}

function tierFor(section, method, args) {
  if (method == "copy") {
    const field = section.fields.find(f => f.id == args[1]);
    return field?.kind == "secret" ? TIER_STEPUP : TIER_SESSION;
  }
  return METHOD_TIERS[method];
}

/**
 * Where sections (logins, cards, addresses, ...) register themselves. Every
 * call from the page goes through call(), which is the single place that
 * enforces authentication, so a section can never be reached while Vault is
 * locked, whatever it does internally.
 */
export const PeppermintVaultRegistry = {
  /**
   * @param {object} section  See PeppermintVaultLogins.sys.mjs for the shape.
   */
  register(section) {
    validate(section);
    sections.set(section.id, section);
  },

  unregister(id) {
    sections.delete(id);
  },

  has(id) {
    return sections.has(id);
  },

  /**
   * Section descriptions for the page: everything except functions.
   *
   * @returns {object[]}
   */
  describeAll() {
    PeppermintVaultSession.ensureUnlocked();
    return [...sections.values()]
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
      .map(section => ({
        id: section.id,
        titleL10nId: section.titleL10nId,
        icon: section.icon ?? null,
        fields: section.fields,
        createFields: section.createFields ?? [],
        editFields: section.editFields ?? [],
        filters: section.filters ?? [],
        sorts: section.sorts ?? [],
        availability: section.isAvailable?.() ?? { available: true },
      }));
  },

  /**
   * @param {string} sectionId
   * @param {string} method
   * @param {...any} args
   * @throws {VaultLockedError|VaultStepUpRequiredError|VaultSectionError}
   */
  async call(sectionId, method, ...args) {
    const section = sections.get(sectionId);
    if (!section || !(method in METHOD_TIERS)) {
      throw new VaultSectionError("unknown-call", { sectionId, method });
    }
    const tier = tierFor(section, method, args);
    if (tier == TIER_STEPUP) {
      PeppermintVaultSession.ensureRecentAuth();
    } else {
      PeppermintVaultSession.ensureUnlocked();
    }
    if (typeof section[method] != "function") {
      throw new VaultSectionError("unsupported", { sectionId, method });
    }
    return section[method](...args);
  },

  /** Test hook. */
  get sectionIds() {
    return [...sections.keys()];
  },
};

Services.obs.addObserver(
  {
    observe(_subject, _topic, data) {
      if (data == "locked") {
        for (const section of sections.values()) {
          try {
            section.onLock?.();
          } catch (error) {
            console.error(`Vault section ${section.id} onLock failed`, error);
          }
        }
      }
    },
  },
  STATE_TOPIC
);
