/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Thin Astra Migration Center over MigrationUtils.
 *
 * Launch-safe ownership:
 * - Astra UI: destination choice, privacy copy, open native wizard / create profile
 * - Native Migration Wizard: browser, source profile, resources, progress, results
 *
 * Never parses browser databases, decrypts passwords, or copies profile folders.
 */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  MigrationUtils: "resource:///modules/MigrationUtils.sys.mjs",
  // SelectableProfileService is a module singleton, NOT a browser-window global.
  // It must be reached through the canonical Firefox module URL.
  SelectableProfileService:
    "resource:///modules/profiles/SelectableProfileService.sys.mjs",
});

const PANEL_ID = "PanelUI-astra-migration";
const LOG = "[AstraMigration]";

/** Resource type bit → stable enum (for tests / future display). */
export const RESOURCE_ENUM = Object.freeze({
  BOOKMARKS: "bookmarks",
  HISTORY: "history",
  PASSWORDS: "passwords",
  FORMDATA: "formdata",
  PAYMENT_METHODS: "payment_methods",
  COOKIES: "cookies",
  SESSION: "session",
  EXTENSIONS: "extensions",
  OTHERDATA: "otherdata",
});

const RESOURCE_BIT_NAMES = [
  "BOOKMARKS",
  "HISTORY",
  "PASSWORDS",
  "FORMDATA",
  "PAYMENT_METHODS",
  "COOKIES",
  "SESSION",
  "EXTENSIONS",
  "OTHERDATA",
];

/**
 * Sanitize log detail — never log paths, names, URLs, credentials, or profile IDs.
 */
export function sanitizeMigrationLogDetail(detail = {}) {
  const out = {};
  if (typeof detail.migratorKey === "string") {
    out.migratorKey = detail.migratorKey;
  }
  if (Array.isArray(detail.resources)) {
    out.resources = detail.resources.filter(r => typeof r === "string");
  }
  if (typeof detail.errorCategory === "string") {
    out.errorCategory = detail.errorCategory;
  }
  if (typeof detail.successCount === "number") {
    out.successCount = detail.successCount;
  }
  if (typeof detail.failureCount === "number") {
    out.failureCount = detail.failureCount;
  }
  if (typeof detail.destination === "string") {
    out.destination = detail.destination;
  }
  return out;
}

function safeLog(category, detail = {}) {
  try {
    console.info(LOG, category, sanitizeMigrationLogDetail(detail));
  } catch {
    // ignore
  }
}

/** Pure: decode MigrationUtils resource bitfield. Unknown bits ignored. */
export function resourceTypesFromBitfield(bits, resourceTypes = null) {
  const types = resourceTypes || {};
  const out = [];
  const n = Number(bits) || 0;
  for (const name of RESOURCE_BIT_NAMES) {
    const bit = types[name];
    if (typeof bit === "number" && (n & bit) === bit) {
      out.push(RESOURCE_ENUM[name]);
    }
  }
  return out;
}

/**
 * Pure: remove startup-only migrators from a normal-UI list.
 * Firefox profile-refresh migrator must never appear in Settings/profile menu.
 */
export function filterNormalMigrators(migrators = []) {
  return (Array.isArray(migrators) ? migrators : []).filter(
    m => m && !m.startupOnly && m.key && m.key !== "internal-testing"
  );
}

/** Pure: private windows must not run migration / Astra profile mutations. */
export function isPrivateMigrationBlocked(isPrivate) {
  return !!isPrivate;
}

/**
 * Pure: whether Astra may offer Create Profile.
 * Pref alone is insufficient — native SelectableProfileService must be enabled.
 */
export function canOfferSelectableProfiles({
  prefEnabled = false,
  serviceEnabled = false,
  isPrivate = false,
} = {}) {
  if (isPrivate) {
    return false;
  }
  return !!(prefEnabled && serviceEnabled);
}

export function profilesFeatureEnabled() {
  try {
    return Services.prefs.getBoolPref("browser.profiles.enabled", false);
  } catch {
    return false;
  }
}

/**
 * Whether the native SelectableProfileService reports itself enabled.
 * Read through the canonical module singleton — never a window/global.
 */
export function selectableProfilesServiceEnabled() {
  try {
    return !!lazy.SelectableProfileService?.isEnabled;
  } catch {
    return false;
  }
}

export function canCreateSelectableProfile(win = null) {
  return canOfferSelectableProfiles({
    prefEnabled: profilesFeatureEnabled(),
    serviceEnabled: selectableProfilesServiceEnabled(),
    isPrivate: !!(
      win &&
      typeof PrivateBrowsingUtils !== "undefined" &&
      PrivateBrowsingUtils.isWindowPrivate(win)
    ),
  });
}

/**
 * NOTE: Astra intentionally maintains NO second source/browser/profile/resource
 * enumeration model. The native Migration Wizard is the single canonical owner
 * of source-browser discovery, source-profile selection, and resource discovery
 * (`availableMigratorKeys` / `getMigrator` / `getSourceProfiles` /
 * `getMigrateData`). Duplicating that here risks a stale parallel model and can
 * mis-pass a raw profile-id string where `MigratorBase.getMigrateData` expects
 * the source-profile object returned by `getSourceProfiles`. `filterNormalMigrators`
 * and `resourceTypesFromBitfield` above are kept only as pure, side-effect-free
 * decoders exercised by tests.
 */

/**
 * Open the native Migration Wizard. Canonical execution owner.
 * Does not fabricate import counts — wizard owns progress/results UI.
 */
export async function openNativeMigrationWizard(win, options = {}) {
  const mu = lazy.MigrationUtils;
  if (!mu?.showMigrationWizard) {
    return { ok: false, reason: "unavailable" };
  }
  if (
    win &&
    typeof PrivateBrowsingUtils !== "undefined" &&
    PrivateBrowsingUtils.isWindowPrivate(win) &&
    !options.isStartupMigration
  ) {
    return { ok: false, reason: "private-window" };
  }
  try {
    if (Services.policies && !Services.policies.isAllowed("profileImport")) {
      return { ok: false, reason: "policy" };
    }
  } catch {
    // continue
  }

  // Never invoke startup-only Firefox migrator from normal in-session UI.
  if (options.migratorKey && !options.isStartupMigration) {
    try {
      const migrator = await mu.getMigrator(options.migratorKey);
      if (migrator?.startupOnlyMigrator) {
        return { ok: false, reason: "startup-only" };
      }
    } catch {
      return { ok: false, reason: "migrator-check-failed" };
    }
  }

  const entrypoint =
    options.entrypoint || mu.MIGRATION_ENTRYPOINTS?.UNKNOWN || "unknown";
  const wizardOptions = {
    entrypoint,
    isStartupMigration: !!options.isStartupMigration,
  };
  // Only pass migratorKey when caller explicitly skips source selection
  // (startup/welcome paths). Normal Astra Center leaves selection to the wizard.
  if (options.migratorKey && options.skipSourceSelection) {
    wizardOptions.migratorKey = options.migratorKey;
    wizardOptions.skipSourceSelection = true;
  }
  if (options.profileId && options.skipSourceSelection) {
    wizardOptions.profileId = options.profileId;
  }
  safeLog("open-wizard", {
    migratorKey: wizardOptions.migratorKey,
    destination: options.destination,
  });
  try {
    await mu.showMigrationWizard(win || null, wizardOptions);
    // showMigrationWizard resolves when the UI is opened, not with import counts.
    return { ok: true, opened: true };
  } catch {
    safeLog("open-wizard-failed", { errorCategory: "wizard-open" });
    return { ok: false, reason: "wizard-open" };
  }
}

/**
 * Option A: create a new selectable profile via the native service, then launch
 * a SEPARATE instance that opens about:newprofile. Import is deferred to that
 * new instance — nothing is imported in the current process.
 *
 * Uses the exact canonical native sequence:
 *   const profile = await SelectableProfileService.createNewProfile(false);
 *   SelectableProfileService.launchInstance(profile, ["about:newprofile"]);
 *
 * createNewProfile(false) creates without auto-launch (it internally calls
 * maybeSetupDataStore), so we launch explicitly and can report truthful state.
 */
export async function createDestinationProfile(win = null) {
  if (!canCreateSelectableProfile(win)) {
    return { ok: false, reason: "profiles-unavailable" };
  }
  const svc = lazy.SelectableProfileService;
  if (!svc || !svc.isEnabled || typeof svc.createNewProfile !== "function") {
    return { ok: false, reason: "profiles-unavailable" };
  }
  let profile = null;
  try {
    // launchProfile=false: create only. Service handles currentProfile === null
    // (bootstraps the datastore and adopts the running toolkit profile).
    profile = await svc.createNewProfile(false);
  } catch {
    safeLog("create-profile-failed", { errorCategory: "create-profile" });
    return { ok: false, reason: "create-failed" };
  }
  if (!profile) {
    return { ok: false, reason: "create-failed" };
  }
  let targetLaunched = false;
  try {
    if (typeof svc.launchInstance === "function") {
      svc.launchInstance(profile, ["about:newprofile"]);
      targetLaunched = true;
    }
  } catch {
    safeLog("launch-instance-failed", { errorCategory: "launch-profile" });
  }
  // Truthful: profile created, target launched (best-effort), import deferred to
  // the new instance. Never assert that data transfer began or finished in this
  // process — the new instance owns that flow.
  return {
    ok: true,
    profileCreated: true,
    targetLaunched,
    importDeferred: true,
  };
}

export function openManageProfiles(win = null) {
  try {
    const profiles = win?.gProfiles || globalThis.gProfiles;
    if (typeof profiles?.manageProfiles === "function") {
      void profiles.manageProfiles();
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const open = win?.openTrustedLinkIn || globalThis.openTrustedLinkIn;
    if (typeof open === "function") {
      open("about:profilemanager", "tab");
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Contextual Astra panel — destination + privacy only.
 * Native wizard owns browser/profile/resource selection and results.
 */
export class AstraMigrationPanelController {
  #win;
  #destroyed = false;
  #opening = false;
  #state = {
    destination: "new", // "current" | "new"
    privateBlocked: false,
    profilesAvailable: false,
    statusL10n: "",
  };

  constructor(win) {
    this.#win = win;
  }

  get panel() {
    return this.#win.document.getElementById(PANEL_ID);
  }

  destroy() {
    this.#destroyed = true;
    this.#clearDynamic();
  }

  async open(anchor, options = {}) {
    if (this.#destroyed || !this.#win || this.#win.closed) {
      return false;
    }
    if (this.#opening) {
      return false;
    }
    this.#opening = true;
    try {
      const isPrivate =
        typeof PrivateBrowsingUtils !== "undefined" &&
        PrivateBrowsingUtils.isWindowPrivate(this.#win);
      this.#state.privateBlocked = isPrivateMigrationBlocked(isPrivate);
      this.#state.profilesAvailable = canCreateSelectableProfile(this.#win);
      if (!this.#state.profilesAvailable || options.forceCurrent) {
        this.#state.destination = "current";
      } else {
        this.#state.destination = "new";
      }
      this.#state.statusL10n = "";
      this.#render();
      const panel = this.panel;
      if (!panel) {
        if (this.#state.privateBlocked) {
          return false;
        }
        return (
          await openNativeMigrationWizard(this.#win, {
            entrypoint: options.entrypoint,
            isStartupMigration: options.isStartupMigration,
          })
        ).ok;
      }
      try {
        if (panel.state === "open" || panel.state === "showing") {
          return true;
        }
      } catch {
        // continue
      }
      if (typeof panel.openPopup === "function" && anchor) {
        panel.openPopup(anchor, "bottomcenter topright");
      } else if (typeof panel.openPopup === "function") {
        panel.openPopup(anchor);
      }
      return true;
    } catch (error) {
      safeLog("panel-open-failed", { errorCategory: "panel-open" });
      if (this.#state.privateBlocked) {
        return false;
      }
      return (
        await openNativeMigrationWizard(this.#win, {
          entrypoint: options.entrypoint,
          isStartupMigration: options.isStartupMigration,
        })
      ).ok;
    } finally {
      this.#opening = false;
    }
  }

  close() {
    try {
      this.panel?.hidePopup?.();
    } catch {
      // ignore
    }
    this.#clearDynamic();
    this.#state.statusL10n = "";
  }

  #clearDynamic() {
    const list = this.#win.document.getElementById("astra-migration-dynamic");
    if (list) {
      while (list.firstChild) {
        list.firstChild.remove();
      }
    }
  }

  #render() {
    this.#clearDynamic();
    const root = this.#win.document.getElementById("astra-migration-dynamic");
    const doc = this.#win.document;
    if (!root) {
      return;
    }

    if (this.#state.privateBlocked) {
      const blocked = doc.createXULElement("description");
      blocked.classList.add("astra-migration-warning");
      doc.l10n?.setAttributes?.(blocked, "astra-migration-private-blocked");
      root.appendChild(blocked);
      return;
    }

    const privacy = doc.createXULElement("description");
    privacy.classList.add("astra-migration-warning");
    doc.l10n?.setAttributes?.(privacy, "astra-migration-privacy-note");
    root.appendChild(privacy);

    const dLabel = doc.createXULElement("label");
    dLabel.classList.add("astra-migration-section");
    doc.l10n?.setAttributes?.(dLabel, "astra-migration-destination");
    root.appendChild(dLabel);

    const dBox = doc.createXULElement("vbox");
    dBox.classList.add("astra-migration-options");

    if (this.#state.profilesAvailable) {
      const newBtn = doc.createXULElement("toolbarbutton");
      newBtn.classList.add("subviewbutton", "astra-migration-option");
      doc.l10n?.setAttributes?.(newBtn, "astra-migration-dest-new-profile");
      if (this.#state.destination === "new") {
        newBtn.setAttribute("checked", "true");
      }
      newBtn.addEventListener("command", () => {
        this.#state.destination = "new";
        this.#render();
      });
      dBox.appendChild(newBtn);
    }

    const curBtn = doc.createXULElement("toolbarbutton");
    curBtn.classList.add("subviewbutton", "astra-migration-option");
    doc.l10n?.setAttributes?.(curBtn, "astra-migration-dest-current-profile");
    if (this.#state.destination === "current") {
      curBtn.setAttribute("checked", "true");
    }
    curBtn.addEventListener("command", () => {
      this.#state.destination = "current";
      this.#render();
    });
    dBox.appendChild(curBtn);
    root.appendChild(dBox);

    if (this.#state.destination === "current") {
      const warn = doc.createXULElement("description");
      warn.classList.add("astra-migration-warning");
      doc.l10n?.setAttributes?.(warn, "astra-migration-nonempty-warning");
      root.appendChild(warn);
    } else if (this.#state.destination === "new") {
      const note = doc.createXULElement("description");
      note.classList.add("astra-migration-warning");
      doc.l10n?.setAttributes?.(note, "astra-migration-new-profile-handoff");
      root.appendChild(note);
    }

    const wizardNote = doc.createXULElement("description");
    wizardNote.classList.add("astra-migration-warning");
    doc.l10n?.setAttributes?.(wizardNote, "astra-migration-native-wizard-note");
    root.appendChild(wizardNote);

    if (this.#state.statusL10n) {
      const status = doc.createXULElement("description");
      status.classList.add("astra-migration-warning");
      doc.l10n?.setAttributes?.(status, this.#state.statusL10n);
      root.appendChild(status);
    }
  }

  /**
   * Continue from Astra contextual panel.
   * New profile → Option A native create (import later in that instance).
   * Current profile → open native wizard (wizard owns all selection).
   */
  async confirmAndRun(options = {}) {
    if (this.#state.privateBlocked) {
      return { ok: false, reason: "private-window" };
    }
    if (this.#opening) {
      return { ok: false, reason: "busy" };
    }
    this.#opening = true;
    try {
      if (
        this.#state.destination === "new" &&
        this.#state.profilesAvailable
      ) {
        const created = await createDestinationProfile(this.#win);
        if (!created.ok) {
          this.#state.statusL10n = "astra-migration-create-profile-failed";
          this.#render();
          return { ok: false, reason: created.reason || "create-failed" };
        }
        this.#state.statusL10n = "astra-migration-new-profile-handoff";
        this.#render();
        // Do not claim any data transfer began in this process.
        return { ok: true, deferredToNewProfile: true };
      }
      this.close();
      return openNativeMigrationWizard(this.#win, {
        entrypoint: options.entrypoint || "astra-center",
        destination: "current",
        // Native wizard owns browser / profile / resource selection.
      });
    } finally {
      this.#opening = false;
    }
  }
}

export function getMigrationPanel(win) {
  if (!win) {
    return null;
  }
  if (!win.gAstraMigrationPanel) {
    win.gAstraMigrationPanel = new AstraMigrationPanelController(win);
    win.addEventListener(
      "unload",
      () => {
        try {
          win.gAstraMigrationPanel?.destroy?.();
        } catch {
          // ignore
        }
        win.gAstraMigrationPanel = null;
      },
      { once: true }
    );
  }
  return win.gAstraMigrationPanel;
}
