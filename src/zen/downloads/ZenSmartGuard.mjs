// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const PREFS = Object.freeze({
  ENABLED: "zen.smart.enabled",
  DOWNLOADS: "zen.smart.downloads.enabled",
  SCREEN: "zen.smart.screen.enabled",
  CLIPBOARD: "zen.smart.clipboard.enabled",
  NOTIFY: "zen.smart.notify.enabled",
});

const DOWNLOAD_EXTENSIONS = Object.freeze({
  high: new Set([
    ".apk",
    ".app",
    ".bat",
    ".cmd",
    ".com",
    ".cpl",
    ".dll",
    ".dmg",
    ".exe",
    ".hta",
    ".jar",
    ".js",
    ".lnk",
    ".msi",
    ".pkg",
    ".ps1",
    ".scr",
    ".vbs",
  ]),
  medium: new Set([
    ".7z",
    ".bz2",
    ".gz",
    ".iso",
    ".rar",
    ".tar",
    ".tgz",
    ".xz",
    ".zip",
  ]),
});

const CLIPBOARD_PATTERNS = Object.freeze([
  {
    regex:
      /\b(?:AKIA|ASIA|AIza|ghp_|xox[baprs]-|sk_live_|pk_live_|eyJ[a-zA-Z0-9_-]{20,})[a-zA-Z0-9/_+=.-]{8,}\b/,
    reason: "Potential credential-like token pattern detected.",
  },
  {
    regex:
      /\b(?:\d[ -]*?){13,19}\b|\b(?:cvv|otp|one[- ]?time[- ]?password)\b/i,
    reason: "Potential financial/OTP-like value detected.",
  },
]);

class nsZenSmartGuard extends nsZenDOMOperatedFeature {
  #downloadView = null;
  #onTabSelect = null;
  #state = {
    suspiciousScore: 0,
    download: { level: "none", score: 0, reasons: [] },
    screen: { level: "none", score: 0, reasons: [] },
    clipboard: { level: "none", score: 0, reasons: [] },
    updatedAt: 0,
  };

  get enabled() {
    return Services.prefs.getBoolPref(PREFS.ENABLED, false);
  }

  async init() {
    window.gZenSmartGuard = this;
    await this.#setupDownloadListener();
    // Named handler so a future teardown can removeEventListener cleanly.
    this.#onTabSelect = () => this.refreshScreenAssessment();
    window.addEventListener("TabSelect", this.#onTabSelect);
    this.refreshScreenAssessment();
  }

  async #setupDownloadListener() {
    try {
      const Downloads = window.Downloads;
      const list = await Downloads.getList(Downloads.ALL);
      this.#downloadView = {
        onDownloadAdded: this.#onDownloadAdded.bind(this),
      };
      list.addView(this.#downloadView);
    } catch (error) {
      console.error(
        `[${nsZenSmartGuard.name}] Failed to set up SMART download listener: ${error}`
      );
    }
  }

  #onDownloadAdded(download) {
    if (
      !this.enabled ||
      !Services.prefs.getBoolPref(PREFS.DOWNLOADS, false) ||
      !download
    ) {
      return;
    }

    const assessment = this.#assessDownload(download);
    this.#updateChannel("download", assessment);
    if (assessment.level === "high" || assessment.level === "medium") {
      this.#maybeNotify("zen-smart-download-warning");
    }
  }

  #assessDownload(download) {
    const sourceURL = download?.source?.url || "";
    const targetPath = download?.target?.path || "";
    const extension = this.#extractExtension(targetPath || sourceURL);
    let score = 0;
    const reasons = [];

    if (extension && DOWNLOAD_EXTENSIONS.high.has(extension)) {
      score += 70;
      reasons.push(`Executable file type detected (${extension}).`);
    } else if (extension && DOWNLOAD_EXTENSIONS.medium.has(extension)) {
      score += 30;
      reasons.push(`Archive download detected (${extension}).`);
    }

    const urlHost = this.#extractHost(sourceURL);
    if (urlHost) {
      if (urlHost.includes("xn--")) {
        score += 35;
        reasons.push("Punycode domain detected.");
      }
      if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(urlHost)) {
        score += 35;
        reasons.push("Download host is a raw IP address.");
      }
    }

    return this.#buildAssessment(score, reasons);
  }

  refreshScreenAssessment() {
    if (!this.enabled || !Services.prefs.getBoolPref(PREFS.SCREEN, false)) {
      this.#updateChannel("screen", this.#buildAssessment(0, []));
      return;
    }

    const reasons = [];
    let score = 0;
    const sharingState = gBrowser?.selectedTab?._sharingState;
    const webrtc = sharingState?.webRTC;

    if (webrtc?.screen) {
      score += 45;
      reasons.push("Screen sharing is currently active for this tab.");
    }
    if (webrtc?.screen && (webrtc?.camera || webrtc?.microphone)) {
      score += 30;
      reasons.push("Screen share + camera/microphone is active together.");
    }

    this.#updateChannel("screen", this.#buildAssessment(score, reasons));
    if (score >= 45) {
      this.#maybeNotify("zen-smart-screen-warning");
    }
  }

  guardedCopyToClipboard(text, source = "generic") {
    // Services.clipboardHelper is undefined in this Firefox 149 chrome build.
    Cc["@mozilla.org/widget/clipboardhelper;1"]
      .getService(Ci.nsIClipboardHelper)
      .copyString(text);
    if (!this.enabled || !Services.prefs.getBoolPref(PREFS.CLIPBOARD, false)) {
      return;
    }

    const normalized = typeof text === "string" ? text.trim() : "";
    const reasons = [];
    let score = 0;
    for (const { regex, reason } of CLIPBOARD_PATTERNS) {
      if (regex.test(normalized)) {
        score += 45;
        reasons.push(reason);
      }
    }

    if (normalized.length > 4000) {
      score += 20;
      reasons.push("Very large clipboard payload copied.");
    }

    if (source !== "generic") {
      reasons.push(`Clipboard source: ${source}.`);
    }

    const assessment = this.#buildAssessment(score, reasons);
    this.#updateChannel("clipboard", assessment);
    if (assessment.level === "high" || assessment.level === "medium") {
      this.#maybeNotify("zen-smart-clipboard-warning");
    }
  }

  #buildAssessment(score, reasons) {
    const level =
      score >= 70 ? "high" : score >= 35 ? "medium" : score > 0 ? "low" : "none";
    return { level, score, reasons };
  }

  #updateChannel(channel, assessment) {
    this.#state[channel] = assessment;
    this.#state.suspiciousScore = Math.max(
      this.#state.download.score,
      this.#state.screen.score,
      this.#state.clipboard.score
    );
    this.#state.updatedAt = Date.now();
    window.dispatchEvent(
      new CustomEvent("ZenSmartGuardStateChange", {
        detail: this.getLatestState(),
      })
    );
  }

  getLatestState() {
    return {
      suspiciousScore: this.#state.suspiciousScore,
      download: {
        level: this.#state.download.level,
        score: this.#state.download.score,
        reasons: [...this.#state.download.reasons],
      },
      screen: {
        level: this.#state.screen.level,
        score: this.#state.screen.score,
        reasons: [...this.#state.screen.reasons],
      },
      clipboard: {
        level: this.#state.clipboard.level,
        score: this.#state.clipboard.score,
        reasons: [...this.#state.clipboard.reasons],
      },
      updatedAt: this.#state.updatedAt,
    };
  }

  getPanelStatus() {
    const level =
      this.#state.suspiciousScore >= 70
        ? "high"
        : this.#state.suspiciousScore >= 35
          ? "medium"
          : this.#state.suspiciousScore > 0
            ? "low"
            : "none";
    const reasons = [
      ...this.#state.download.reasons,
      ...this.#state.screen.reasons,
      ...this.#state.clipboard.reasons,
    ];
    const reason = reasons[0] || "No suspicious signal detected.";
    const labelId =
      level === "high"
        ? "zen-smart-status-high"
        : level === "medium"
          ? "zen-smart-status-medium"
          : level === "low"
            ? "zen-smart-status-low"
            : "zen-smart-status-safe";
    return { level, labelId, reason };
  }

  #maybeNotify(messageId) {
    if (
      !this.enabled ||
      !Services.prefs.getBoolPref(PREFS.NOTIFY, false) ||
      !window.gZenUIManager
    ) {
      return;
    }
    window.gZenUIManager.showToast(messageId, {
      timeout: 4000,
    });
  }

  #extractHost(value) {
    try {
      return Services.io.newURI(value).host;
    } catch {
      return "";
    }
  }

  #extractExtension(value) {
    const lower = String(value || "").toLowerCase();
    const lastDot = lower.lastIndexOf(".");
    if (lastDot < 0) {
      return "";
    }
    const extension = lower.slice(lastDot);
    return extension.split(/[?#]/)[0];
  }
}

new nsZenSmartGuard();
