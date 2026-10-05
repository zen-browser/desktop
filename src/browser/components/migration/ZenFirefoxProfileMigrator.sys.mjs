/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";
import { MigratorBase } from "resource:///modules/MigratorBase.sys.mjs";
import { MigrationUtils } from "resource:///modules/MigrationUtils.sys.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  ContextualIdentityService:
    "moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs",
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
  Sqlite: "resource://gre/modules/Sqlite.sys.mjs",
  Subprocess: "resource://gre/modules/Subprocess.sys.mjs",
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
  clearTimeout: "resource://gre/modules/Timer.sys.mjs",
});

const TYPES = MigrationUtils.resourceTypes;
const CATEGORIES = [
  TYPES.BOOKMARKS,
  TYPES.HISTORY,
  TYPES.PASSWORDS,
  TYPES.COOKIES,
];
const MANUAL_PROFILE = "choose-firefox-profile-folder";
const MAX_JSON_BYTES = 32 * 1024 * 1024;

class ImportError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

function localFile(path) {
  const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  file.initWithPath(path);
  return file;
}

function rowsToObjects(rows, columns) {
  return rows.map(row => {
    const value = {};
    for (const name of columns) {
      value[name] = row.getResultByName(name);
    }
    return value;
  });
}

async function readJSON(path, compressed = false) {
  if ((await IOUtils.stat(path)).size > MAX_JSON_BYTES) {
    throw new ImportError("unsupported");
  }
  return IOUtils.readJSON(path, { decompress: compressed });
}

// Keep conflict keys structural: delimiter characters are valid in usernames.
export const FirefoxImportPolicies = Object.freeze({
  loginKey(login) {
    return JSON.stringify([
      login.origin ?? login.hostname,
      login.formActionOrigin ?? login.formSubmitURL ?? null,
      login.httpRealm ?? null,
      login.username,
    ]);
  },
  cookieGroup(host, attributes) {
    let site = host.replace(/^\./, "");
    try {
      site = Services.eTLD.getBaseDomainFromHost(site);
    } catch (_) {}
    return JSON.stringify([
      site.toLowerCase(),
      ChromeUtils.originAttributesToSuffix(attributes),
    ]);
  },
  validateProfile(path) {
    const source = localFile(path);
    source.normalize();
    const destination = Services.dirsvc.get("ProfD", Ci.nsIFile);
    destination.normalize();
    if (
      !source.isDirectory() ||
      !source.isReadable() ||
      source.equals(destination)
    ) {
      throw new ImportError("profile");
    }
    return source;
  },
  cookieExpiry(expiry, schemaVersion) {
    if (
      !Number.isSafeInteger(expiry) ||
      expiry <= 0 ||
      schemaVersion < 10 ||
      schemaVersion > 17
    ) {
      throw new ImportError("unsupported");
    }
    return schemaVersion <= 15 ? expiry * 1000 : expiry;
  },
});

export class ZenFirefoxProfileMigrator extends MigratorBase {
  static get key() {
    return "zen-firefox";
  }
  static get displayNameL10nID() {
    return "zen-firefox-import-browser-name";
  }
  static get brandImage() {
    return "chrome://browser/content/logos/share-firefox.svg";
  }

  #profiles = new Map();
  #context = null;
  #cancelled = false;
  #process = null;

  cancel() {
    this.#cancelled = true;
    this.#process?.kill();
  }

  #checkCancelled() {
    if (this.#cancelled) {
      throw new ImportError("cancelled");
    }
  }

  getProfileRoots() {
    const home = Services.dirsvc.get("Home", Ci.nsIFile).path;
    let roots;
    switch (AppConstants.platform) {
      case "macosx":
        roots = [
          PathUtils.join(home, "Library", "Application Support", "Firefox"),
        ];
        break;
      case "win":
        roots = [
          PathUtils.join(
            Services.dirsvc.get("AppData", Ci.nsIFile).path,
            "Mozilla",
            "Firefox"
          ),
        ];
        break;
      default:
        roots = [
          PathUtils.join(home, ".mozilla", "firefox"),
          PathUtils.join(home, ".config", "mozilla", "firefox"),
          PathUtils.join(
            home,
            "snap",
            "firefox",
            "common",
            ".mozilla",
            "firefox"
          ),
          PathUtils.join(
            home,
            ".var",
            "app",
            "org.mozilla.firefox",
            ".mozilla",
            "firefox"
          ),
        ];
    }
    return roots;
  }

  async getSourceProfiles() {
    this.#profiles.clear();
    for (const root of this.getProfileRoots()) {
      try {
        const ini = Cc["@mozilla.org/xpcom/ini-parser-factory;1"]
          .getService(Ci.nsIINIParserFactory)
          .createINIParser(localFile(PathUtils.join(root, "profiles.ini")));
        for (const section of ini.getSections()) {
          if (!section.startsWith("Profile")) {
            continue;
          }
          try {
            const path = ini.getString(section, "Path");
            const directory = FirefoxImportPolicies.validateProfile(
              ini.getString(section, "IsRelative") === "1"
                ? PathUtils.join(root, ...path.split(/[\\/]/))
                : path
            );
            this.#profiles.set(directory.path, {
              id: directory.path,
              name: ini.getString(section, "Name"),
            });
          } catch (_) {
            // One removed profile must not hide the other profiles in this registry.
          }
        }
      } catch (_) {
        // A missing or invalid registry must not hide the custom-folder option.
      }
    }
    const l10n = new Localization(["browser/migrationWizard.ftl"]);
    return [
      ...this.#profiles.values(),
      {
        id: MANUAL_PROFILE,
        name: await l10n.formatValue("zen-firefox-import-choose-folder"),
      },
    ];
  }

  async getResources(profile) {
    if (profile?.id !== MANUAL_PROFILE && !this.#profiles.has(profile?.id)) {
      return [];
    }
    const resources = [];
    for (const type of CATEGORIES) {
      let available = profile.id === MANUAL_PROFILE;
      if (!available) {
        let files = ["places.sqlite"];
        if (type === TYPES.PASSWORDS) {
          files = ["logins.json", "logins.db"];
        } else if (type === TYPES.COOKIES) {
          files = [
            "cookies.sqlite",
            "sessionstore.jsonlz4",
            "sessionstore-backups/recovery.jsonlz4",
          ];
        }
        for (const file of files) {
          available ||= await IOUtils.exists(
            PathUtils.join(profile.id, ...file.split("/"))
          );
        }
      }
      if (available) {
        resources.push({ type });
      }
    }
    return resources;
  }

  async #chooseProfile(profile) {
    if (profile?.id !== MANUAL_PROFILE) {
      if (!this.#profiles.has(profile?.id)) {
        throw new ImportError("profile");
      }
      return FirefoxImportPolicies.validateProfile(profile.id);
    }
    const picker = Cc["@mozilla.org/filepicker;1"].createInstance(
      Ci.nsIFilePicker
    );
    const l10n = new Localization(["browser/migrationWizard.ftl"]);
    picker.init(
      Services.wm.getMostRecentWindow("navigator:browser").browsingContext,
      await l10n.formatValue("zen-firefox-import-choose-folder"),
      Ci.nsIFilePicker.modeGetFolder
    );
    const result = await new Promise(resolve => picker.open(resolve));
    if (result !== Ci.nsIFilePicker.returnOK) {
      throw new ImportError("cancelled");
    }
    return FirefoxImportPolicies.validateProfile(picker.file.path);
  }

  async #snapshot(source, items) {
    let lock;
    try {
      lock = Cc["@mozilla.org/zen/common-utils;1"]
        .getService(Ci.nsIZenCommonUtils)
        .lockFirefoxProfile(source);
    } catch (_) {
      throw new ImportError("locked");
    }
    try {
      const directory = await IOUtils.createUniqueDirectory(
        PathUtils.tempDir,
        "zen-firefox-import",
        0o700
      );
      this.#context = { directory, files: new Set(), errors: new Map() };
      const groups = new Map([
        [TYPES.BOOKMARKS, ["places.sqlite", "places.sqlite-wal"]],
        [TYPES.HISTORY, ["places.sqlite", "places.sqlite-wal"]],
        [
          TYPES.PASSWORDS,
          [
            "prefs.js",
            "key4.db",
            "key4.db-wal",
            "cert9.db",
            "cert9.db-wal",
            "logins.json",
            "logins.db",
            "logins.db-wal",
          ],
        ],
        [
          TYPES.COOKIES,
          [
            "cookies.sqlite",
            "cookies.sqlite-wal",
            "containers.json",
            "sessionstore.jsonlz4",
            "sessionstore-backups/recovery.jsonlz4",
            "sessionstore-backups/recovery.baklz4",
            "sessionstore-backups/previous.jsonlz4",
          ],
        ],
      ]);
      for (const [type, files] of groups) {
        if (!(items & type)) {
          continue;
        }
        for (const relative of files) {
          this.#checkCancelled();
          if (this.#context.files.has(relative)) {
            continue;
          }
          const file = localFile(
            PathUtils.join(source.path, ...relative.split("/"))
          );
          try {
            if (!file.exists()) {
              continue;
            }
            if (file.isSymlink() || !file.isFile()) {
              throw new ImportError("profile");
            }
            const parent = file.parent;
            parent.normalize();
            if (!parent.equals(source) && !source.contains(parent)) {
              throw new ImportError("profile");
            }
            const target = PathUtils.join(directory, ...relative.split("/"));
            await IOUtils.makeDirectory(PathUtils.parent(target), {
              ignoreExisting: true,
              permissions: 0o700,
            });
            await IOUtils.copy(file.path, target);
            await IOUtils.setPermissions(target, 0o600);
            this.#context.files.add(relative);
          } catch (error) {
            this.#context.errors.set(
              type,
              error instanceof ImportError ? error.reason : "failed"
            );
          }
        }
      }
    } finally {
      lock.unlock();
    }
  }

  async migrate(items, _startup, profile, progress = () => {}) {
    if (this.#context) {
      throw new Error("Firefox import is already running");
    }
    this.#cancelled = false;
    const selected = CATEGORIES.filter(type => items & type);
    Services.obs.notifyObservers(null, "Migration:Started");
    let setupError;
    try {
      await this.#snapshot(await this.#chooseProfile(profile), items);
    } catch (error) {
      setupError = error instanceof ImportError ? error.reason : "profile";
    }
    try {
      for (const type of selected) {
        const result = {
          imported: 0,
          skipped: 0,
          reason: "complete",
          zenFirefoxImport: true,
        };
        Services.obs.notifyObservers(null, "Migration:ItemBeforeMigrate", type);
        try {
          this.#checkCancelled();
          const reason = setupError || this.#context.errors.get(type);
          if (reason) {
            throw new ImportError(reason);
          }
          if (type === TYPES.BOOKMARKS) {
            await this.#importBookmarks(result);
          }
          if (type === TYPES.HISTORY) {
            await this.#importHistory(result);
          }
          if (type === TYPES.PASSWORDS) {
            await this.#importPasswords(result);
          }
          if (type === TYPES.COOKIES) {
            await this.#importCookies(result);
          }
        } catch (error) {
          result.reason =
            error instanceof ImportError ? error.reason : "failed";
        }
        const success = result.reason === "complete";
        Services.obs.notifyObservers(
          null,
          success ? "Migration:ItemAfterMigrate" : "Migration:ItemError",
          type
        );
        await progress(type, success, result);
      }
    } finally {
      try {
        if (this.#context) {
          await IOUtils.remove(this.#context.directory, { recursive: true });
        }
      } finally {
        this.#context = null;
        Services.obs.notifyObservers(null, "Migration:Ended");
      }
    }
  }

  #path(file) {
    if (!this.#context.files.has(file)) {
      throw new ImportError("missing");
    }
    return PathUtils.join(this.#context.directory, ...file.split("/"));
  }

  async #withDatabase(file, operation) {
    const database = await lazy.Sqlite.openConnection({
      path: this.#path(file),
      readOnly: true,
    });
    try {
      return await operation(database);
    } finally {
      await database.close();
    }
  }

  async #importBookmarks(result) {
    const rows = await this.#withDatabase("places.sqlite", async database =>
      rowsToObjects(
        await database.execute(
          "SELECT b.id, b.parent, b.type, b.title, b.guid, p.url FROM moz_bookmarks b LEFT JOIN moz_places p ON b.fk = p.id ORDER BY b.position, b.id"
        ),
        ["id", "parent", "type", "title", "guid", "url"]
      )
    );
    const children = new Map();
    for (const row of rows) {
      if (!children.has(row.parent)) {
        children.set(row.parent, []);
      }
      children.get(row.parent).push(row);
    }
    const roots = new Map([
      ["toolbar_____", lazy.PlacesUtils.bookmarks.toolbarGuid],
      ["menu________", lazy.PlacesUtils.bookmarks.menuGuid],
      ["unfiled_____", lazy.PlacesUtils.bookmarks.unfiledGuid],
    ]);
    const visited = new Set();
    const walk = async (id, parentGuid, depth) => {
      if (depth > 100 || visited.has(id)) {
        throw new ImportError("unsupported");
      }
      visited.add(id);
      const existing = [];
      await lazy.PlacesUtils.bookmarks.fetch({ parentGuid }, value =>
        existing.push(value)
      );
      const matchedFolders = new Set();
      for (const row of children.get(id) || []) {
        this.#checkCancelled();
        if (
          ![1, 2].includes(row.type) ||
          (row.type === 1 && !this.#validURL(row.url, true))
        ) {
          result.skipped++;
          continue;
        }
        const match = existing.find(
          value =>
            value.type === row.type &&
            (row.type !== 2 || !matchedFolders.has(value.guid)) &&
            value.title === (row.title || "") &&
            (row.type === 2 || value.url?.href === row.url)
        );
        const bookmark =
          match ||
          (await MigrationUtils.insertBookmarkWrapper({
            parentGuid,
            type: row.type,
            title: row.title || "",
            ...(row.type === 1 ? { url: row.url } : {}),
          }));
        if (match) {
          result.skipped++;
        } else {
          result.imported++;
          existing.push(bookmark);
        }
        if (row.type === 2) {
          matchedFolders.add(bookmark.guid);
          await walk(row.id, bookmark.guid, depth + 1);
        }
      }
    };
    for (const [sourceGuid, targetGuid] of roots) {
      const root = rows.find(row => row.guid === sourceGuid);
      if (root) {
        await walk(root.id, targetGuid, 0);
      }
    }
    if (!rows.some(row => roots.has(row.guid))) {
      throw new ImportError("unsupported");
    }
  }

  #validURL(url, bookmark = false) {
    try {
      const schemes = ["http:", "https:", "ftp:", "file:"];
      if (bookmark) {
        schemes.push("about:", "data:", "javascript:");
      }
      return schemes.includes(new URL(url).protocol);
    } catch (_) {
      return false;
    }
  }

  async #importHistory(result) {
    const rows = await this.#withDatabase("places.sqlite", async database =>
      rowsToObjects(
        await database.execute(
          "SELECT p.url, p.title, v.visit_date, v.visit_type FROM moz_historyvisits v JOIN moz_places p ON v.place_id = p.id ORDER BY v.visit_date"
        ),
        ["url", "title", "visit_date", "visit_type"]
      )
    );
    const destination = await lazy.PlacesUtils.promiseDBConnection();
    for (const row of rows) {
      this.#checkCancelled();
      const date = new Date(row.visit_date / 1000);
      if (
        !this.#validURL(row.url) ||
        !Number.isSafeInteger(row.visit_date) ||
        date <= 0 ||
        date > Date.now() ||
        ![1, 2, 3, 5, 6, 7, 8, 9].includes(row.visit_type)
      ) {
        result.skipped++;
        continue;
      }
      const found = await destination.executeCached(
        "SELECT 1 FROM moz_historyvisits v JOIN moz_places p ON v.place_id = p.id WHERE p.url = :url AND v.visit_date = :date AND v.visit_type = :type LIMIT 1",
        { url: row.url, date: date.getTime() * 1000, type: row.visit_type }
      );
      if (found.length) {
        result.skipped++;
        continue;
      }
      await MigrationUtils.insertVisitsWrapper([
        {
          url: row.url,
          title: row.title || "",
          visits: [{ date, transition: row.visit_type }],
        },
      ]);
      result.imported++;
    }
  }

  async #decrypt(fields, password) {
    this.#checkCancelled();
    const binary = Services.dirsvc.get("GreBinD", Ci.nsIFile);
    binary.append(
      "zen-firefox-password-import" +
        (AppConstants.platform === "win" ? ".exe" : "")
    );
    const process = await lazy.Subprocess.call({
      command: binary.path,
      arguments: [this.#context.directory],
    });
    this.#process = process;
    const timer = lazy.setTimeout(() => process.kill(), 120000);
    const readOutput = async () => {
      let output = "";
      for (;;) {
        const chunk = await process.stdout.readString();
        if (!chunk) {
          break;
        }
        output += chunk;
        if (output.length > MAX_JSON_BYTES * 4) {
          process.kill();
          throw new ImportError("unsupported");
        }
      }
      return output;
    };
    try {
      const bytes = new TextEncoder().encode(password);
      const encoded = ChromeUtils.base64URLEncode(bytes, { pad: true })
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      bytes.fill(0);
      if (encoded.length > 131070) {
        throw new ImportError("unsupported");
      }
      await process.stdin.write(encoded + "\n");
      try {
        if ((await process.stdout.readString(6)) !== "READY\n") {
          throw new ImportError("failed");
        }
      } catch (_) {
        const { exitCode } = await process.wait();
        this.#checkCancelled();
        throw new ImportError(exitCode === 3 ? "password" : "failed");
      }
      const outputPromise = readOutput();
      // Drain stdout while writing stdin, so neither pipe can block the helper.
      outputPromise.catch(() => {});
      for (const field of fields) {
        this.#checkCancelled();
        if (
          typeof field !== "string" ||
          field.length > 131070 ||
          /[\r\n]/.test(field)
        ) {
          throw new ImportError("unsupported");
        }
        await process.stdin.write(field + "\n");
      }
      await process.stdin.close();
      const { exitCode } = await process.wait();
      const output = await outputPromise;
      this.#checkCancelled();
      if (exitCode === 3) {
        throw new ImportError("password");
      }
      if (exitCode !== 0) {
        throw new ImportError("failed");
      }
      const values = output.endsWith("\n")
        ? output.slice(0, -1).split("\n")
        : [];
      if (values.length !== fields.length) {
        throw new ImportError("failed");
      }
      return values.map(value => {
        try {
          return value === "!"
            ? null
            : new TextDecoder("utf-8", { fatal: true }).decode(
                Uint8Array.from(atob(value), character =>
                  character.charCodeAt(0)
                )
              );
        } catch (_) {
          return null;
        }
      });
    } finally {
      lazy.clearTimeout(timer);
      process.kill();
      await process.wait();
      this.#process = null;
    }
  }

  async #readPasswordRecords() {
    if (
      !this.#context.files.has("key4.db") &&
      (this.#context.files.has("logins.json") ||
        this.#context.files.has("logins.db"))
    ) {
      throw new ImportError("unsupported");
    }
    this.#path("key4.db");
    let rust =
      this.#context.files.has("logins.db") &&
      !this.#context.files.has("logins.json");
    if (this.#context.files.has("prefs.js")) {
      const prefs = await IOUtils.readUTF8(this.#path("prefs.js"));
      const setting = Array.from(
        prefs.matchAll(
          /user_pref\("signon\.storage\.rust\.active",\s*(true|false)\s*\)/g
        )
      ).at(-1);
      if (setting) {
        rust = setting[1] === "true";
      }
    }
    let records;
    let fields;
    if (rust) {
      records = await this.#withDatabase("logins.db", async database => {
        if ((await database.getSchemaVersion()) !== 5) {
          throw new ImportError("unsupported");
        }
        const columns = [
          "secFields",
          "origin",
          "httpRealm",
          "formActionOrigin",
          "usernameField",
          "passwordField",
          "timeCreated",
          "timeLastUsed",
          "timePasswordChanged",
          "timesUsed",
        ];
        return rowsToObjects(
          await database.execute(
            `SELECT ${columns.join(",")} FROM loginsL WHERE is_deleted = 0 UNION ALL SELECT ${columns.join(",")} FROM loginsM WHERE is_overridden = 0`
          ),
          columns
        );
      });
      fields = records.map(record => {
        const parts = record.secFields.split(".");
        const header = JSON.parse(
          new TextDecoder().decode(
            ChromeUtils.base64URLDecode(parts[0], { padding: "reject" })
          )
        );
        if (
          parts.length !== 5 ||
          header.alg !== "dir" ||
          header.enc !== "A256GCM"
        ) {
          throw new ImportError("unsupported");
        }
        return "G:" + record.secFields;
      });
    } else {
      const data = await readJSON(this.#path("logins.json"));
      if (!Array.isArray(data.logins) || ![1, 2, 3].includes(data.version)) {
        throw new ImportError("unsupported");
      }
      records = data.logins;
      fields = records.flatMap(record => [
        record.encryptedUsername,
        record.encryptedPassword,
      ]);
    }
    return { rust, records, fields };
  }

  async #decryptPasswordRecords(fields) {
    let decrypted;
    try {
      decrypted = await this.#decrypt(fields, "");
    } catch (error) {
      if (error.reason !== "password") {
        throw error;
      }
      const l10n = new Localization(["browser/migrationWizard.ftl"]);
      const password = { value: "" };
      if (
        !Services.prompt.promptPassword(
          Services.wm.getMostRecentWindow("navigator:browser"),
          await l10n.formatValue("zen-firefox-import-password-title"),
          await l10n.formatValue("zen-firefox-import-password-prompt"),
          password,
          null,
          {}
        )
      ) {
        throw new ImportError("cancelled");
      }
      try {
        decrypted = await this.#decrypt(fields, password.value);
      } finally {
        password.value = "";
      }
    }
    return decrypted;
  }

  async #importPasswords(result) {
    const { rust, records, fields } = await this.#readPasswordRecords();
    if (!records.length) {
      return;
    }
    const decrypted = await this.#decryptPasswordRecords(fields);
    const keys = new Set(
      (await Services.logins.getAllLogins()).map(FirefoxImportPolicies.loginKey)
    );
    for (let i = 0; i < records.length; ++i) {
      this.#checkCancelled();
      const record = records[i];
      let secrets;
      try {
        if (rust) {
          secrets = decrypted[i] === null ? null : JSON.parse(decrypted[i]);
        } else {
          secrets = {
            username: decrypted[2 * i],
            password: decrypted[2 * i + 1],
          };
        }
        if (rust && secrets) {
          // Firefox's encrypted database uses compact field names.
          secrets = { username: secrets.u, password: secrets.p };
        }
      } catch (_) {
        result.skipped++;
        continue;
      }
      if (await this.#importPassword(record, secrets, keys)) {
        result.imported++;
      } else {
        result.skipped++;
      }
    }
    decrypted.fill(null);
  }

  async #importPassword(record, secrets, keys) {
    if (
      !secrets ||
      typeof secrets.username !== "string" ||
      typeof secrets.password !== "string" ||
      !secrets.password
    ) {
      return false;
    }
    const login = {
      origin: record.origin ?? record.hostname,
      formActionOrigin: record.formActionOrigin ?? record.formSubmitURL ?? null,
      httpRealm: record.httpRealm ?? null,
      username: secrets.username,
      password: secrets.password,
      usernameField: record.usernameField || "",
      passwordField: record.passwordField || "",
      timeCreated: record.timeCreated,
      timeLastUsed: record.timeLastUsed,
      timePasswordChanged: record.timePasswordChanged,
      timesUsed: record.timesUsed,
    };
    const key = FirefoxImportPolicies.loginKey(login);
    if (
      !this.#validURL(login.origin) ||
      keys.has(key) ||
      (login.httpRealm !== null && login.formActionOrigin !== null) ||
      (login.httpRealm === null && login.formActionOrigin === null) ||
      (login.formActionOrigin && !this.#validURL(login.formActionOrigin))
    ) {
      return false;
    }
    // Recheck immediately before insertion. Never pass the source GUID or overwrite a Zen login.
    const existing = await Services.logins.searchLoginsAsync({
      origin: login.origin,
      formActionOrigin: login.formActionOrigin,
      httpRealm: login.httpRealm,
    });
    if (existing.some(value => FirefoxImportPolicies.loginKey(value) === key)) {
      return false;
    }
    const info = Cc["@mozilla.org/login-manager/loginInfo;1"].createInstance(
      Ci.nsILoginInfo
    );
    info.init(
      login.origin,
      login.formActionOrigin,
      login.httpRealm,
      login.username,
      login.password,
      login.usernameField,
      login.passwordField
    );
    this.#setLoginMetadata(info, login);
    await Services.logins.addLoginAsync(info);
    keys.add(key);
    return true;
  }

  #setLoginMetadata(info, login) {
    info.QueryInterface(Ci.nsILoginMetaInfo);
    for (const property of [
      "timeCreated",
      "timeLastUsed",
      "timePasswordChanged",
      "timesUsed",
    ]) {
      if (Number.isSafeInteger(login[property]) && login[property] >= 0) {
        info[property] = login[property];
      }
    }
  }

  async #readPersistentCookies(result) {
    let cookies = [];
    if (this.#context.files.has("cookies.sqlite")) {
      cookies = await this.#withDatabase("cookies.sqlite", async database => {
        const version = await database.getSchemaVersion();
        if (version < 10 || version > 17) {
          throw new ImportError("unsupported");
        }
        const columns = (
          await database.execute("PRAGMA table_info(moz_cookies)")
        ).map(row => row.getResultByName("name"));
        const rows = rowsToObjects(
          await database.execute("SELECT * FROM moz_cookies"),
          columns
        );
        const valid = [];
        for (const cookie of rows) {
          try {
            const suffix = cookie.originAttributes || "";
            if (
              typeof suffix !== "string" ||
              (suffix && !suffix.startsWith("^"))
            ) {
              throw new ImportError("unsupported");
            }
            const attributes = ChromeUtils.createOriginAttributesFromOrigin(
              "https://example.com" + suffix
            );
            for (const field of suffix.slice(1).split("&")) {
              if (
                field &&
                !Object.hasOwn(
                  attributes,
                  decodeURIComponent(field.split("=")[0])
                )
              ) {
                throw new ImportError("unsupported");
              }
            }
            valid.push({
              ...cookie,
              expiry: FirefoxImportPolicies.cookieExpiry(
                cookie.expiry,
                version
              ),
              secure: !!cookie.isSecure,
              httponly: !!cookie.isHttpOnly,
              originAttributes: attributes,
              sameSite:
                version <= 14 &&
                cookie.sameSite === Ci.nsICookie.SAMESITE_LAX &&
                cookie.rawSameSite === Ci.nsICookie.SAMESITE_NONE
                  ? Ci.nsICookie.SAMESITE_UNSET
                  : cookie.sameSite,
              session: false,
            });
          } catch (_) {
            result.skipped++;
          }
        }
        return valid;
      });
    }
    return cookies;
  }

  async #readSessionCookies() {
    const sessionFile = [
      "sessionstore.jsonlz4",
      "sessionstore-backups/recovery.jsonlz4",
      "sessionstore-backups/recovery.baklz4",
      "sessionstore-backups/previous.jsonlz4",
    ].find(file => this.#context.files.has(file));
    if (sessionFile) {
      const state = await readJSON(this.#path(sessionFile), true);
      if (state.cookies && !Array.isArray(state.cookies)) {
        throw new ImportError("unsupported");
      }
      return (state.cookies || []).map(cookie => {
        let expiry = cookie.expiry;
        if (expiry === undefined) {
          expiry = Date.now() + 400 * 86400000;
        } else if (expiry < 100000000000) {
          expiry *= 1000;
        }
        return {
          ...cookie,
          session: true,
          expiry,
          originAttributes: cookie.originAttributes || {},
        };
      });
    }
    if (!this.#context.files.has("cookies.sqlite")) {
      throw new ImportError("missing");
    }
    return [];
  }

  #validCookie(cookie) {
    if (
      !cookie.originAttributes ||
      typeof cookie.originAttributes !== "object" ||
      Array.isArray(cookie.originAttributes)
    ) {
      return false;
    }
    const attributes = cookie.originAttributes;
    if (
      attributes.privateBrowsingId ||
      cookie.expiry <= Date.now() ||
      !Number.isSafeInteger(cookie.expiry) ||
      typeof cookie.host !== "string" ||
      typeof cookie.value !== "string" ||
      typeof cookie.name !== "string" ||
      typeof cookie.path !== "string" ||
      !cookie.path.startsWith("/") ||
      (attributes.userContextId !== undefined &&
        (!Number.isInteger(attributes.userContextId) ||
          attributes.userContextId < 0)) ||
      (attributes.partitionKey !== undefined &&
        typeof attributes.partitionKey !== "string") ||
      (cookie.sameSite !== undefined && ![0, 1, 2, 3].includes(cookie.sameSite))
    ) {
      return false;
    }
    return true;
  }

  #mapContainer(sourceId, identities) {
    const source = identities.find(
      identity => identity.userContextId === sourceId
    );
    if (!source) {
      return null;
    }
    const aliases = {
      "userContextPersonal.label": "user-context-personal",
      "userContextWork.label": "user-context-work",
      "userContextBanking.label": "user-context-banking",
      "userContextShopping.label": "user-context-shopping",
    };
    const sourceLabel = aliases[source.l10nID] || source.l10nId;
    const publicIdentities =
      lazy.ContextualIdentityService.getPublicIdentities();
    const defaultIdentity =
      !source.name && sourceLabel
        ? publicIdentities.find(identity => identity.l10nId === sourceLabel)
        : null;
    const name =
      source.name ||
      (defaultIdentity &&
        lazy.ContextualIdentityService.getUserContextLabel(
          defaultIdentity.userContextId
        ));
    if (!name) {
      return null;
    }
    const existing = publicIdentities.find(
      identity =>
        (identity.name ||
          lazy.ContextualIdentityService.getUserContextLabel(
            identity.userContextId
          )) === name &&
        identity.icon === source.icon &&
        identity.color === source.color
    );
    const target =
      existing ||
      lazy.ContextualIdentityService.create(name, source.icon, source.color);
    return target;
  }

  async #importCookies(result) {
    const cookies = [
      ...(await this.#readPersistentCookies(result)),
      ...(await this.#readSessionCookies()),
    ];
    let identities = [];
    if (this.#context.files.has("containers.json")) {
      const data = await readJSON(this.#path("containers.json"));
      if (!Array.isArray(data.identities)) {
        throw new ImportError("unsupported");
      }
      identities = data.identities.filter(identity => identity.public);
    }
    const mappings = new Map([[0, 0]]);
    const occupied = new Set(
      Array.from(Services.cookies.cookies, cookie =>
        FirefoxImportPolicies.cookieGroup(cookie.host, cookie.originAttributes)
      )
    );
    const seen = new Set();
    for (const cookie of cookies) {
      this.#checkCancelled();
      if (!this.#validCookie(cookie)) {
        result.skipped++;
        continue;
      }
      const attributes = { ...cookie.originAttributes };
      const sourceId = attributes.userContextId || 0;
      if (!mappings.has(sourceId)) {
        const target = this.#mapContainer(sourceId, identities);
        if (!target) {
          result.skipped++;
          continue;
        }
        mappings.set(sourceId, target.userContextId);
      }
      attributes.userContextId = mappings.get(sourceId);
      const group = FirefoxImportPolicies.cookieGroup(cookie.host, attributes);
      const key = JSON.stringify([
        group,
        cookie.host,
        cookie.path,
        cookie.name,
      ]);
      if (occupied.has(group) || seen.has(key)) {
        result.skipped++;
        continue;
      }
      // A website may have changed its cookies while other categories imported.
      if (
        Array.from(Services.cookies.cookies).some(
          value =>
            FirefoxImportPolicies.cookieGroup(
              value.host,
              value.originAttributes
            ) === group &&
            !seen.has(
              JSON.stringify([group, value.host, value.path, value.name])
            )
        )
      ) {
        occupied.add(group);
        result.skipped++;
        continue;
      }
      let validation;
      try {
        validation = Services.cookies.add(
          cookie.host,
          cookie.path,
          cookie.name,
          cookie.value,
          !!cookie.secure,
          !!cookie.httponly,
          !!cookie.session,
          cookie.expiry,
          attributes,
          cookie.sameSite ?? Ci.nsICookie.SAMESITE_NONE,
          cookie.schemeMap ??
            (cookie.session
              ? Ci.nsICookie.SCHEME_HTTPS
              : Ci.nsICookie.SCHEME_UNSET),
          !!cookie.isPartitioned || !!attributes.partitionKey
        );
      } catch (_) {
        result.skipped++;
        continue;
      }
      if (validation.result !== Ci.nsICookieValidation.eOK) {
        result.skipped++;
        continue;
      }
      seen.add(key);
      result.imported++;
    }
  }
}
