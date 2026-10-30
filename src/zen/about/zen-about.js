/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  AppConstants: "resource://gre/modules/AppConstants.sys.mjs",
  AppUpdater: "resource://gre/modules/AppUpdater.sys.mjs",
  DownloadUtils: "resource://gre/modules/DownloadUtils.sys.mjs",
});

ChromeUtils.defineLazyGetter(lazy, "AUS", () =>
  Cc["@mozilla.org/updates/update-service;1"].getService(
    Ci.nsIApplicationUpdateService
  )
);

ChromeUtils.defineLazyGetter(lazy, "ClipboardHelper", () =>
  Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper)
);

const kCheckingMinDisplayMs = 1500;
const kCopiedHintMs = 1500;

class nsZenAboutDialog {
  #updater = null;
  #updateListener = null;
  #lastStatus = null;
  #checkingDelay = Promise.resolve();
  #buttonAction = null;
  #copiedTimer = null;

  constructor() {
    this.#initVersion();
    this.#initLinks();
    this.#initUpdater();

    document
      .getElementById("zen-about-escape-key")
      .addEventListener("command", () => window.close());
    window.addEventListener("unload", () => this.destroy(), { once: true });
  }

  destroy() {
    this.stopUpdateChecks();
    window.clearTimeout(this.#copiedTimer);
  }

  get #arch() {
    const arch = Services.sysinfo.get("arch");
    if (["x86", "x86-64"].includes(arch)) {
      return Services.appinfo.is64Bit ? "64-bit" : "32-bit";
    }
    return arch;
  }

  /**
   * Twilight versions carry a "t" and change daily, so a build date is the
   * only way to tell two of them apart.
   *
   * @param {string} version A display version such as "1.25t".
   * @returns {boolean}
   */
  static isRollingVersion(version) {
    return version.includes("t");
  }

  /**
   * @param {string} buildID A build id such as "20261029120000".
   * @returns {string} The build date in ISO format.
   */
  static buildDate(buildID) {
    return `${buildID.slice(0, 4)}-${buildID.slice(4, 6)}-${buildID.slice(6, 8)}`;
  }

  #initVersion() {
    const args = {
      version: lazy.AppConstants.MOZ_APP_VERSION_DISPLAY,
      firefoxVersion: lazy.AppConstants.ZEN_FIREFOX_VERSION,
      arch: this.#arch,
    };
    let versionId = "zen-about-version";
    if (nsZenAboutDialog.isRollingVersion(Services.appinfo.version)) {
      args.isodate = nsZenAboutDialog.buildDate(Services.appinfo.appBuildID);
      versionId = "zen-about-version-twilight";
    }
    document.l10n.setAttributes(
      document.getElementById("zen-about-version-text"),
      versionId,
      args
    );
    document.l10n.setAttributes(
      document.getElementById("zen-about-firefox-version"),
      "zen-about-firefox-version",
      args
    );
    const version = document.getElementById("zen-about-version");
    version.addEventListener("click", () => {
      if (window.getSelection().isCollapsed) {
        this.copyBuildInfo();
      }
    });
    version.addEventListener("keydown", event => {
      if (event.key == "Enter" || event.key == " ") {
        event.preventDefault();
        this.copyBuildInfo();
      }
    });
  }

  /**
   * Plain-text summary of this build, handy when filing issues.
   */
  get buildInfo() {
    return [
      `${Services.appinfo.name} ${lazy.AppConstants.MOZ_APP_VERSION_DISPLAY} (${this.#arch})`,
      `Firefox ${lazy.AppConstants.ZEN_FIREFOX_VERSION}`,
      `Build ID ${Services.appinfo.appBuildID}`,
      `${Services.sysinfo.getProperty("name")} ${Services.sysinfo.getProperty("version")}`,
    ].join("\n");
  }

  copyBuildInfo() {
    lazy.ClipboardHelper.copyString(this.buildInfo);
    const hint = document.getElementById("zen-about-copied");
    hint.hidden = false;
    window.clearTimeout(this.#copiedTimer);
    this.#copiedTimer = window.setTimeout(() => {
      hint.hidden = true;
    }, kCopiedHintMs);
  }

  get releaseNotesURL() {
    const pref = "app.releaseNotesURL.aboutDialog";
    if (Services.prefs.getPrefType(pref) != Services.prefs.PREF_INVALID) {
      const url = Services.urlFormatter.formatURLPref(pref);
      if (url != "about:blank") {
        return url;
      }
    }
    return "";
  }

  get manualUpdateURL() {
    try {
      return Services.urlFormatter.formatURLPref("app.update.url.manual");
    } catch (e) {
      return "";
    }
  }

  #initLinks() {
    const releaseNotes = document.getElementById("zen-about-release-notes");
    releaseNotes.href = this.releaseNotesURL;
    document
      .getElementById("zen-about-content")
      .addEventListener("click", event => {
        const link = event.target.closest("a[href]");
        if (!link || event.button != 0) {
          return;
        }
        event.preventDefault();
        this.openLink(link.href);
      });
  }

  openLink(url) {
    if (!url) {
      return;
    }
    window.openTrustedLinkIn(url, "tab");
  }

  #initUpdater() {
    if (!lazy.AppConstants.MOZ_UPDATER) {
      document.getElementById("zen-about-update").hidden = true;
      return;
    }
    document
      .getElementById("zen-about-update-button")
      .addEventListener("click", () => this.#buttonAction?.());

    this.#updater = new lazy.AppUpdater();
    this.#updateListener = (updateStatus, ...args) =>
      this.onUpdateStatus(updateStatus, ...args);
    this.#updater.addListener(this.#updateListener);
    this.#updater.check();
  }

  stopUpdateChecks() {
    if (!this.#updater) {
      return;
    }
    this.#updater.removeListener(this.#updateListener);
    this.#updater.stop();
    this.#updater = null;
  }

  get update() {
    return this.#updater?.update;
  }

  get #updateVersion() {
    const update = this.update;
    if (!update) {
      return "";
    }
    let version = update.displayVersion;
    if (nsZenAboutDialog.isRollingVersion(version)) {
      version += ` (${nsZenAboutDialog.buildDate(update.buildID)})`;
    }
    return version;
  }

  checkForUpdates() {
    this.#updater?.check();
  }

  startDownload() {
    this.#updater?.allowUpdateDownload();
  }

  restartToUpdate() {
    const { STATUS } = lazy.AppUpdater;
    if (lazy.AUS.currentState != Ci.nsIApplicationUpdateService.STATE_PENDING) {
      return;
    }
    this.#show("restarting", { textId: "zen-about-update-restarting" });

    const cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(
      Ci.nsISupportsPRBool
    );
    Services.obs.notifyObservers(
      cancelQuit,
      "quit-application-requested",
      "restart"
    );
    if (cancelQuit.data) {
      this.onUpdateStatus(STATUS.READY_FOR_RESTART);
      return;
    }
    if (Services.appinfo.inSafeMode) {
      Services.startup.restartInSafeMode(Ci.nsIAppStartup.eAttemptQuit);
      return;
    }
    if (
      !Services.startup.quit(
        Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart
      )
    ) {
      this.onUpdateStatus(STATUS.READY_FOR_RESTART);
    }
  }

  /**
   * Maps an AppUpdater status onto the single status row of the dialog.
   *
   * @param {number} updateStatus One of AppUpdater.STATUS.
   * @param {...any} args Download progress for DOWNLOADING.
   */
  onUpdateStatus(updateStatus, ...args) {
    const { STATUS } = lazy.AppUpdater;
    this.#lastStatus = updateStatus;
    switch (updateStatus) {
      case STATUS.NEVER_CHECKED:
        this.#show("never-checked", {
          buttonId: "zen-about-update-check",
          action: () => this.checkForUpdates(),
        });
        break;
      case STATUS.CHECKING:
        this.#checkingDelay = new Promise(resolve =>
          window.setTimeout(resolve, kCheckingMinDisplayMs)
        );
        this.#show("checking", { textId: "zen-about-update-checking" });
        break;
      case STATUS.NO_UPDATES_FOUND:
        this.#checkingDelay.then(() => {
          if (this.#lastStatus != STATUS.NO_UPDATES_FOUND) {
            return;
          }
          this.#show("up-to-date", {
            textId: "zen-about-update-up-to-date",
            buttonId: "zen-about-update-check-again",
            action: () => this.checkForUpdates(),
          });
        });
        break;
      case STATUS.DOWNLOAD_AND_INSTALL:
        this.#show("available", {
          textId: "zen-about-update-available",
          textArgs: { version: this.#updateVersion },
          buttonId: "zen-about-update-download",
          action: () => this.startDownload(),
          primary: true,
        });
        break;
      case STATUS.DOWNLOADING: {
        let [progress, max] = args;
        if (!args.length) {
          progress = 0;
          max = this.update?.selectedPatch?.size ?? -1;
        }
        this.#show("downloading", {
          textId: "zen-about-update-downloading",
          textArgs: {
            transfer: lazy.DownloadUtils.getTransferTotal(progress, max),
          },
          progress: max > 0 ? (progress / max) * 100 : null,
        });
        break;
      }
      case STATUS.STAGING:
        this.#show("applying", { textId: "zen-about-update-applying" });
        break;
      case STATUS.READY_FOR_RESTART:
        this.#show("ready", {
          textId: "zen-about-update-ready",
          buttonId: "zen-about-update-restart",
          action: () => this.restartToUpdate(),
          primary: true,
        });
        break;
      case STATUS.DOWNLOAD_FAILED:
        this.#show("failed", {
          textId: "zen-about-update-download-failed",
          buttonId: "zen-about-update-download-manually",
          action: () => this.openLink(this.manualUpdateURL),
        });
        break;
      case STATUS.CHECKING_FAILED:
        this.#show("failed", {
          textId: "zen-about-update-checking-failed",
          buttonId: "zen-about-update-try-again",
          action: () => this.checkForUpdates(),
        });
        break;
      case STATUS.INTERNAL_ERROR:
        this.#show("failed", {
          textId: "zen-about-update-internal-error",
          buttonId: "zen-about-update-download-manually",
          action: () => this.openLink(this.manualUpdateURL),
        });
        break;
      case STATUS.MANUAL_UPDATE:
        this.#show("available", {
          textId: "zen-about-update-manual",
          buttonId: "zen-about-update-download-manually",
          action: () => this.openLink(this.manualUpdateURL),
          primary: true,
        });
        break;
      case STATUS.UNSUPPORTED_SYSTEM: {
        const detailsURL = this.update?.detailsURL;
        this.#show("blocked", {
          textId: "zen-about-update-unsupported",
          buttonId: detailsURL ? "zen-about-update-learn-more" : null,
          action: () => this.openLink(detailsURL),
        });
        break;
      }
      case STATUS.UPDATE_DISABLED_BY_POLICY:
        this.#show("blocked", { textId: "zen-about-update-policy-disabled" });
        break;
      case STATUS.OTHER_INSTANCE_HANDLING_UPDATES:
        this.#show("blocked", { textId: "zen-about-update-other-instance" });
        break;
      case STATUS.NO_UPDATER:
      default:
        document.getElementById("zen-about-update").hidden = true;
        break;
    }
  }

  /**
   * @param {string} state Drives the icon through CSS.
   * @param {object} options
   * @param {string} [options.textId] Fluent id for the status text.
   * @param {object} [options.textArgs] Fluent args for the status text.
   * @param {string} [options.buttonId] Fluent id for the action button.
   * @param {Function} [options.action] Runs when the button is clicked.
   * @param {boolean} [options.primary] Styles the button as the main action.
   * @param {number} [options.progress] Percentage, null for indeterminate.
   */
  #show(
    state,
    {
      textId,
      textArgs = {},
      buttonId,
      action,
      primary = false,
      progress = null,
    }
  ) {
    const section = document.getElementById("zen-about-update");
    section.hidden = false;
    section.dataset.state = state;

    const text = document.getElementById("zen-about-update-text");
    text.hidden = !textId;
    if (textId) {
      document.l10n.setAttributes(text, textId, textArgs);
    } else {
      text.removeAttribute("data-l10n-id");
      text.textContent = "";
    }

    const button = document.getElementById("zen-about-update-button");
    this.#buttonAction = buttonId ? action : null;
    button.hidden = !buttonId;
    if (buttonId) {
      document.l10n.setAttributes(button, buttonId);
    }
    button.classList.toggle("primary", primary);

    const bar = document.getElementById("zen-about-update-progress");
    bar.hidden = state != "downloading";
    if (progress === null) {
      bar.removeAttribute("value");
    } else {
      bar.value = progress;
    }
  }
}

window.zenAboutDialog = new nsZenAboutDialog();
