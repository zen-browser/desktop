// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  ZenLiveFoldersManager: "resource:///modules/zen/ZenLiveFoldersManager.sys.mjs",
});

class nsZenLiveFoldersUI {
  init() {
    const popup = window.document
      .getElementById("context_zenLiveFolderOptions")
      .querySelector("menupopup");

    popup.addEventListener("command", (event) => {
      const option = event.target;

      const folderId = option.getAttribute("option-folder");
      if (folderId) {
        const folder = lazy.ZenLiveFoldersManager.getFolder(folderId);
        if (folder && typeof folder.onOptionTrigger === "function") {
          folder.onOptionTrigger(option);
        }
      }
    });

    window.gZenWorkspaces.promiseInitialized.finally(() => {
      const manager = lazy.ZenLiveFoldersManager;

      for (const liveFolder of manager.liveFolders.values()) {
        this.#restoreUIStateForLiveFolder(liveFolder);
      }
    });
  }

  #restoreUIStateForLiveFolder(liveFolder) {
    const folder = window.gZenWorkspaces.allTabGroups.find((x) => x.id === liveFolder.id);
    if (!folder) {
      return;
    }

    const btn = folder.resetButton;
    if (!btn) {
      return;
    }

    for (const { itemId, label } of liveFolder.tabsState) {
      const tab = folder.tabs.find((t) => t.getAttribute("zen-live-folder-item-id") === itemId);
      if (tab && label) {
        const tabLabel = tab.querySelector(".zen-tab-sublabel");
        tab.setAttribute("zen-show-sublabel", label);

        window.document.l10n.setArgs(tabLabel, {
          tabSubtitle: label,
        });
      }
    }

    const errorId = liveFolder.state.lastErrorId;
    if (errorId) {
      btn.setAttribute("data-l10n-id", errorId);
      btn.setAttribute("live-folder-action", liveFolder.id);
      return;
    }

    btn.setAttribute("data-l10n-id", "zen-folders-unload-all-tooltip");
    btn.removeAttribute("live-folder-action");
  }

  #applyMenuItemAttributes(menuItem, option, folderId) {
    menuItem.setAttribute("data-l10n-id", option.l10nId);

    if (option.checked !== undefined) {
      menuItem.setAttribute("checked", option.checked);
      menuItem.setAttribute("type", option.type ?? "checkbox");
    }

    if (option.l10nArgs) {
      menuItem.setAttribute("data-l10n-args", JSON.stringify(option.l10nArgs));
    }

    menuItem.setAttribute("option-folder", folderId);
    menuItem.setAttribute("option-key", option.key);
    if (option.disabled) {
      menuItem.setAttribute("disabled", "true");
    }
    if (option.hidden) {
      menuItem.setAttribute("hidden", "true");
    }
  }

  #appendOptions(parentPopup, options, folderId) {
    for (const option of options) {
      if (option.type === "separator") {
        parentPopup.appendChild(document.createXULElement("menuseparator"));
        continue;
      }

      if (option.options) {
        const menu = document.createXULElement("menu");
        this.#applyMenuItemAttributes(menu, option, folderId);

        const subPopup = document.createXULElement("menupopup");
        this.#appendOptions(subPopup, option.options, folderId);

        menu.appendChild(subPopup);
        parentPopup.appendChild(menu);
        continue;
      }

      const menuItem = document.createXULElement("menuitem");
      this.#applyMenuItemAttributes(menuItem, option, folderId);

      if (option.value !== undefined) {
        menuItem.setAttribute("option-value", option.value);
      }

      parentPopup.appendChild(menuItem);
    }
  }

  buildContextMenu(folder) {
    const optionsElement = document.getElementById("context_zenLiveFolderOptions");

    let hidden = true;
    if (folder.isLiveFolder) {
      const popup = optionsElement.querySelector("menupopup");
      const liveFolder = lazy.ZenLiveFoldersManager.getFolder(folder.id);

      const MINUTE_MS = 60 * 1000;
      const HOUR_MS = 60 * MINUTE_MS;

      let intervals = [];
      for (let mins = 15; mins <= 30; mins *= 2) {
        intervals.push({ mins });
      }

      for (let hours = 1; hours <= 8; hours *= 2) {
        intervals.push({ hours });
      }

      intervals = intervals.map((entry) => {
        const ms = "mins" in entry ? entry.mins * MINUTE_MS : entry.hours * HOUR_MS;

        return {
          l10nId:
            "mins" in entry
              ? "zen-live-folder-fetch-interval-mins"
              : "zen-live-folder-fetch-interval-hours",
          l10nArgs: entry,

          type: "radio",
          checked: liveFolder.state.interval === ms,

          key: "setInterval",
          value: ms,
        };
      });

      const contextMenuItems = [
        {
          key: "lastFetched",
          l10nId: liveFolder.state.lastErrorId || "zen-live-folder-last-fetched",
          l10nArgs: { time: this.#timeAgo(liveFolder.state.lastFetched) },
          disabled: true,
        },
        {
          key: "setInterval",
          l10nId: "zen-live-folder-option-fetch-interval",
          options: intervals,
        },
        {
          key: "refresh",
          l10nId: "zen-live-folder-refresh",
        },
        { type: "separator" },
        ...liveFolder.options,
      ];

      popup.innerHTML = "";

      this.#appendOptions(popup, contextMenuItems, folder.id);
      hidden = false;
    }

    optionsElement.hidden = hidden;
    document.getElementById("live-folder-separator").hidden = hidden;
  }

  #timeAgo(date) {
    if (date === 0) {
      return "-";
    }

    const rtf = new Intl.RelativeTimeFormat(Services.locale.appLocaleAsBCP47, { numeric: "auto" });
    const secondsDiff = (date - Date.now()) / 1000;
    const absSeconds = Math.abs(secondsDiff);

    const ranges = {
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1,
    };

    if (Number.isFinite(secondsDiff)) {
      for (const [key, value] of Object.entries(ranges)) {
        if (absSeconds >= value) {
          return rtf.format(Math.round(secondsDiff / value), key);
        }
      }

      return rtf.format(Math.round(secondsDiff), "second");
    }

    return "-";
  }
}

window.gZenLiveFoldersUI = new nsZenLiveFoldersUI();
