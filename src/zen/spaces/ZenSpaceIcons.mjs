/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class nsZenWorkspaceIcons extends MozXULElement {
  #hasConnected = false;
  #addChip = null;

  connectedCallback() {
    if (this.delayConnectedCallback() || this.#hasConnected) {
      return;
    }

    this.#hasConnected = true;
    window.addEventListener("ZenWorkspacesUIUpdate", this, true);

    this.initDragAndDrop();
    this.addEventListener("mouseover", e => {
      if (this.isReorderMode) {
        return;
      }
      const target = e.target.closest("toolbarbutton[zen-workspace-id]");
      if (target) {
        this.scrollLeft = target.offsetLeft - 10;
      }
    });
  }

  initDragAndDrop() {
    let dragStart = 0;
    let draggedTab = null;

    this.addEventListener("mousedown", e => {
      const target = e.target.closest("toolbarbutton[zen-workspace-id]");
      if (!target || e.button != 0 || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const isVertical =
        document.documentElement.getAttribute("zen-sidebar-expanded") != "true";
      const clientPos = isVertical ? "clientY" : "clientX";

      this.isReorderMode = false;
      dragStart = e[clientPos];
      draggedTab = target;
      draggedTab.setAttribute("dragged", "true");

      e.stopPropagation();

      const mouseMoveHandler = moveEvent => {
        if (Math.abs(moveEvent[clientPos] - dragStart) > 5) {
          this.isReorderMode = true;
        }

        if (this.isReorderMode) {
          const tabs = [...this.children].filter(
            el => el.hasAttribute("zen-workspace-id")
          );
          const mouse = moveEvent[clientPos];

          for (const tab of tabs) {
            if (tab === draggedTab) {
              continue;
            }
            const rect = tab.getBoundingClientRect();
            if (
              mouse > rect[isVertical ? "top" : "left"] &&
              mouse < rect[isVertical ? "bottom" : "right"]
            ) {
              const nextSibling = draggedTab.nextSibling;
              if (
                mouse <
                rect[isVertical ? "top" : "left"] +
                  rect[isVertical ? "height" : "width"] / 2
              ) {
                this.insertBefore(draggedTab, tab);
              } else {
                this.insertBefore(draggedTab, tab.nextSibling);
              }
              if (nextSibling !== draggedTab.nextSibling) {
                /* eslint-disable mozilla/valid-services */
                Services.zen.playHapticFeedback();
              }
            }
          }
        }
      };

      const mouseUpHandler = () => {
        document.removeEventListener("mousemove", mouseMoveHandler);
        document.removeEventListener("mouseup", mouseUpHandler);

        draggedTab.removeAttribute("dragged");

        this.reorderWorkspaceToIndex(
          draggedTab,
          Array.from(this.querySelectorAll("[zen-workspace-id]")).indexOf(
            draggedTab
          )
        );

        draggedTab = null;
        this.isReorderMode = false;
      };

      document.addEventListener("mousemove", mouseMoveHandler);
      document.addEventListener("mouseup", mouseUpHandler);
    });
  }

  #createWorkspaceIcon(workspace) {
    const button = document.createXULElement("toolbarbutton");
    button.setAttribute("class", "subviewbutton toolbarbutton-1");
    button.setAttribute("tooltiptext", workspace.name);
    button.setAttribute("zen-workspace-id", workspace.uuid);
    button.setAttribute("context", "zenWorkspaceMoreActions");
    const icon = document.createXULElement("label");
    icon.setAttribute("class", "zen-workspace-icon");
    const isValidIcon =
      gZenWorkspaces.workspaceHasIcon(workspace) &&
      window.gZenEmojiPicker?.isValidWorkspaceIcon(workspace.icon);
    const isSvgIcon = isValidIcon && workspace.icon.endsWith(".svg");
    if (isValidIcon) {
      if (isSvgIcon) {
        const image = document.createElement("img");
        image.src = workspace.icon;
        image.classList.add("zen-workspace-icon");
        image.onerror = () => {
          image.remove();
          icon.setAttribute("no-icon", "true");
          button.appendChild(icon);
        };
        button.appendChild(image);
      } else {
        icon.textContent = workspace.icon;
      }
    } else {
      icon.setAttribute("no-icon", "true");
    }
    if (!isSvgIcon) {
      button.appendChild(icon);
    }
    button.addEventListener("command", this);
    button.addEventListener("auxclick", e => {
      if (e.button !== 1) {
        return;
      }
      // Middle-click is unused on Space icons; dedicated Peek entry (focuses search).
      e.preventDefault();
      e.stopPropagation();
      const id = button.getAttribute("zen-workspace-id");
      if (id) {
        void gZenWorkspaces.openAstraSpacePeekFor(id, button, {
          focusSearch: true,
        });
      }
    });
    // Hover Peek after delay — does not steal click-to-switch or move focus.
    let hoverTimer = null;
    button.addEventListener("mouseenter", () => {
      if (this.isReorderMode) {
        return;
      }
      if (document.documentElement.hasAttribute("zen-compact-animating")) {
        return;
      }
      if (document.querySelector("panel[panelopen=true], menupopup[open=true]")) {
        return;
      }
      hoverTimer = setTimeout(() => {
        hoverTimer = null;
        if (this.isReorderMode) {
          return;
        }
        if (document.documentElement.hasAttribute("zen-compact-animating")) {
          return;
        }
        if (
          document.querySelector("panel[panelopen=true], menupopup[open=true]")
        ) {
          return;
        }
        const id = button.getAttribute("zen-workspace-id");
        if (id && id !== gZenWorkspaces.activeWorkspace) {
          void gZenWorkspaces.openAstraSpacePeekFor(id, button, {
            focusSearch: false,
          });
        }
      }, 650);
    });
    button.addEventListener("mouseleave", () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
    });
    return button;
  }

  #ensureAddChip() {
    if (this.#addChip?.isConnected) {
      return this.#addChip;
    }
    const chip = document.createXULElement("toolbarbutton");
    chip.classList.add(
      "subviewbutton",
      "toolbarbutton-1",
      "zen-workspace-add-chip"
    );
    chip.setAttribute("context", "zenSpaceQuickMenu");
    document.l10n.setAttributes(chip, "zen-spaces-add-chip");
    chip.addEventListener("click", event => {
      event.stopPropagation();
      const popup = document.getElementById("zenSpaceQuickMenu");
      if (popup) {
        popup.openPopup(chip, "after_start");
      }
    });
    this.#addChip = chip;
    return chip;
  }

  async #updateIcons() {
    const workspaces = gZenWorkspaces.getWorkspaces();
    this.innerHTML = "";
    for (const workspace of workspaces) {
      const button = this.#createWorkspaceIcon(workspace);
      this.appendChild(button);
    }
    this.appendChild(this.#ensureAddChip());
    this.removeAttribute("dont-show");
    this.toggleAttribute("astra-single-space", workspaces.length <= 1);
    gZenWorkspaces.onWindowResize();
  }

  on_command(event) {
    const button = event.target;
    const uuid = button.getAttribute("zen-workspace-id");
    if (uuid) {
      void gZenWorkspaces.switchSpaceSafely(uuid);
    }
  }

  async on_ZenWorkspacesUIUpdate(event) {
    await this.#updateIcons();
    this.activeIndex = event.detail.activeIndex;
  }

  set activeIndex(uuid) {
    const buttons = this.querySelectorAll("[zen-workspace-id]");
    if (!buttons.length) {
      return;
    }
    let i = 0;
    let selected = -1;
    for (const button of buttons) {
      if (button.getAttribute("zen-workspace-id") == uuid) {
        selected = i;
      } else {
        button.removeAttribute("active");
      }
      i++;
    }
    if (selected == -1) {
      return;
    }
    buttons[selected].setAttribute("active", "true");
    this.scrollLeft = buttons[selected].offsetLeft - 10;
    this.setAttribute("selected", selected);
  }

  get activeIndex() {
    const selected = this.getAttribute("selected");
    const buttons = this.querySelectorAll("[zen-workspace-id]");
    let i = 0;
    for (const button of buttons) {
      if (i == selected) {
        return button.getAttribute("zen-workspace-id");
      }
      i++;
    }
    return null;
  }

  get isReorderMode() {
    return this.hasAttribute("reorder-mode");
  }

  set isReorderMode(value) {
    if (value) {
      this.setAttribute("reorder-mode", "true");
    } else {
      this.removeAttribute("reorder-mode");
      this.style.removeProperty("--zen-workspace-icon-width");
      this.style.removeProperty("--zen-workspace-icon-height");
    }
  }

  reorderWorkspaceToIndex(draggedTab, index) {
    const workspaceId = draggedTab.getAttribute("zen-workspace-id");
    gZenWorkspaces.reorderWorkspace(workspaceId, index);
  }
}

customElements.define("zen-workspace-icons", nsZenWorkspaceIcons);
