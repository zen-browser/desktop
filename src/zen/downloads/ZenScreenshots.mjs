// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";
import {
  SCREENSHOT_FOLDER_PREF,
  scanScreenshots,
  screenshotDirectory,
  screenshotFile,
} from "chrome://browser/content/zen-components/ZenScreenshotFiles.mjs";

export class ZenScreenshots extends nsZenDOMOperatedFeature {
  #section;
  #rows;
  #status;
  #choose;
  #disconnect;
  #timer;
  #generation = 0;
  #open = false;
  #destroyed = false;
  #choosing = false;
  #signature = "";
  #dragging = false;

  init() {
    if (PrivateBrowsingUtils.isWindowPrivate(window)) {
      return;
    }
    document.addEventListener("popupshowing", this);
    document.addEventListener("popuphidden", this);
    window.addEventListener("unload", this, { once: true });
    Services.prefs.addObserver(SCREENSHOT_FOLDER_PREF, this);
  }

  handleEvent(event) {
    if (event.type === "unload") {
      this.#destroyed = true;
      this.#stop();
      Services.prefs.removeObserver(SCREENSHOT_FOLDER_PREF, this);
      document.removeEventListener("popupshowing", this);
      document.removeEventListener("popuphidden", this);
    } else if (event.target.id === "downloadsPanel") {
      if (event.type === "popupshowing") {
        this.#createSection();
        this.#open = true;
        this.#refresh();
      } else {
        this.#open = false;
        this.#stop();
        this.#rows.replaceChildren();
        this.#signature = "";
        this.#dragging = false;
      }
    }
  }

  observe() {
    this.#stop();
    this.#rows?.replaceChildren();
    this.#signature = "";
    if (this.#open) {
      this.#refresh();
    }
  }

  #stop() {
    this.#generation++;
    window.clearTimeout(this.#timer);
  }

  #createSection() {
    if (this.#section) {
      return;
    }
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "chrome://browser/content/zen-styles/zen-screenshots.css";
    document.documentElement.appendChild(style);
    this.#section = document.createElement("section");
    this.#section.id = "zen-screenshots";
    this.#section.setAttribute("aria-labelledby", "zen-screenshots-heading");
    const heading = document.createElement("h2");
    heading.id = "zen-screenshots-heading";
    document.l10n.setAttributes(heading, "zen-screenshots-heading");
    this.#status = document.createElement("p");
    this.#status.setAttribute("role", "status");
    this.#rows = document.createElement("div");
    this.#rows.id = "zen-screenshots-files";
    const controls = document.createElement("div");
    controls.className = "zen-screenshots-controls";
    this.#choose = document.createElement("button");
    this.#choose.type = "button";
    this.#choose.addEventListener("click", (event) => {
      if (event.isTrusted) {
        this.#chooseFolder();
      }
    });
    this.#disconnect = document.createElement("button");
    this.#disconnect.type = "button";
    document.l10n.setAttributes(this.#disconnect, "zen-screenshots-disconnect");
    this.#disconnect.addEventListener("click", (event) => {
      if (event.isTrusted) {
        Services.prefs.clearUserPref(SCREENSHOT_FOLDER_PREF);
      }
    });
    controls.append(this.#choose, this.#disconnect);
    this.#section.append(heading, this.#status, this.#rows, controls);
    // Keep these files outside DownloadsView and all of its commands/history.
    document.getElementById("downloadsFooter").before(this.#section);
    this.#section.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" && event.key !== "Tab") {
        event.stopPropagation();
      }
    });
    this.#section.addEventListener("dragend", () => {
      this.#dragging = false;
    });
  }

  async #chooseFolder() {
    if (this.#choosing) {
      return;
    }
    this.#choosing = true;
    try {
      const title = await document.l10n.formatValue(
        "zen-screenshots-picker-title",
      );
      if (this.#destroyed) {
        return;
      }
      const picker = Cc["@mozilla.org/filepicker;1"].createInstance(
        Ci.nsIFilePicker,
      );
      picker.init(
        window.browsingContext,
        title,
        Ci.nsIFilePicker.modeGetFolder,
      );
      const result = await new Promise((resolve) => picker.open(resolve));
      if (this.#destroyed || result !== Ci.nsIFilePicker.returnOK) {
        return;
      }
      const folder = picker.file;
      folder.normalize();
      screenshotDirectory(folder.path);
      Services.prefs.setStringPref(SCREENSHOT_FOLDER_PREF, folder.path);
    } catch {
      if (!this.#destroyed) {
        this.#setStatus("zen-screenshots-unavailable");
      }
    } finally {
      this.#choosing = false;
    }
  }

  #setStatus(id) {
    this.#status.hidden = !id;
    if (id) {
      document.l10n.setAttributes(this.#status, id);
    }
  }

  async #refresh() {
    this.#stop();
    const generation = this.#generation;
    const isCurrent = () =>
      !this.#destroyed && this.#open && generation === this.#generation;
    const folder = Services.prefs.getStringPref(SCREENSHOT_FOLDER_PREF, "");
    document.l10n.setAttributes(
      this.#choose,
      folder
        ? "zen-screenshots-change-folder"
        : "zen-screenshots-choose-folder",
    );
    this.#disconnect.hidden = !folder;
    if (!folder) {
      this.#rows.replaceChildren();
      this.#setStatus("zen-screenshots-description");
      return;
    }
    try {
      const files = await scanScreenshots(folder, isCurrent);
      if (!isCurrent()) {
        return;
      }
      this.#setStatus(files.length ? "" : "zen-screenshots-empty");
      const signature = JSON.stringify(
        files.map((file) => [file.path, file.size, file.lastModified]),
      );
      if (signature !== this.#signature && !this.#dragging) {
        const focusedPath = document.activeElement?.dataset.screenshotPath;
        const rows = files.map((info) => this.#createRow(folder, info));
        this.#rows.replaceChildren(...rows);
        this.#signature = signature;
        if (focusedPath) {
          (
            rows.find((row) => row.dataset.screenshotPath === focusedPath) ||
            this.#choose
          ).focus();
        }
      }
    } catch {
      if (!isCurrent()) {
        return;
      }
      this.#rows.replaceChildren();
      this.#signature = "";
      this.#setStatus("zen-screenshots-unavailable");
    }
    if (isCurrent()) {
      this.#timer = window.setTimeout(() => this.#refresh(), 2000);
    }
  }

  #createRow(folder, info) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "zen-screenshot-file";
    row.draggable = true;
    row.dataset.screenshotPath = info.path;
    // Filenames are untrusted text, never markup, URLs, or image previews.
    row.textContent = PathUtils.filename(info.path);
    document.l10n.setAttributes(row, "zen-screenshots-file");
    const getFile = () => {
      if (folder !== Services.prefs.getStringPref(SCREENSHOT_FOLDER_PREF, "")) {
        throw new Error("Screenshot folder changed");
      }
      return screenshotFile(folder, info.path);
    };
    row.addEventListener("click", (event) => {
      if (!event.isTrusted) {
        return;
      }
      try {
        getFile().reveal();
      } catch {
        this.#refresh();
      }
    });
    row.addEventListener("dragstart", (event) => {
      event.stopPropagation();
      if (!event.isTrusted) {
        event.preventDefault();
        return;
      }
      try {
        const file = getFile();
        event.dataTransfer.mozSetDataAt("application/x-moz-file", file, 0);
        event.dataTransfer.effectAllowed = "copy";
        this.#dragging = true;
      } catch {
        event.preventDefault();
        this.#refresh();
      }
    });
    return row;
  }
}

new ZenScreenshots();
