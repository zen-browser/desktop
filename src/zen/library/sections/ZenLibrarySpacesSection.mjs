/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  html,
  repeat,
  styleMap,
} from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

const GRADIENT_TOPIC = "zen-space-gradient-update";
const SCROLL_EDGE_PX = 48;
const SCROLL_STEP_PX = 12;

export class ZenLibrarySpacesSection extends MozLitElement {
  static id = "spaces";
  static label = "library-spaces-section-title";

  static render(library) {
    return html`
      <zen-library-spaces-section
        class="zen-library-section"
        data-section="spaces"
        .library=${library}
      ></zen-library-spaces-section>
    `;
  }

  static properties = {
    renaming: { state: true },
  };

  #observer = { observe: () => this.requestUpdate() };
  #onDataChanged = () => this.requestUpdate();
  #resizeObserver = new ResizeObserver(() => this.#updateLibraryWidth());
  #dragIndex = -1;
  #dropIndex = -1;
  #dragStartX = 0;
  #dragCenterX = 0;
  #dragStartScroll = 0;
  #lastPointerX = 0;
  #scrollFrame = null;
  #slotCenters = [];

  constructor() {
    super();
    this.renaming = null;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("ZenWorkspaceDataChanged", this.#onDataChanged);
    Services.obs.addObserver(this.#observer, GRADIENT_TOPIC);
    this.#resizeObserver.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("ZenWorkspaceDataChanged", this.#onDataChanged);
    Services.obs.removeObserver(this.#observer, GRADIENT_TOPIC);
    this.#resizeObserver.disconnect();
    this.library?.style.removeProperty("--zen-library-content-width");
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    this.#updateLibraryWidth();
    if (changedProperties.has("renaming") && this.renaming) {
      const input = this.querySelector(".zen-library-space-name-input");
      input?.focus();
      input?.select();
    }
  }

  #updateLibraryWidth() {
    const side = this.library?.querySelector("#zen-library-side");
    const list = this.querySelector(".zen-library-spaces");
    if (!side || !list) {
      return;
    }
    const sideWidth = window.windowUtils.getBoundsWithoutFlushing(side).width;
    this.library.style.setProperty(
      "--zen-library-content-width",
      `${sideWidth + list.scrollWidth}px`
    );
  }

  get #cards() {
    return [...this.querySelectorAll(".zen-library-space")];
  }

  // Theme

  #themeStyles(workspace) {
    const { gradient, isDarkMode, isExplicitMode, toolbarColor, primaryColor } =
      gZenThemePicker.getGradientForWorkspace(workspace);
    let colorScheme = "";
    if (isExplicitMode) {
      colorScheme = isDarkMode ? "dark" : "light";
    }
    return {
      "--zen-library-space-gradient": gradient,
      "--zen-primary-color": primaryColor,
      "--toolbox-textcolor": `rgba(${toolbarColor.join(",")})`,
      colorScheme,
    };
  }

  #openThemePicker(workspace, event) {
    gZenThemePicker.openThemePickerForWorkspace(
      workspace,
      event.currentTarget,
      event
    );
  }

  #openActions(event) {
    document
      .getElementById("zenWorkspaceMoreActions")
      .openPopup(event.currentTarget, "after_end");
  }

  // Icon and name

  #changeIcon(workspace, event) {
    gZenEmojiPicker.open(event.currentTarget, {
      closeOnSelect: false,
      allowNone: gZenWorkspaces.workspaceHasIcon(workspace),
      onSelect: async icon => {
        workspace.icon = icon;
        await gZenWorkspaces.saveWorkspace(workspace);
      },
    });
  }

  #commitRename(workspace, event) {
    if (this.renaming !== workspace.uuid) {
      return;
    }
    const newName = event.target.value.trim();
    this.renaming = null;
    if (newName && newName !== workspace.name) {
      workspace.name = newName;
      gZenWorkspaces.saveWorkspace(workspace);
    }
  }

  #onRenameKeyDown(workspace, event) {
    if (event.key === "Enter") {
      this.#commitRename(workspace, event);
    } else if (event.key === "Escape") {
      this.renaming = null;
    }
  }

  #onPointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    const cards = this.#cards;
    const card = event.currentTarget.closest(".zen-library-space");
    this.#dragIndex = cards.indexOf(card);
    this.#dropIndex = this.#dragIndex;
    this.#dragStartX = event.clientX;
    this.#lastPointerX = event.clientX;
    this.#dragStartScroll = this.#list.scrollLeft;
    const cardRect = window.windowUtils.getBoundsWithoutFlushing(card);
    this.#dragCenterX = cardRect.left + cardRect.width / 2;
    this.#slotCenters = cards
      .filter((other, i) => i !== this.#dragIndex)
      .map(other => {
        const rect = window.windowUtils.getBoundsWithoutFlushing(other);
        return rect.left + rect.width / 2;
      });
    card.setAttribute("dragging", "true");
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    this.#autoScroll();
  }

  get #list() {
    return this.querySelector(".zen-library-spaces");
  }

  #onPointerMove(event) {
    if (this.#dragIndex === -1) {
      return;
    }
    this.#lastPointerX = event.clientX;
    this.#updateDrag();
  }

  #updateDrag() {
    const cards = this.#cards;
    const scrolled = this.#list.scrollLeft - this.#dragStartScroll;
    const travel = this.#lastPointerX - this.#dragStartX + scrolled;
    cards[this.#dragIndex].style.translate = `${travel}px 0`;
    const centerX = this.#dragCenterX + travel;
    const index = this.#slotCenters.filter(center => centerX > center).length;
    if (index !== this.#dropIndex) {
      this.#dropIndex = index;
      this.#shiftCards(cards);
    }
  }

  #autoScroll() {
    if (this.#dragIndex === -1) {
      return;
    }
    const list = this.#list;
    const rect = window.windowUtils.getBoundsWithoutFlushing(list);
    let step = 0;
    if (this.#lastPointerX < rect.left + SCROLL_EDGE_PX) {
      step = -SCROLL_STEP_PX;
    } else if (this.#lastPointerX > rect.right - SCROLL_EDGE_PX) {
      step = SCROLL_STEP_PX;
    }
    if (step) {
      const before = list.scrollLeft;
      list.scrollLeft += step;
      if (list.scrollLeft !== before) {
        this.#updateDrag();
      }
    }
    this.#scrollFrame = requestAnimationFrame(() => this.#autoScroll());
  }

  #shiftCards(cards) {
    cards.forEach((card, i) => {
      let shift = "";
      if (this.#dragIndex < i && i <= this.#dropIndex) {
        shift = "left";
      } else if (this.#dropIndex <= i && i < this.#dragIndex) {
        shift = "right";
      }
      if (shift) {
        card.setAttribute("shift", shift);
      } else {
        card.removeAttribute("shift");
      }
    });
  }

  async #onPointerUp(event, workspace) {
    if (this.#dragIndex === -1) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    cancelAnimationFrame(this.#scrollFrame);
    this.#scrollFrame = null;
    const moved =
      this.#dropIndex !== this.#dragIndex && event.type === "pointerup";
    const dropIndex = this.#dropIndex;
    this.#dragIndex = -1;
    this.#dropIndex = -1;

    const list = this.#list;
    list.setAttribute("no-transition", "true");
    if (moved) {
      gZenWorkspaces.reorderWorkspace(workspace.uuid, dropIndex);
      await this.updateComplete;
    }
    for (const card of this.#cards) {
      card.removeAttribute("dragging");
      card.removeAttribute("shift");
      card.style.translate = "";
    }
    await new Promise(resolve => requestAnimationFrame(resolve));
    list.removeAttribute("no-transition");
  }

  #renderIcon(workspace) {
    const hasIcon = gZenWorkspaces.workspaceHasIcon(workspace);
    let content = "";
    if (hasIcon) {
      const icon = gZenWorkspaces.getWorkspaceIcon(workspace);
      content = icon.endsWith(".svg") ? html`<img src=${icon} alt="" />` : icon;
    }
    return html`
      <button
        class="zen-library-space-icon"
        ?no-icon=${!hasIcon}
        data-l10n-id="library-spaces-icon-button"
        @click=${event => this.#changeIcon(workspace, event)}
      >
        ${content}
      </button>
    `;
  }

  #renderName(workspace) {
    if (this.renaming === workspace.uuid) {
      return html`
        <input
          class="zen-library-space-name-input"
          .value=${workspace.name}
          @keydown=${event => this.#onRenameKeyDown(workspace, event)}
          @blur=${event => this.#commitRename(workspace, event)}
        />
      `;
    }
    return html`
      <button
        class="zen-library-space-name"
        data-l10n-id="library-spaces-name-button"
        @click=${() => {
          this.renaming = workspace.uuid;
        }}
      >
        ${workspace.name}
      </button>
    `;
  }

  #renderSpace(workspace) {
    return html`
      <div
        class="zen-library-space"
        style=${styleMap(this.#themeStyles(workspace))}
        ?active=${workspace.uuid === gZenWorkspaces.activeWorkspace}
      >
        <div class="zen-library-space-header">
          ${this.#renderIcon(workspace)} ${this.#renderName(workspace)}
          <button
            class="zen-library-space-button"
            data-l10n-id="library-spaces-theme-button"
            @click=${event => this.#openThemePicker(workspace, event)}
          >
            <img src="chrome://browser/skin/zen-icons/edit-theme.svg" alt="" />
          </button>
        </div>
        <div class="zen-library-space-body"></div>
        <div class="zen-library-space-footer">
          <button
            class="zen-library-space-button zen-library-space-handle"
            data-l10n-id="library-spaces-move-button"
            @pointerdown=${this.#onPointerDown}
            @pointermove=${this.#onPointerMove}
            @pointerup=${event => this.#onPointerUp(event, workspace)}
            @pointercancel=${event => this.#onPointerUp(event, workspace)}
          >
            <img
              src="chrome://browser/skin/zen-icons/drag-indicator.svg"
              draggable="false"
              alt=""
            />
          </button>
          <toolbarbutton
            class="zen-library-space-actions"
            zen-workspace-id=${workspace.uuid}
            data-l10n-id="library-spaces-actions-button"
            @click=${this.#openActions}
          >
            <img src="chrome://global/skin/icons/more.svg" alt="" />
          </toolbarbutton>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="zen-library-spaces">
        ${repeat(
          gZenWorkspaces.getWorkspaces(),
          workspace => workspace.uuid,
          workspace => this.#renderSpace(workspace)
        )}
      </div>
    `;
  }
}

customElements.define("zen-library-spaces-section", ZenLibrarySpacesSection);
