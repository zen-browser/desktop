/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Stable per-window Migration Center + Profiles entry.
 * Startup budget: register facade + bind explicit actions only.
 * No migrator enumeration, disk probing, or wizard import at startup.
 * Failure must never brick browser.xhtml startup.
 */

const CENTER_URL =
  "chrome://browser/content/zen-components/AstraMigrationCenter.mjs";
const PANEL_ID = "PanelUI-astra-migration";
const LOG = "[AstraMigration]";

class AstraMigrationBootstrap {
  #centerMod = null;
  #importPromise = null;
  #destroyed = false;
  #profilesHooked = false;
  #flight = null;

  constructor() {
    window.gAstraMigrationBootstrap = this;
    window.gAstraMigration = {
      init: () => this.init(),
      destroy: () => this.destroy(),
      open: (eventOrOptions, win = window) => this.open(eventOrOptions, win),
      close: () => this.close(),
      toggle: (eventOrOptions, win = window) => this.toggle(eventOrOptions, win),
      openNativeWizard: (options = {}) => this.openNativeWizard(options),
      openProfiles: () => this.openProfiles(),
      createProfile: () => this.createProfile(),
      manageProfiles: () => this.manageProfiles(),
    };
    try {
      this.init();
    } catch (error) {
      console.warn(`${LOG} bootstrap init failed; browser remains usable`);
    }
  }

  init() {
    if (this.#destroyed) {
      return;
    }
    // Bind profile-menu injection only; no enumeration here.
    this.#ensureProfilesImportButton();
    window.addEventListener(
      "unload",
      () => {
        this.destroy();
      },
      { once: true }
    );
  }

  destroy() {
    this.#destroyed = true;
    this.#flight = null;
    try {
      window.gAstraMigrationPanel?.destroy?.();
    } catch {
      // ignore
    }
  }

  #isPrivate(win = window) {
    try {
      return (
        typeof PrivateBrowsingUtils !== "undefined" &&
        PrivateBrowsingUtils.isWindowPrivate(win)
      );
    } catch {
      return false;
    }
  }

  async #loadCenter() {
    if (this.#centerMod) {
      return this.#centerMod;
    }
    if (this.#importPromise) {
      return this.#importPromise;
    }
    this.#importPromise = (async () => {
      try {
        this.#centerMod = await ChromeUtils.importESModule(CENTER_URL);
        return this.#centerMod;
      } catch (error) {
        console.warn(`${LOG} center module unavailable`);
        this.#importPromise = null;
        return null;
      }
    })();
    return this.#importPromise;
  }

  async #withFlight(fn) {
    if (this.#flight) {
      return this.#flight;
    }
    this.#flight = (async () => {
      try {
        return await fn();
      } finally {
        this.#flight = null;
      }
    })();
    return this.#flight;
  }

  async #openNativeWizardUnlocked(options = {}) {
    if (this.#isPrivate(window) && !options.isStartupMigration) {
      return { ok: false, reason: "private-window" };
    }
    try {
      const mod = await this.#loadCenter();
      if (mod?.openNativeMigrationWizard) {
        return mod.openNativeMigrationWizard(window, options);
      }
    } catch {
      // fall through
    }
    try {
      const { MigrationUtils } = ChromeUtils.importESModule(
        "resource:///modules/MigrationUtils.sys.mjs"
      );
      await MigrationUtils.showMigrationWizard(window, {
        isStartupMigration: !!options.isStartupMigration,
        entrypoint: options.entrypoint,
      });
      return { ok: true, opened: true };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  }

  async openNativeWizard(options = {}) {
    return this.#withFlight(() => this.#openNativeWizardUnlocked(options));
  }

  async open(eventOrOptions = {}, win = window) {
    if (this.#destroyed || win?.closed) {
      return false;
    }
    return this.#withFlight(async () => {
      const options =
        eventOrOptions && typeof eventOrOptions === "object"
          ? eventOrOptions
          : {};
      if (this.#isPrivate(win) && !options.isStartupMigration) {
        try {
          const mod = await this.#loadCenter();
          const panel = mod?.getMigrationPanel?.(win);
          if (panel) {
            const anchor =
              options.anchor ||
              eventOrOptions?.target ||
              document.getElementById("PanelUI-menu-button");
            return panel.open(anchor, options);
          }
        } catch {
          // ignore
        }
        return false;
      }
      const anchor =
        options.anchor ||
        eventOrOptions?.target ||
        document.getElementById("PanelUI-menu-button") ||
        document.getElementById("nav-bar");
      try {
        const mod = await this.#loadCenter();
        if (mod?.getMigrationPanel) {
          const panel = mod.getMigrationPanel(win);
          return panel.open(anchor, options);
        }
      } catch {
        // fall through
      }
      const result = await this.#openNativeWizardUnlocked(options);
      return !!result?.ok;
    });
  }

  close() {
    try {
      window.gAstraMigrationPanel?.close?.();
    } catch {
      // ignore
    }
    try {
      document.getElementById(PANEL_ID)?.hidePopup?.();
    } catch {
      // ignore
    }
  }

  async toggle(eventOrOptions = {}, win = window) {
    const panel = document.getElementById(PANEL_ID);
    if (panel?.state === "open" || panel?.state === "showing") {
      this.close();
      return false;
    }
    return this.open(eventOrOptions, win);
  }

  async confirmImport() {
    return this.#withFlight(async () => {
      if (this.#isPrivate(window)) {
        return { ok: false, reason: "private-window" };
      }
      try {
        const panel = window.gAstraMigrationPanel;
        if (panel?.confirmAndRun) {
          return panel.confirmAndRun({ entrypoint: "astra-center" });
        }
      } catch {
        // ignore
      }
      return this.#openNativeWizardUnlocked({ entrypoint: "astra-center" });
    });
  }

  openProfiles() {
    try {
      if (typeof gProfiles?.updateView === "function") {
        const btn =
          PanelMultiView?.getViewNode?.(document, "appMenu-profiles-button") ||
          PanelMultiView?.getViewNode?.(
            document,
            "appMenu-empty-profiles-button"
          );
        if (btn) {
          gProfiles.updateView(btn);
          return true;
        }
      }
    } catch {
      // ignore
    }
    return this.manageProfiles();
  }

  async createProfile() {
    if (this.#isPrivate(window)) {
      return { ok: false, reason: "private-window" };
    }
    try {
      const mod = await this.#loadCenter();
      if (mod?.canCreateSelectableProfile && !mod.canCreateSelectableProfile(window)) {
        return { ok: false, reason: "profiles-unavailable" };
      }
      if (mod?.createDestinationProfile) {
        return mod.createDestinationProfile(window);
      }
    } catch {
      // ignore
    }
    try {
      gProfiles?.createNewProfile?.();
      return { ok: true };
    } catch {
      try {
        openTrustedLinkIn("about:newprofile", "tab");
        return { ok: true };
      } catch {
        return { ok: false };
      }
    }
  }

  manageProfiles() {
    try {
      gProfiles?.manageProfiles?.();
      return true;
    } catch {
      try {
        openTrustedLinkIn("about:profilemanager", "tab");
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Inject "Import browser data" into the native profiles subview.
   * Does not enumerate migrators. Hidden in private windows.
   */
  #ensureProfilesImportButton() {
    if (this.#profilesHooked) {
      return;
    }
    this.#profilesHooked = true;
    const attach = () => {
      try {
        const profilesView = PanelMultiView?.getViewNode?.(
          document,
          "PanelUI-profiles"
        );
        if (!profilesView) {
          return;
        }
        profilesView.addEventListener("ViewShowing", () => {
          this.#injectImportIntoProfilesView(profilesView);
        });
      } catch {
        // Profile UI injection is optional.
      }
    };
    if (document.readyState === "complete") {
      attach();
    } else {
      window.addEventListener("load", attach, { once: true });
    }
  }

  #injectImportIntoProfilesView(profilesView) {
    try {
      let btn = profilesView.querySelector("#astra-profiles-import-button");
      if (this.#isPrivate(window)) {
        if (btn) {
          btn.hidden = true;
        }
        return;
      }
      if (btn) {
        btn.hidden = false;
        return;
      }
      const manage = profilesView.querySelector(
        "#profiles-manage-profiles-button"
      );
      btn = document.createXULElement("toolbarbutton");
      btn.id = "astra-profiles-import-button";
      btn.classList.add("subviewbutton", "subviewbutton-iconic");
      document.l10n?.setAttributes?.(btn, "astra-migration-import-into-profile");
      btn.addEventListener("command", () => {
        void this.open({
          entrypoint: "profiles-menu",
          forceCurrent: true,
        });
      });
      if (manage?.parentNode) {
        manage.parentNode.insertBefore(btn, manage);
      } else {
        profilesView.appendChild(btn);
      }
    } catch {
      // ignore
    }
  }
}

try {
  // eslint-disable-next-line no-new
  new AstraMigrationBootstrap();
} catch (error) {
  console.warn("[AstraMigration] bootstrap construction failed");
}
