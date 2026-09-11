/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  html,
  repeat,
  styleMap,
} from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";
import { ZenLibraryDragAndDrop } from "moz-src:///zen/library/ZenLibraryDragAndDrop.mjs";

const GRADIENT_TOPIC = "zen-space-gradient-update";
const SCROLL_EDGE_PX = 48;
const SCROLL_STEP_PX = 12;

// Tab strip changes after which the cards' copies of the strips are redone.
const TAB_EVENTS = [
  "TabOpen",
  "TabClose",
  "TabMove",
  "TabPinned",
  "TabUnpinned",
  "TabGrouped",
  "TabUngrouped",
  "TabGroupCreate",
  "TabGroupRemoved",
  "TabAttrModified",
];
// Events the copies fire while being built that the rest of the browser must
// not mistake for real tab strip changes.
const CONTAINED_EVENTS = [
  "TabGrouped",
  "TabUngrouped",
  "TabGroupCreate",
  "TabGroupRemovedFromDOM",
  "FolderGrouped",
  "FolderUngrouped",
  // Copies collapse and expand in place; the folder manager and session
  // store must only ever hear about the real folders.
  "TabGroupCollapse",
  "TabGroupExpand",
];
const GROUP_TAGS = ["tab-group", "zen-folder", "tab-split-view-wrapper"];

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
  #onTabEvent = () => this.#scheduleStripsRefresh();
  // A drag started from a copy ends on the real tab, in the real strip; only
  // what was shown over the copies is left to clear here.
  #onDragEnd = () => {
    this.#dnd.clearDragOverVisuals();
    this.#scheduleStripsRefresh();
  };
  #refreshTimer = null;
  /** @type {WeakMap<Element, Element>} copied tab or group to the real one */
  #realElements = new WeakMap();
  #dnd = new ZenLibraryDragAndDrop(this);
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
    for (const type of TAB_EVENTS) {
      window.addEventListener(type, this.#onTabEvent);
    }
    window.addEventListener("dragend", this.#onDragEnd);
    // Copies fire these while being built; stop them here, above the copies
    // and below the window, so folder and session code never see them.
    for (const type of CONTAINED_EVENTS) {
      this.addEventListener(type, this.#containEvent, true);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("ZenWorkspaceDataChanged", this.#onDataChanged);
    Services.obs.removeObserver(this.#observer, GRADIENT_TOPIC);
    this.#resizeObserver.disconnect();
    for (const type of TAB_EVENTS) {
      window.removeEventListener(type, this.#onTabEvent);
    }
    window.removeEventListener("dragend", this.#onDragEnd);
    for (const type of CONTAINED_EVENTS) {
      this.removeEventListener(type, this.#containEvent, true);
    }
    clearTimeout(this.#refreshTimer);
    this.#refreshTimer = null;
    this.library?.style.removeProperty("--zen-library-content-width");
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    this.#fillStrips();
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

  // Copies of the tab strips
  //
  // A card shows a copy of its space's pinned and regular tab sections,
  // built the way drag images are: tabs and groups are cloned shallowly and
  // rebuild their own markup from their attributes when connected, so they
  // look exactly like the originals without touching the real strip.

  #scheduleStripsRefresh() {
    if (this.#refreshTimer) {
      return;
    }
    this.#refreshTimer = setTimeout(() => {
      this.#refreshTimer = null;
      this.#fillStrips(true);
    }, 100);
  }

  /**
   * @param {boolean} rebuild - Redo copies that already exist, not only
   *   fill in cards that have none yet
   */
  #fillStrips(rebuild = false) {
    for (const card of this.#cards) {
      const strip = card.querySelector(".zen-library-space-tabs");
      if (!rebuild && strip.childElementCount) {
        continue;
      }
      // Where each row sits now, so it can slide from there to its new spot
      // once the strip is rebuilt.
      const before = rebuild ? this.#rowPositions(strip) : null;
      strip.textContent = "";
      const space = gZenWorkspaces.workspaceElement(card.dataset.uuid);
      if (!space) {
        continue;
      }
      for (const section of [space.pinnedTabsContainer, space.tabsContainer]) {
        this.#appendCopy(strip, section);
      }
      if (before) {
        this.#animateRows(strip, before);
      }
    }
  }

  /**
   * The top-left of every row in a strip, keyed by the copy's stable id, so a
   * row can be matched across a rebuild.
   *
   * @param {Element} strip
   * @returns {Map<string, {left: number, top: number}>}
   */
  #rowPositions(strip) {
    const positions = new Map();
    for (const row of strip.querySelectorAll(
      "tab, .tab-group-label-container"
    )) {
      const id = row.id || row.closest("[id]")?.id;
      if (id) {
        const rect = row.getBoundingClientRect();
        positions.set(id, { left: rect.left, top: rect.top });
      }
    }
    return positions;
  }

  /**
   * Slides each rebuilt row from where its old copy was to where it is now.
   *
   * @param {Element} strip
   * @param {Map<string, {left: number, top: number}>} before - Old positions
   */
  #animateRows(strip, before) {
    if (gReduceMotion) {
      return;
    }
    for (const row of strip.querySelectorAll(
      "tab, .tab-group-label-container"
    )) {
      const id = row.id || row.closest("[id]")?.id;
      const old = id && before.get(id);
      if (!old) {
        continue;
      }
      const rect = row.getBoundingClientRect();
      const dx = old.left - rect.left;
      const dy = old.top - rect.top;
      if (dx || dy) {
        gZenUIManager.elementAnimate(
          row,
          { x: [dx, 0], y: [dy, 0] },
          { duration: 180, easing: "ease-out" }
        );
      }
    }
  }

  /**
   * Copies must never be mistaken for the originals by id lookups, so every
   * id in a copy gets a suffix.
   *
   * @param {Element} copy - The copied element, before it is connected
   */
  #renameIds(copy) {
    for (const element of [copy, ...copy.querySelectorAll("[id]")]) {
      if (element.id) {
        element.id = `${element.id}-copy`;
      }
    }
  }

  #appendCopy(container, node) {
    if (node.nodeType !== Node.ELEMENT_NODE || node.hasAttribute("hidden")) {
      return;
    }
    if (gBrowser.isTab(node)) {
      // Connecting a tab rebuilds its contents from its attributes.
      const copy = node.cloneNode(false);
      this.#renameIds(copy);
      copy.setAttribute("drag-image", "true");
      // Selection belongs to the real strip.
      for (const attribute of ["selected", "visuallyselected", "multiselected"]) {
        copy.removeAttribute(attribute);
      }
      container.appendChild(copy);
      this.#realElements.set(copy, node);
      if (node.glanceTab) {
        this.#appendCopy(copy.querySelector(".tab-content"), node.glanceTab);
      }
      return;
    }
    if (GROUP_TAGS.includes(node.localName)) {
      // Same for groups and folders, which also empty themselves; the
      // drag-image flag keeps them from announcing their creation.
      const copy = node.cloneNode(false);
      this.#renameIds(copy);
      copy.setAttribute("drag-image", "true");
      container.appendChild(copy);
      this.#realElements.set(copy, node);
      // A folder draws its icon itself on connect; take the real one's, which
      // carries the current open state and image.
      const icon = copy.querySelector(".tab-group-folder-icon");
      const realIcon = node.querySelector(".tab-group-folder-icon");
      if (icon && realIcon) {
        icon.replaceChildren(
          ...[...realIcon.children].map(child => child.cloneNode(true))
        );
      }
      const inner = node.querySelector(":scope > .tab-group-container") ?? node;
      for (const child of inner.children) {
        // The copy made its own start marker along with the rest of its
        // markup.
        if (!child.classList.contains("zen-tab-group-start")) {
          this.#appendCopy(copy, child);
        }
      }
      return;
    }
    if (!node.querySelector("tab, tab-group, zen-folder")) {
      const copy = node.cloneNode(true);
      this.#renameIds(copy);
      container.appendChild(copy);
      return;
    }
    const copy = node.cloneNode(false);
    this.#renameIds(copy);
    container.appendChild(copy);
    for (const child of node.children) {
      this.#appendCopy(copy, child);
    }
  }

  #containEvent = event => {
    event.stopPropagation();
  };

  // Copies have no browser behind them, so the tabs' own hover handling must
  // not run on them; hover styling is unaffected.
  #containHover = {
    handleEvent: event => event.stopPropagation(),
    capture: true,
  };

  /**
   * Acting on a copy acts on the real element, whose change then rebuilds
   * the copies: a folder label collapses or expands the real folder, a tab
   * selects the real tab.
   *
   * @param {MouseEvent} event - The click on the copy
   */
  #onStripClick = event => {
    const label = event.target.closest(".tab-group-label-container");
    if (label) {
      const copy = label.closest(GROUP_TAGS.join());
      const group = this.#realElements.get(copy);
      if (group) {
        event.stopPropagation();
        const collapsed = !group.collapsed;
        group.collapsed = collapsed;
        // Mirror it on the copy and animate the copy the way the sidebar
        // animates the real folder, rather than rebuilding it.
        copy.collapsed = collapsed;
        if (collapsed) {
          gZenFolders.animateCollapse(copy);
        } else {
          gZenFolders.animateExpand(copy);
        }
      }
      return;
    }
    const tab = this.#realElements.get(event.target.closest("tab"));
    if (!tab) {
      return;
    }
    event.stopPropagation();
    gBrowser.selectedTab = tab;
    this.library?.constructor.toggle();
  };

  /**
   * @param {Element} copy - A copied tab, group or folder
   * @returns {Element|undefined} The real element it stands for
   */
  realElementFor(copy) {
    return this.#realElements.get(copy);
  }

  // Dragging copies is the tab strip's drag and drop, on the copies.

  #onStripDragStart = event => {
    // A drag that starts on a label's text targets the text node itself.
    const target =
      event.target.nodeType === Node.TEXT_NODE
        ? event.target.parentElement
        : event.target;
    const copy = target.closest("tab");
    if (copy) {
      this.#dnd.startTabDrag(event, copy);
    }
  };

  #onStripDrop = event => {
    this.#dnd.handle_drop(event);
    this.#scheduleStripsRefresh();
  };

  #renderStrip() {
    // Shares the sidebar's ids so its tab styling applies here too; the real
    // elements come first in the document.
    return html`
      <div class="zen-library-space-body" zen-sidebar-expanded="true">
        <div
          class="zen-library-space-tabs"
          id="tabbrowser-tabs"
          orient="vertical"
          expanded="true"
          @click=${this.#onStripClick}
          @mouseover=${this.#containHover}
          @mouseout=${this.#containHover}
          @dragstart=${this.#onStripDragStart}
          @dragover=${event => this.#dnd.handle_dragover(event)}
          @dragleave=${event => this.#dnd.handle_dragleave(event)}
          @drop=${this.#onStripDrop}
        ></div>
      </div>
    `;
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
        data-uuid=${workspace.uuid}
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
        ${this.#renderStrip()}
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
