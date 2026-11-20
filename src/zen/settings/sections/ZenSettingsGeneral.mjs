/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  Downloads: "resource://gre/modules/Downloads.sys.mjs",
  LaunchOnLogin: "resource://gre/modules/LaunchOnLogin.sys.mjs",
  ShellService: "moz-src:///browser/components/shell/ShellService.sys.mjs",
  UIState: "resource://services-sync/UIState.sys.mjs",
  Weave: "resource://services-sync/main.sys.mjs",
});

const kFxaEnabledPref = "identity.fxaccounts.enabled";
const kDownloadAskPref = "browser.download.useDownloadDir";
const kDownloadFolderListPref = "browser.download.folderList";
const kDownloadDirPref = "browser.download.dir";
const kDownloadFolderDesktop = 0;
const kDownloadFolderDownloads = 1;
const kDownloadFolderCustom = 2;
const kDefaultAvatar = "chrome://browser/skin/fxa/avatar.svg";
const kJustNowMs = 60 * 1000;
const kLaunchOnLoginPref = "browser.startup.windowsLaunchOnLogin.enabled";

export class ZenSettingsGeneral {
  constructor(settings) {
    this.settings = settings;
    this.#initDefaultBrowser();
    this.#initLaunchOnLogin();
    this.#initDownloads();
    this.#initSync();
  }

  get actions() {
    const entryPoint = "preferences";
    const dialog = document.getElementById("zen-settings-sync-dialog");
    return {
      "sync-now": () => this.#syncNow(),
      "sync-open-dialog": () => dialog.showModal(),
      "sync-close-dialog": () => dialog.close(),
      "sync-sign-in": () =>
        this.#withBrowserSync(sync => sync.openFxAEmailFirstPage(entryPoint)),
      "sync-sign-in-again": () =>
        this.#withBrowserSync(sync => sync.openSignInAgainPage(entryPoint)),
      "sync-turn-on": () =>
        this.#withBrowserSync(sync =>
          sync.openSyncSetupForEntryPoint(entryPoint)
        ),
      "sync-manage-account": () =>
        this.#withBrowserSync(sync => sync.openFxAManagePage(entryPoint)),
      "sync-connect-device": () =>
        this.#withBrowserSync(sync =>
          sync.openConnectAnotherDevice(entryPoint)
        ),
      "sync-sign-out": () => this.#withBrowserSync(sync => sync.disconnect()),
    };
  }

  /* Default browser and startup */

  #initDefaultBrowser() {
    const update = () => this.#updateDefaultBrowser();
    document
      .getElementById("zen-settings-default-browser-button")
      .addEventListener("click", async () => {
        try {
          await lazy.ShellService.setDefaultBrowser(false);
        } catch (ex) {
          console.error("Failed to set the default browser", ex);
        }
        update();
      });
    window.addEventListener("activate", update);
    update();
  }

  #updateDefaultBrowser() {
    let canOffer = false;
    try {
      canOffer =
        Services.policies.isAllowed("setDefaultBrowser") &&
        !lazy.ShellService.isDefaultBrowser(false);
    } catch (ex) {}
    document.getElementById("zen-settings-default-browser").hidden = !canOffer;
  }

  #initLaunchOnLogin() {
    const toggle = document.getElementById("zen-settings-launch-on-login");
    toggle.addEventListener("toggle", async () => {
      try {
        await (toggle.pressed
          ? lazy.LaunchOnLogin.enable()
          : lazy.LaunchOnLogin.disable());
      } catch (ex) {
        console.error("Failed to change launching on login", ex);
      }
      this.#updateLaunchOnLogin();
    });
    this.settings.watchPrefs([kLaunchOnLoginPref], () =>
      this.#updateLaunchOnLogin()
    );
    window.addEventListener("activate", () => this.#updateLaunchOnLogin());
  }

  async #updateLaunchOnLogin() {
    const toggle = document.getElementById("zen-settings-launch-on-login");
    const row = toggle.closest(".zen-settings-row");
    row.hidden =
      !lazy.LaunchOnLogin.isSupported() ||
      !Services.prefs.getBoolPref(kLaunchOnLoginPref, false);
    if (row.hidden) {
      return;
    }
    try {
      const [enabled, allowed] = await Promise.all([
        lazy.LaunchOnLogin.isEnabled(),
        lazy.LaunchOnLogin.isAllowed(),
      ]);
      toggle.pressed = enabled;
      toggle.disabled = !allowed;
    } catch (ex) {
      console.error("Failed to read launching on login", ex);
    }
  }

  /* Downloads */

  #initDownloads() {
    const list = document.getElementById("zen-settings-download-location");
    list.addEventListener("command", () => {
      switch (list.value) {
        case "folder":
          Services.prefs.setBoolPref(kDownloadAskPref, true);
          break;
        case "ask":
          Services.prefs.setBoolPref(kDownloadAskPref, false);
          break;
        case "other":
          this.#chooseDownloadFolder();
          break;
      }
    });
    this.settings.watchPrefs(
      [kDownloadAskPref, kDownloadFolderListPref, kDownloadDirPref],
      () => this.#updateDownloads()
    );
  }

  /** @returns {Promise<nsIFile|null>} The folder downloads are saved to. */
  async #getDownloadFolder() {
    try {
      switch (Services.prefs.getIntPref(kDownloadFolderListPref, 1)) {
        case kDownloadFolderDesktop:
          return Services.dirsvc.get("Desk", Ci.nsIFile);
        case kDownloadFolderCustom:
          return Services.prefs.getComplexValue(kDownloadDirPref, Ci.nsIFile);
      }
      const folder = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      folder.initWithPath(await lazy.Downloads.getSystemDownloadsDirectory());
      return folder;
    } catch (ex) {
      console.error("Failed to find the download folder", ex);
      return null;
    }
  }

  async #updateDownloads() {
    const list = document.getElementById("zen-settings-download-location");
    const item = document.getElementById("zen-settings-download-folder");
    const folder = await this.#getDownloadFolder();
    if (window.closed) {
      return;
    }
    item.hidden = !folder;
    if (folder) {
      item.label = folder.leafName;
      item.setAttribute(
        "image",
        `moz-icon://${Services.io.newFileURI(folder).spec}?size=16`
      );
    }
    list.disabled = Services.prefs.prefIsLocked(kDownloadAskPref);
    list.value =
      folder && Services.prefs.getBoolPref(kDownloadAskPref, true)
        ? "folder"
        : "ask";
  }

  async #chooseDownloadFolder() {
    const picker = Cc["@mozilla.org/filepicker;1"].createInstance(
      Ci.nsIFilePicker
    );
    picker.init(
      window.browsingContext,
      await document.l10n.formatValue(
        "zen-settings-window-download-location-picker"
      ),
      Ci.nsIFilePicker.modeGetFolder
    );
    const current = await this.#getDownloadFolder();
    if (current?.exists()) {
      picker.displayDirectory = current;
    }
    const result = await new Promise(resolve => picker.open(resolve));
    if (result == Ci.nsIFilePicker.returnOK) {
      await this.#setDownloadFolder(picker.file);
    }
    this.#updateDownloads();
  }

  /**
   * @param {nsIFile} folder Where downloads get saved from now on.
   */
  async #setDownloadFolder(folder) {
    let folderList = kDownloadFolderCustom;
    try {
      const downloads = await lazy.Downloads.getSystemDownloadsDirectory();
      if (folder.equals(Services.dirsvc.get("Desk", Ci.nsIFile))) {
        folderList = kDownloadFolderDesktop;
      } else if (folder.path == downloads) {
        folderList = kDownloadFolderDownloads;
      }
    } catch (ex) {
      // Any folder can be stored as a custom one.
    }
    Services.prefs.setComplexValue(kDownloadDirPref, Ci.nsIFile, folder);
    Services.prefs.setIntPref(kDownloadFolderListPref, folderList);
    Services.prefs.setBoolPref(kDownloadAskPref, true);
  }

  /* Account and sync */

  #initSync() {
    this.settings.watchTopics([lazy.UIState.ON_UPDATE], () =>
      this.#updateSync()
    );
    this.settings.watchPrefs([kFxaEnabledPref], () => {
      document.getElementById("zen-settings-sync").hidden =
        !Services.prefs.getBoolPref(kFxaEnabledPref, true);
    });
    this.#updateSync();
  }

  #updateSync() {
    const { UIState } = lazy;
    const state = UIState.get();
    const signedOut = state.status == UIState.STATUS_NOT_CONFIGURED;
    const signedIn = state.status == UIState.STATUS_SIGNED_IN;
    const $ = id => document.getElementById(`zen-settings-sync-${id}`);

    $("signed-out").hidden = !signedOut;
    $("account").hidden = signedOut;
    $("problem").hidden = signedOut || signedIn;
    $("summary-row").hidden = !signedIn;
    $("setup").hidden = !signedIn || state.syncEnabled;
    $("engines").hidden = !signedIn || !state.syncEnabled;
    if (!signedIn && $("dialog").open) {
      $("dialog").close();
    }
    if (signedOut) {
      return;
    }

    $("avatar").src = state.avatarURL || kDefaultAvatar;
    $("name").textContent = state.displayName || state.email || "";
    $("email").textContent = state.displayName ? (state.email ?? "") : "";
    document.l10n.setAttributes(
      $("problem-text"),
      state.status == UIState.STATUS_NOT_VERIFIED
        ? "zen-settings-window-sync-not-verified"
        : "zen-settings-window-sync-login-failed"
    );

    let statusL10n = ["zen-settings-window-sync-status-date"];
    if (!state.syncEnabled) {
      statusL10n = ["zen-settings-window-sync-off"];
    } else if (state.syncing) {
      statusL10n = ["zen-settings-window-sync-status-syncing"];
    } else if (!state.lastSync) {
      statusL10n = ["zen-settings-window-sync-status-never"];
    } else if (Date.now() - state.lastSync.getTime() < kJustNowMs) {
      statusL10n = ["zen-settings-window-sync-status-just-now"];
    } else {
      statusL10n.push({ date: state.lastSync.getTime() });
    }
    const statusState =
      state.syncing || !state.syncEnabled ? "busy" : "success";
    for (const id of ["status", "summary"]) {
      document.l10n.setAttributes($(`${id}-text`), ...statusL10n);
      $(id).dataset.state = statusState;
    }
    $("now").disabled = !!state.syncing;
  }

  #withBrowserSync(callback) {
    const win = lazy.BrowserWindowTracker.getTopWindow();
    if (!win?.gSync) {
      window.openPreferences("paneSync");
      return;
    }
    win.focus();
    callback(win.gSync);
  }

  #syncNow() {
    const { UIState } = lazy;
    if (UIState.get().status != UIState.STATUS_SIGNED_IN) {
      return;
    }
    Services.tm.dispatchToMainThread(() => lazy.Weave.Service.sync());
  }
}
