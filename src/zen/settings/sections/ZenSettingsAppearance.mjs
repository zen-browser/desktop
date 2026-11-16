/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const kSingleToolbarPref = "zen.view.use-single-toolbar";
const kExpandedSidebarPref = "zen.view.sidebar-expanded";

export class ZenSettingsAppearance {
  constructor(settings) {
    this.settings = settings;
    this.#initLayout();
  }

  #initLayout() {
    const group = document.getElementById("zen-settings-layout");
    const options = [...group.querySelectorAll(".zen-settings-layout-option")];
    const currentLayout = () => {
      if (!Services.prefs.getBoolPref(kExpandedSidebarPref, true)) {
        return "collapsed";
      }
      return Services.prefs.getBoolPref(kSingleToolbarPref, true)
        ? "single"
        : "multiple";
    };
    const select = layout => {
      Services.prefs.setBoolPref(kExpandedSidebarPref, layout != "collapsed");
      Services.prefs.setBoolPref(kSingleToolbarPref, layout == "single");
    };
    this.settings.watchPrefs([kSingleToolbarPref, kExpandedSidebarPref], () => {
      const layout = currentLayout();
      group.dataset.value = layout;
      for (const option of options) {
        const isSelected = option.dataset.layout == layout;
        option.setAttribute("aria-checked", isSelected);
        option.tabIndex = isSelected ? 0 : -1;
      }
    });
    group.addEventListener("click", event => {
      const option = event.target.closest(".zen-settings-layout-option");
      if (option) {
        select(option.dataset.layout);
      }
    });
    group.addEventListener("keydown", event => {
      const offset = {
        ArrowRight: 1,
        ArrowDown: 1,
        ArrowLeft: -1,
        ArrowUp: -1,
      }[event.key];
      const index = options.indexOf(document.activeElement);
      const next = options[index + offset];
      if (offset && next) {
        event.preventDefault();
        next.focus();
        select(next.dataset.layout);
      }
    });
  }
}
