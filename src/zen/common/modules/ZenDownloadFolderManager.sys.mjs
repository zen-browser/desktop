/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const DOWNLOAD_FOLDERS_PREF = "zen.downloads.container-folders";

class ZenDownloadFolderManager {
  #initialized = false;

  init() {
    if (this.#initialized || !gBrowser?.tabContainer) {
      return;
    }

    this.#initialized = true;
    Services.prefs.addObserver(DOWNLOAD_FOLDERS_PREF, this);
    gBrowser.tabContainer.addEventListener("TabOpen", this);
    gBrowser.tabContainer.addEventListener("TabAttrModified", this);
    gBrowser.tabContainer.addEventListener("SSTabRestoring", this);
    this.applyToAllTabs();
  }

  observe(subject, topic) {
    if (topic == "nsPref:changed") {
      this.applyToAllTabs();
    }
  }

  handleEvent(event) {
    if (
      event.type == "TabOpen" ||
      event.type == "SSTabRestoring" ||
      (event.type == "TabAttrModified" &&
        event.detail?.changed?.includes("usercontextid"))
    ) {
      this.applyToTab(event.target);
    }
  }

  applyToAllTabs() {
    for (const tab of gBrowser?.tabs || []) {
      this.applyToTab(tab);
    }
  }

  applyToTab(tab) {
    const browsingContext = tab?.linkedBrowser?.browsingContext;
    if (!browsingContext) {
      return;
    }

    try {
      browsingContext.top.downloadFolderOverride = this.getFolder(
        tab.userContextId,
      );
    } catch (error) {
      console.error("Failed to set the container download folder", error);
    }
  }

  getFolder(userContextId) {
    let folders;
    try {
      folders = JSON.parse(
        Services.prefs.getStringPref(DOWNLOAD_FOLDERS_PREF, "{}"),
      );
    } catch (error) {
      console.error("Invalid container download folder settings", error);
      return "";
    }

    const folder = folders?.[String(userContextId || 0)];
    return typeof folder == "string" ? folder : "";
  }
}

window.gZenDownloadFolderManager = new ZenDownloadFolderManager();
