// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  ZenLiveFoldersManager: "resource:///modules/zen/ZenLiveFoldersManager.sys.mjs",
});

ChromeUtils.defineLazyGetter(
  lazy,
  "l10n",
  () => new Localization(["browser/zen-live-folders.ftl"])
);

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

    Promise.all([
      window.gZenWorkspaces.promiseInitialized,
      lazy.ZenLiveFoldersManager.stateRestored.promise,
    ]).then(() => {
      for (const liveFolder of lazy.ZenLiveFoldersManager.liveFolders.values()) {
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

  #createXULElement(tagName) {
    return window.MozXULElement.parseXULToFragment(`<${tagName} />`).firstElementChild;
  }

  #escapeXULAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  #createMenuItem(option) {
    // Only bake in label when not using Fluent (avoids empty data-l10n-id overwrite).
    if (option.label && !option.l10nId) {
      const label = this.#escapeXULAttribute(option.label);
      return window.MozXULElement.parseXULToFragment(`<menuitem label="${label}" />`)
        .firstElementChild;
    }
    return this.#createXULElement("menuitem");
  }

  async #setMenuLabel(element, option) {
    element.removeAttribute("data-l10n-id");
    element.removeAttribute("data-l10n-args");

    if (option.label && !option.l10nId) {
      element.setAttribute("label", option.label);
      return;
    }

    if (option.l10nId) {
      try {
        const [message] = await lazy.l10n.formatMessages([
          { id: option.l10nId, args: option.l10nArgs ?? undefined },
        ]);
        const labelAttr = message?.attributes?.find(attr => attr.name === "label");
        if (labelAttr?.value) {
          element.setAttribute("label", labelAttr.value);
          return;
        }
      } catch (ex) {
        console.error("Live folder menu l10n failed:", option.l10nId, ex);
      }
    }

    if (option.label) {
      element.setAttribute("label", option.label);
    }
  }

  #applyMenuItemAttributes(menuItem, option, folderId) {
    if (option.type) {
      menuItem.setAttribute("type", option.type);
    }

    if (option.checked !== undefined) {
      // XUL treats any present "checked" attribute as on — remove it when false.
      if (option.checked) {
        menuItem.setAttribute("checked", "true");
      } else {
        menuItem.removeAttribute("checked");
      }
    }

    if (option.type === "radio" && option.key) {
      menuItem.setAttribute("name", option.key);
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

  async #appendOptions(parentPopup, options, folderId) {
    for (const option of options) {
      if (option.type === "separator") {
        parentPopup.appendChild(this.#createXULElement("menuseparator"));
        continue;
      }

      if (option.options) {
        const menuFragment = window.MozXULElement.parseXULToFragment(
          "<menu><menupopup></menupopup></menu>"
        );
        const menu = menuFragment.firstElementChild;
        const subPopup = menu.querySelector("menupopup");
        this.#applyMenuItemAttributes(menu, option, folderId);
        await this.#setMenuLabel(menu, option);

        await this.#appendOptions(subPopup, option.options, folderId);

        parentPopup.appendChild(menu);
        continue;
      }

      const menuItem = this.#createMenuItem(option);
      this.#applyMenuItemAttributes(menuItem, option, folderId);
      await this.#setMenuLabel(menuItem, option);

      if (option.value !== undefined) {
        menuItem.setAttribute("option-value", option.value);
      }

      parentPopup.appendChild(menuItem);
    }
  }

  async buildContextMenu(folder) {
    const optionsElement = window.document.getElementById("context_zenLiveFolderOptions");

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

      await this.#appendOptions(popup, contextMenuItems, folder.id);
      hidden = false;
    }

    optionsElement.hidden = hidden;
    window.document.getElementById("live-folder-separator").hidden = hidden;
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
