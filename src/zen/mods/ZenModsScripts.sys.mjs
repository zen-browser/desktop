// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import {
  encodePath,
  listModFiles,
} from "resource:///modules/zen/mods/ZenModsFiles.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenModAPI: "resource:///modules/zen/mods/ZenModAPI.sys.mjs",
});

ChromeUtils.defineLazyGetter(lazy, "resProtocol", () =>
  Services.io
    .getProtocolHandler("resource")
    .QueryInterface(Ci.nsIResProtocolHandler)
);

const SCRIPT_HOST_PREFIX = "zen-mod-";
const SCRIPT_FILE_RE = /\.m?js$/;
const MAX_SCRIPT_FILES = 200;
const SCRIPT_SOURCES = new Set(["local", "github"]);
const MAIN_WINDOW_URL = "chrome://browser/content/browser.xhtml";
const REGEXP_SPECIAL_RE = /[.+?^${}()|[\]\\]/g;

/**
 * @param {string[]} patterns - URLs where `*` matches anything, or "main"
 * for the browser window
 * @returns {RegExp|null}
 */
function urlPatterns(patterns) {
  const sources = patterns.map(pattern =>
    (pattern === "main" ? MAIN_WINDOW_URL : pattern)
      .replace(REGEXP_SPECIAL_RE, "\\$&")
      .replaceAll("*", ".*")
  );

  return sources.length ? new RegExp(`^(?:${sources.join("|")})$`) : null;
}

/**
 * @param {object} mod - An entry of the registry
 * @returns {object[]} The scripts the mod may run, as `normalizeScripts`
 * lists them. Only mods from outside the store run any.
 */
export function declaredScripts(mod) {
  if (!SCRIPT_SOURCES.has(mod?.source) || !Array.isArray(mod.scripts)) {
    return [];
  }

  // Mods added before scripts had options list plain paths.
  return mod.scripts.map(script =>
    typeof script === "string" ? { path: script, kind: "module" } : script
  );
}

/**
 * Hashes every script file in a mod's folder, the ones its scripts import
 * included, so any change gives the scripts a new resource host.
 *
 * @param {string} modId
 * @param {string} folder
 * @returns {Promise<string>} A hex SHA-256
 */
export async function hashScripts(modId, folder) {
  const files = await listModFiles(folder, SCRIPT_FILE_RE, MAX_SCRIPT_FILES);
  const encoder = new TextEncoder();
  const chunks = [encoder.encode(modId)];

  for (const { path } of files) {
    chunks.push(
      encoder.encode(`\0${path.slice(folder.length)}\0`),
      await IOUtils.read(path)
    );
  }

  const bytes = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.length, 0)
  );
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

/**
 * Runs the scripts of Zen Mods: modules with `init` and `uninit` in each
 * window, and `.uc.js` and `.uc.mjs` scripts in the documents they're meant
 * for. The mods manager says which mods' scripts should run.
 */
export class ZenModsScripts {
  /** @type {Map<string, object>} The manager's, where script failures go */
  #errors;

  /** @type {(modId: string) => object|undefined} */
  #getMod;

  /** @type {(modId: string) => string} */
  #getModFolder;

  /** @type {() => void} */
  #notifyChanged;

  /**
   * The scripts that run right now: each version of a mod's scripts is
   * imported from a resource host of its own, so a changed file, or a file
   * it imports, is never served from the module registry.
   *
   * @type {Map<string, {hash: string, host: string, modules: object[]}>}
   */
  #scripts = new Map();

  /**
   * What each window started, so it can undo it even after the mod is gone.
   *
   * @type {WeakMap<Window, Map<string, {hash: string, modules: object[], api: object}>>}
   */
  #windowScripts = new WeakMap();

  /**
   * The resource hosts whose scripts ran somewhere they couldn't be undone:
   * `.uc.js` and `.uc.mjs` in a document, or a module without `uninit` in a
   * window that stopped it. Nothing takes those back but a restart.
   *
   * @type {Map<string, Set<string>>}
   */
  #ranHosts = new Map();

  /** @type {WeakMap<Document, Set<string>>} The scripts each document ran */
  #documentScripts = new WeakMap();

  /**
   * The `zen` each mod's document scripts got in each document.
   *
   * @type {WeakMap<Document, Map<string, object>>}
   */
  #documentAPIs = new WeakMap();

  #isWatchingDocuments = false;

  /**
   * @param {object} manager - What the scripts need from the mods manager
   * @param {Map<string, object>} manager.errors - Why each mod doesn't apply
   * as it should
   * @param {(modId: string) => object|undefined} manager.getMod - A mod of
   * the registry
   * @param {(modId: string) => string} manager.getModFolder - Where a mod's
   * files are
   * @param {() => void} manager.notifyChanged - Tells windows that mods
   * changed
   */
  constructor({ errors, getMod, getModFolder, notifyChanged }) {
    this.#errors = errors;
    this.#getMod = getMod;
    this.#getModFolder = getModFolder;
    this.#notifyChanged = notifyChanged;
  }

  /**
   * @param {string} modId
   * @returns {boolean} Whether the mod's scripts are loaded
   */
  isRunning(modId) {
    return this.#scripts.has(modId);
  }

  /**
   * @param {string} modId
   * @returns {boolean} Whether another version of the mod's scripts than the
   * loaded one ran where it can't be undone
   */
  needsRestart(modId) {
    const host = this.#scripts.get(modId)?.host;

    return [...(this.#ranHosts.get(modId) ?? [])].some(
      ranHost => ranHost !== host
    );
  }

  /**
   * Imports the scripts of the given mods, and forgets the ones that
   * shouldn't run anymore.
   *
   * @param {object[]} wanted - The mods whose scripts should run, in the
   * order they load
   */
  async load(wanted) {
    const wantedIds = new Set(wanted.map(mod => mod.id));

    for (const [modId, loaded] of this.#scripts) {
      if (!wantedIds.has(modId)) {
        this.#forgetScripts(modId, loaded);
        this.#scripts.delete(modId);
      }
    }

    for (const mod of wanted) {
      const folder = this.#getModFolder(mod.id);
      const loaded = this.#scripts.get(mod.id);
      let host = null;

      try {
        const hash = await hashScripts(mod.id, folder);

        if (loaded?.hash === hash) {
          continue;
        }

        if (mod.source === "github" && hash !== mod.approvedScriptsHash) {
          throw new Error("The scripts changed since they were allowed.");
        }

        const directory = Cc["@mozilla.org/file/local;1"].createInstance(
          Ci.nsIFile
        );

        directory.initWithPath(folder);
        host = `${SCRIPT_HOST_PREFIX}${hash.slice(0, 16)}`;
        lazy.resProtocol.setSubstitution(
          host,
          Services.io.newFileURI(directory)
        );

        const scripts = declaredScripts(mod).map(script => ({
          ...script,
          url: `resource://${host}/${encodePath(script.path)}`,
        }));
        const modules = scripts
          .filter(({ kind }) => kind === "module")
          .map(({ url }) => ChromeUtils.importESModule(url));
        const documentScripts = scripts
          .filter(({ kind }) => kind !== "module")
          .map(script => ({
            ...script,
            include: urlPatterns(script.include),
            exclude: urlPatterns(script.exclude),
          }));

        if (loaded) {
          this.#forgetScripts(mod.id, loaded);
        }

        this.#scripts.set(mod.id, { hash, host, modules, documentScripts });

        if (this.#errors.get(mod.id)?.type === "script-failed") {
          this.#errors.delete(mod.id);
        }

        if (documentScripts.length) {
          this.#runInOpenDocuments();
        }
      } catch (error) {
        console.error(
          `[ZenMods]: Could not load the scripts of ${mod.name} (${mod.id}):`,
          error
        );

        // A version that loaded before keeps running.
        if (host && host !== loaded?.host) {
          lazy.resProtocol.setSubstitution(host, null);
        }

        this.#errors.set(mod.id, {
          type: "script-failed",
          message: String(error?.message ?? error),
        });
      }
    }
  }

  /**
   * Starts in a window the scripts that should run and stops the ones that
   * shouldn't anymore. Windows call it when they open and on every change.
   *
   * @param {Window} win
   */
  sync(win) {
    let started = this.#windowScripts.get(win);
    let changed = false;

    if (!started) {
      started = new Map();
      this.#windowScripts.set(win, started);
    }

    for (const [modId, previous] of started) {
      if (
        previous.isStuck ||
        this.#scripts.get(modId)?.hash === previous.hash
      ) {
        continue;
      }

      // A mod stops whole or not at all: stopping the modules that can
      // would leave it half running, and starting it again would start
      // twice the ones that can't.
      const canStop = previous.modules.every(
        module => typeof module.uninit === "function"
      );

      if (canStop && this.#runHook(modId, previous.modules, "uninit", win)) {
        previous.api.dispose();
        started.delete(modId);
        continue;
      }

      // What it did stays in this window, so it isn't started here again,
      // not even a newer version, until a restart.
      previous.isStuck = true;
      this.#markRan(modId, previous.host);
      changed = true;
    }

    for (const [modId, { hash, host, modules }] of this.#scripts) {
      if (started.has(modId) || !modules.length) {
        continue;
      }

      const mod = this.#getMod(modId);
      const api = new lazy.ZenModAPI(
        win,
        { id: modId, name: mod.name, version: mod.version },
        error => this.#reportScriptError(modId, error)
      );

      changed ||= !this.#runHook(modId, modules, "init", win, api);
      started.set(modId, { hash, host, modules, api, isStuck: false });
    }

    if (changed) {
      // Not from inside the observers that called us.
      Promise.resolve().then(() => this.#notifyChanged());
    }
  }

  /**
   * Stops the scripts a closing window started.
   *
   * @param {Window} win
   */
  forgetWindow(win) {
    for (const [modId, { modules, api }] of this.#windowScripts.get(win) ??
      []) {
      this.#runHook(modId, modules, "uninit", win);
      api.dispose();
    }

    this.#windowScripts.delete(win);
  }

  /**
   * Calls `init` or `uninit` of a mod's modules for a window. A script that
   * throws can't break the window or the other mods.
   *
   * @param {string} modId
   * @param {object[]} modules
   * @param {"init"|"uninit"} hook
   * @param {Window} win
   * @param {object} [api] - What `init` gets from Zen for this window
   * @returns {boolean} Whether every module had the hook and it went well
   */
  #runHook(modId, modules, hook, win, api) {
    let complete = true;

    for (const module of modules) {
      if (typeof module[hook] !== "function") {
        // Without init a module just has nothing to do per window.
        complete = complete && hook === "init";
        continue;
      }

      try {
        const result = module[hook](win, api);

        // An async init reports its failure when it comes.
        if (typeof result?.catch === "function") {
          result.catch(error => this.#reportScriptError(modId, error));
        }
      } catch (error) {
        console.error(`[ZenMods]: ${hook} of ${modId} failed:`, error);

        complete = false;
        this.#errors.set(modId, {
          type: "script-failed",
          message: String(error?.message ?? error),
        });
      }
    }

    return complete;
  }

  /**
   * Marks a mod whose script failed after it started, and tells the UI.
   *
   * @param {string} modId
   * @param {*} error
   */
  #reportScriptError(modId, error) {
    console.error(`[ZenMods]: A script of ${modId} failed:`, error);

    this.#errors.set(modId, {
      type: "script-failed",
      message: String(error?.message ?? error),
    });
    this.#notifyChanged();
  }

  /**
   * @param {string} modId
   * @param {string} host - A resource host of the mod's scripts whose code
   * keeps running until a restart
   */
  #markRan(modId, host) {
    if (!this.#ranHosts.has(modId)) {
      this.#ranHosts.set(modId, new Set());
    }

    this.#ranHosts.get(modId).add(host);
  }

  /**
   * Stops a mod's scripts from reaching more documents. The resource host
   * stays while code that ran from it may still import its files.
   *
   * @param {string} modId
   * @param {{host: string}} loaded
   */
  #forgetScripts(modId, { host }) {
    if (!this.#ranHosts.get(modId)?.has(host)) {
      lazy.resProtocol.setSubstitution(host, null);
    }
  }

  /**
   * @param {string} url - A document's URL
   * @returns {{modId: string, host: string, script: object}[]} The `.uc.js`
   * and `.uc.mjs` scripts meant for it, in the order they load
   */
  #documentScriptsFor(url) {
    const matching = [];

    for (const [modId, { host, documentScripts }] of this.#scripts) {
      for (const script of documentScripts) {
        if (script.include?.test(url) && !script.exclude?.test(url)) {
          matching.push({ modId, host, script });
        }
      }
    }

    return matching.sort(
      (first, second) => first.script.loadOrder - second.script.loadOrder
    );
  }

  /**
   * Runs `.uc.js` and `.uc.mjs` scripts the way userChrome.js loaders do:
   * once a document they're meant for is parsed, classic scripts in its
   * global and modules in its own module map. A script that throws can't
   * stop the others.
   *
   * @param {Document} doc
   */
  #runDocumentScripts(doc) {
    let ran = this.#documentScripts.get(doc);
    let failed = false;

    if (!ran) {
      ran = new Set();
      this.#documentScripts.set(doc, ran);
    }

    this.#exposeAPI(doc);

    for (const { modId, host, script } of this.#documentScriptsFor(doc.URL)) {
      if (ran.has(script.url)) {
        continue;
      }

      ran.add(script.url);

      this.#markRan(modId, host);

      try {
        if (script.kind === "uc.js") {
          Services.scriptloader.loadSubScriptWithOptions(script.url, {
            target: doc.documentGlobal,
            ignoreCache: true,
          });
        } else {
          doc.documentGlobal.ChromeUtils.importESModule(script.url, {
            global: "current",
          });
        }
      } catch (error) {
        console.error(
          `[ZenMods]: ${script.path} of ${modId} failed in ${doc.URL}:`,
          error
        );

        failed = true;
        this.#errors.set(modId, {
          type: "script-failed",
          message: String(error?.message ?? error),
        });
      }
    }

    if (failed) {
      this.#notifyChanged();
    }
  }

  /**
   * Gives `.uc.js` and `.uc.mjs` scripts what modules get in `init`: they
   * run in the window's own global, where nothing can be passed to them, so
   * the global `zen` hands each one its mod's, told apart by the file of the
   * script that reads it. Anyone else reads undefined. A frame that
   * navigates gets a new global, so it's per document.
   *
   * @param {Document} doc
   */
  #exposeAPI(doc) {
    if (this.#documentAPIs.has(doc)) {
      return;
    }

    const win = doc.documentGlobal;
    const apis = new Map();

    this.#documentAPIs.set(doc, apis);
    win.addEventListener(
      "unload",
      () => {
        for (const api of apis.values()) {
          api.dispose();
        }
      },
      { once: true }
    );
    Object.defineProperty(win, "zen", {
      configurable: true,
      get: () => {
        const file = Components.stack.caller?.filename?.split(" ")[0];
        const host = file && URL.parse(file)?.host;
        const modId = [...this.#ranHosts].find(([, hosts]) =>
          hosts.has(host)
        )?.[0];

        if (!modId) {
          return undefined;
        }

        if (!apis.has(modId)) {
          const { name = "", version = "" } = this.#getMod(modId) ?? {};

          apis.set(
            modId,
            new lazy.ZenModAPI(win, { id: modId, name, version }, error =>
              this.#reportScriptError(modId, error)
            )
          );
        }

        return apis.get(modId);
      },
    });
  }

  /**
   * Runs document scripts in the documents already open, and in every one
   * parsed from now on.
   */
  #runInOpenDocuments() {
    const runWhenParsed = doc => {
      if (doc.readyState === "loading") {
        doc.addEventListener(
          "DOMContentLoaded",
          () => this.#runDocumentScripts(doc),
          { once: true }
        );
      } else {
        this.#runDocumentScripts(doc);
      }
    };

    if (!this.#isWatchingDocuments) {
      this.#isWatchingDocuments = true;
      Services.obs.addObserver(doc => {
        if (
          doc.nodePrincipal?.isSystemPrincipal &&
          doc.URL !== "about:blank" &&
          this.#documentScriptsFor(doc.URL).length
        ) {
          runWhenParsed(doc);
        }
      }, "document-element-inserted");
    }

    for (const win of Services.wm.getEnumerator(null)) {
      runWhenParsed(win.document);
    }
  }
}
