// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  ZenLibraryWidget: "moz-src:///zen/library/ZenLibraryWidget.sys.mjs",
});

const kCollapseSidebarWidth = 60;
const kCompactModeHintPref = "zen.view.compact.drag-collapse-hint-seen";
const kCompactModeToggleCommand = "cmd_toggleCompactModeIgnoreHover";

export const ZenCustomizableUI = new (class {
  constructor() {}

  TYPE_TOOLBAR = "toolbar";
  defaultSidebarIcons = [
    Services.prefs.getBoolPref("zen.library.enabled")
      ? "zen-library-button"
      : "downloads-button",
    "zen-workspaces-button",
    "zen-create-new-button",
  ];

  startup(CustomizableUIInternal) {
    CustomizableUIInternal.createBuiltinWidget(lazy.ZenLibraryWidget);
    CustomizableUIInternal.registerArea(
      "zen-sidebar-top-buttons",
      {
        type: this.TYPE_TOOLBAR,
        defaultPlacements: ["zen-toggle-compact-mode"],
        defaultCollapsed: null,
        overflowable: true,
      },
      true
    );
    CustomizableUIInternal.registerArea(
      "zen-sidebar-foot-buttons",
      {
        type: this.TYPE_TOOLBAR,
        defaultPlacements: this.defaultSidebarIcons,
        defaultCollapsed: null,
      },
      true
    );
  }

  // We do not have access to the window object here
  init(window) {
    this.#addSidebarButtons(window);
    this.#modifyToolbarButtons(window);
  }

  #addSidebarButtons(window) {
    const kDefaultSidebarWidth =
      AppConstants.platform === "macosx" ? "230px" : "186px";
    const toolbox = window.gNavToolbox;

    // Set a splitter to navigator-toolbox
    const splitter = window.document.createElement("div");
    splitter.id = "zen-sidebar-splitter";
    splitter.setAttribute("role", "separator");
    splitter.setAttribute("aria-orientation", "vertical");
    splitter.setAttribute("aria-controls", toolbox.id);
    toolbox.appendChild(splitter);

    const sidebarBox = window.MozXULElement.parseXULToFragment(`
      <toolbar id="zen-sidebar-top-buttons"
        fullscreentoolbar="true"
        class="browser-toolbar customization-target"
        brighttext="true"
        data-l10n-id="tabs-toolbar"
        customizable="true"
        context="toolbar-context-menu"
        flex="1"
        skipintoolbarset="true"
        customizationtarget="zen-sidebar-top-buttons-customization-target"
        overflowable="true"
        default-overflowbutton="nav-bar-overflow-button"
        default-overflowtarget="widget-overflow-list"
        default-overflowpanel="widget-overflow"
        addon-webext-overflowbutton="zen-site-data-icon-button"
        addon-webext-overflowtarget="overflowed-extensions-list"
        mode="icons">
        <hbox id="zen-sidebar-top-buttons-customization-target" class="customization-target" flex="1">
          <toolbaritem id="zen-toggle-compact-mode" removable="true" data-l10n-id="zen-toggle-compact-mode-button">
            <toolbarbutton
              class="toolbarbutton-1"
              command="cmd_toggleCompactModeIgnoreHover"
              data-l10n-id="zen-toggle-compact-mode-button"
              flex="1" />
          </toolbaritem>
          <html:div id="zen-sidebar-top-buttons-separator" skipintoolbarset="true" overflows="false"></html:div>
        </hbox>
      </toolbar>
    `);
    toolbox.prepend(sidebarBox);

    // remove all styles except for the width, since we are xulstoring the complet style list
    const width = toolbox.style.width || kDefaultSidebarWidth;
    toolbox.removeAttribute("style");
    toolbox.style.width = width;
    toolbox.style.setProperty("--zen-sidebar-width", width);
    toolbox.setAttribute("width", width);

    this.#initSidebarResizer(window, splitter, toolbox, kDefaultSidebarWidth);

    const newTab = window.document.getElementById(
      "vertical-tabs-newtab-button"
    );
    newTab.classList.add("zen-sidebar-action-button");

    for (let id of this.defaultSidebarIcons) {
      const elem = window.document.getElementById(id);
      if (!elem || elem.id === "zen-workspaces-button") {
        continue;
      }
      elem.setAttribute("removable", "true");
    }

    this.#initCreateNewButton(window);
    this.#moveWindowButtons(window);
  }

  #initSidebarResizer(window, splitter, toolbox, defaultWidth) {
    const setWidth = width => {
      if (window.gZenCompactModeManager.preference) {
        width -= window.ZenThemeModifier.elementSeparation * 2;
      }
      const value = `${Math.round(width)}px`;
      toolbox.style.width = value;
      toolbox.style.setProperty("--zen-sidebar-width", value);
      toolbox.setAttribute("width", value);
      this.#dispatchResizeEvent(window);
    };

    const getWidthLimits = () => {
      const min = parseFloat(
        toolbox.style.getPropertyValue("--zen-toolbox-min-width")
      );
      const max = parseFloat(toolbox.style.maxWidth);
      return {
        min: Number.isFinite(min) ? min : 0,
        max: Number.isFinite(max) ? max : Infinity,
      };
    };

    let drag = null;
    let frame = 0;
    let pointerX = 0;

    const endDrag = settle => {
      if (!drag) {
        return;
      }
      const { pointerId, moved, reveal } = drag;
      drag = null;
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      if (splitter.hasPointerCapture(pointerId)) {
        splitter.releasePointerCapture(pointerId);
      }
      splitter.removeAttribute("zen-resizing");
      window.setCursor("auto");
      if (settle && moved && !reveal) {
        setWidth(toolbox.getBoundingClientRect().width);
      }
    };

    const applyDrag = () => {
      frame = 0;
      if (!drag) {
        return;
      }
      const width = drag.startWidth + drag.direction * (pointerX - drag.startX);
      if (drag.reveal) {
        if (width < kCollapseSidebarWidth) {
          return;
        }
        drag.reveal = false;
        this.#toggleCompactMode(window);
      } else if (
        width < kCollapseSidebarWidth &&
        !window.gZenCompactModeManager.preference
      ) {
        setWidth(drag.startWidth);
        drag.reveal = true;
        this.#collapseSidebarIntoCompactMode(window);
        return;
      }
      setWidth(Math.min(drag.max, Math.max(drag.min, width)));
    };

    splitter.addEventListener("pointerdown", event => {
      if (event.button !== 0 || drag) {
        return;
      }
      const toolboxRect = window.windowUtils.getBoundsWithoutFlushing(toolbox);
      const rightSide =
        window.document.documentElement.hasAttribute("zen-right-side");
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: toolboxRect.width,
        direction: rightSide ? -1 : 1,
        ...getWidthLimits(),
      };
      pointerX = event.clientX;
      event.preventDefault();
      splitter.setPointerCapture(event.pointerId);
      splitter.setAttribute("zen-resizing", "true");
      window.setCursor("ew-resize");
    });

    splitter.addEventListener("pointermove", event => {
      if (!drag) {
        return;
      }
      pointerX = event.clientX;
      drag.moved = true;
      if (!frame) {
        frame = window.requestAnimationFrame(applyDrag);
      }
    });

    splitter.addEventListener("lostpointercapture", () => endDrag(true));
    splitter.addEventListener("pointerup", () => endDrag(true));

    splitter.addEventListener("dragover", event => {
      window.gBrowser.tabContainer.handleEvent(event);
    });

    splitter.addEventListener("dblclick", event => {
      if (event.button !== 0) {
        return;
      }
      toolbox.style.width = defaultWidth;
      toolbox.setAttribute("width", defaultWidth);
    });
  }

  /**
   * Enables compact mode after the sidebar was dragged closed, and tells the user
   * once how to get it back, since the sidebar is the thing that just went away.
   *
   * @param {Window} window
   */
  #toggleCompactMode(window) {
    window.gZenCompactModeManager._preventAnimateCollapse = true;
    window.document.getElementById(kCompactModeToggleCommand).doCommand();
  }

  #collapseSidebarIntoCompactMode(window) {
    this.#toggleCompactMode(window);
    if (Services.prefs.getBoolPref(kCompactModeHintPref, false)) {
      return;
    }
    const shortcut =
      window.gZenKeyboardShortcutsManager?.getShortcutDisplayFromCommand(
        kCompactModeToggleCommand
      );
    if (!shortcut) {
      return;
    }
    Services.prefs.setBoolPref(kCompactModeHintPref, true);
    window.gZenUIManager.showToast("zen-sidebar-drag-collapsed-toast", {
      l10nArgs: { shortcut },
      timeout: 5000,
    });
  }

  #initCreateNewButton(window) {
    const button = window.document.getElementById("zen-create-new-button");
    // If we use "mousedown" event for private windows (which open a new tab on "click"), we might end up with
    // the urlbar flicking and therefore we use "command" event to avoid that.
    let isPrivateMode = window.gZenWorkspaces.privateWindowOrDisabled;
    button.addEventListener(isPrivateMode ? "command" : "mousedown", event => {
      if (isPrivateMode) {
        window.document.getElementById("cmd_newNavigatorTab").doCommand();
        return;
      }
      if (button.hasAttribute("open")) {
        return;
      }
      const popup = window.document.getElementById("zenCreateNewPopup");
      popup.openPopup(
        button,
        "before_start",
        0,
        0,
        true /* isContextMenu */,
        false /* attributesOverride */,
        event
      );
    });
  }

  #moveWindowButtons(window) {
    const windowControls = window.document.getElementsByClassName(
      "titlebar-buttonbox-container"
    );
    const toolboxIcons = window.document.getElementById(
      "zen-sidebar-top-buttons-customization-target"
    );
    if (
      window.AppConstants.platform === "macosx" ||
      window.matchMedia("(-moz-gtk-csd-reversed-placement)").matches
    ) {
      for (let i = 0; i < windowControls.length; i++) {
        if (i === 0) {
          toolboxIcons.prepend(windowControls[i]);
          continue;
        }
        windowControls[i].remove();
      }
    }
  }

  #modifyToolbarButtons(window) {
    const wrapper = window.document.getElementById("zen-sidebar-foot-buttons");
    const elementsToHide = ["new-tab-button"];
    for (let id of elementsToHide) {
      const elem = window.document.getElementById(id);
      if (elem) {
        wrapper.prepend(elem);
      }
    }
    window.document
      .getElementById("stop-reload-button")
      .removeAttribute("overflows");
  }

  #dispatchResizeEvent(window) {
    window.dispatchEvent(new window.Event("resize"));
  }

  registerToolbarNodes(window) {
    window.CustomizableUI.registerToolbarNode(
      window.document.getElementById("zen-sidebar-top-buttons")
    );
    window.CustomizableUI.registerToolbarNode(
      window.document.getElementById("zen-sidebar-foot-buttons")
    );
  }
})();
