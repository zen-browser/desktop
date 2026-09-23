/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  FileUtils: "resource://gre/modules/FileUtils.sys.mjs",
});

ChromeUtils.defineLazyGetter(
  lazy,
  "relativeDayFormat",
  () =>
    new Intl.RelativeTimeFormat(undefined, {
      numeric: "auto",
      style: "short",
    })
);

const HTML_NS = "http://www.w3.org/1999/xhtml";

const MS_PER_DAY = 86400000;
const MORPH_MS = 250;
// How far in the picture gives way to the dialog around it.
// Matches the corner the grid's pictures have.
const MEDIA_RADIUS = 8;
const HANDOVER = 0.3;
// How soon the dialog's surfaces are gone on the way back.
const CHROME_OUT = 0.25;
// How long to hold the dialog back while the picture readies itself.
const IMAGE_WAIT_MS = 400;
const VIDEO_WAIT_MS = 900;
const MORPH_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * The media tab's full view. It lives beside the library rather than inside
 * it, so it can sit in the middle of the window while the library slides.
 */
export class ZenLibraryMediaPreview {
  #window;
  #document;
  #root = null;
  #parts = {};
  #menu = null;
  /** @type {object|null} The media the open menu acts on */
  #menuItem = null;
  #items = [];
  #index = -1;
  #origin = null;
  #onKeyDown = event => this.#handleKey(event);

  constructor(win) {
    this.#window = win;
    this.#document = win.document;
  }

  get isOpen() {
    return !!this.#root?.isConnected;
  }

  get #item() {
    return this.#items[this.#index] ?? null;
  }

  // Building

  #build() {
    const doc = this.#document;
    const make = (tag, className, into) => {
      const element = doc.createElementNS(HTML_NS, tag);
      if (className) {
        element.className = className;
      }
      into?.appendChild(element);
      return element;
    };

    const root = make("div", "zen-library-media-preview");
    const backdrop = make("div", "zen-library-media-preview-backdrop", root);
    backdrop.addEventListener("click", () => this.close());

    const panel = make("div", "zen-library-media-preview-panel", root);
    const header = doc.createXULElement("toolbar");
    header.className = "zen-library-media-preview-header";
    panel.appendChild(header);

    const button = (className, icon, l10nId, onClick) => {
      const element = doc.createXULElement("toolbarbutton");
      element.className = `toolbarbutton-1 ${className}`;
      header.appendChild(element);
      const image = doc.createElementNS(HTML_NS, "img");
      image.className = "toolbarbutton-icon";
      image.src = icon;
      image.alt = "";
      element.appendChild(image);
      doc.l10n.setAttributes(element, l10nId);
      element.addEventListener("command", onClick);
      element.addEventListener("click", onClick);
      return element;
    };

    button(
      "close",
      "chrome://browser/skin/zen-icons/close.svg",
      "library-media-close",
      () => this.close()
    );
    const prev = button(
      "prev",
      "chrome://browser/skin/zen-icons/arrow-left.svg",
      "library-media-previous",
      () => this.#step(-1)
    );
    const next = button(
      "next",
      "chrome://browser/skin/zen-icons/arrow-right.svg",
      "library-media-next",
      () => this.#step(1)
    );

    const nameLabel = make("span", "zen-library-media-preview-name", header);
    const date = make("span", "zen-library-media-preview-date", header);
    const more = button(
      "more",
      "chrome://global/skin/icons/more.svg",
      "library-media-more",
      event => this.#openMenu(event)
    );
    const openButton = doc.createXULElement("toolbarbutton");
    openButton.className = "toolbarbutton-1 zen-library-media-preview-open";
    header.appendChild(openButton);
    const openText = doc.createXULElement("label");
    openText.className = "toolbarbutton-text";
    openButton.appendChild(openText);
    openButton.addEventListener("command", () => this.#launch());
    openButton.addEventListener("click", () => this.#launch());

    const stage = make("div", "zen-library-media-preview-stage", panel);
    stage.addEventListener("contextmenu", event =>
      this.openContextMenu(event, this.#item)
    );

    this.#parts = {
      panel,
      backdrop,
      header,
      openText,
      stage,
      nameLabel,
      date,
      openButton,
      prev,
      next,
      more,
    };
    this.#root = root;
    this.#mountRoot.appendChild(root);
  }

  get #mountRoot() {
    return (
      this.#document.getElementById("zen-main-app-wrapper") ??
      this.#document.documentElement
    );
  }

  // Opening and closing

  /**
   * @param {object} options - Where to start
   * @param {object[]} options.items - Everything the grid is showing
   * @param {number} options.index - The item that was clicked
   * @param {Element} options.from - The thumbnail it grows out of
   */
  open({ items, index, from }) {
    if (index < 0) {
      return;
    }
    if (!this.#root) {
      this.#build();
    }
    this.#items = items;
    this.#index = index;
    this.#origin = from;
    this.#window.addEventListener("keydown", this.#onKeyDown, true);
    this.#show();
    this.#root.style.visibility = "hidden";
    this.#whenMediaReady().then(() => {
      if (!this.isOpen) {
        return;
      }
      this.#root.style.visibility = "";
      this.#morph(from, /* opening = */ true);
    });
  }

  /**
   * @returns {Promise} Settles once the picture has a size to animate from,
   *   or right away when it already has one.
   */
  #whenMediaReady() {
    const media = this.#parts.stage.querySelector(
      ".zen-library-media-preview-media"
    );
    if (!media) {
      return Promise.resolve();
    }
    const isVideo = media.localName === "video";
    const ready = () =>
      isVideo ? media.readyState >= media.HAVE_CURRENT_DATA : media.complete;
    if (ready()) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const done = () => resolve();
      media.addEventListener("load", done, { once: true });
      media.addEventListener("loadeddata", done, { once: true });
      media.addEventListener("error", done, { once: true });
      this.#window.setTimeout(done, isVideo ? VIDEO_WAIT_MS : IMAGE_WAIT_MS);
    });
  }

  close() {
    if (!this.isOpen) {
      return;
    }
    this.#window.removeEventListener("keydown", this.#onKeyDown, true);
    const done = this.#morph(this.#origin, /* opening = */ false);
    const finish = () => {
      this.#root?.remove();
      this.#root = null;
      this.#parts = {};
      this.#origin = null;
    };
    if (done) {
      done.finished.then(finish, finish);
    } else {
      finish();
    }
  }

  destroy() {
    this.#window.removeEventListener("keydown", this.#onKeyDown, true);
    this.#menu?.remove();
    this.#menu = null;
    this.#root?.remove();
    this.#root = null;
  }

  /**
   * Opens the dialog straight on top of the card's picture, matching its box
   * exactly, and grows it into the middle of the window. Closing is the same
   * run played backwards.
   *
   * @param {Element} thumbnail - The card's picture
   * @param {boolean} opening - Which way round
   * @returns {Animation} The dialog's animation
   */
  #morph(thumbnail, opening) {
    const { panel, backdrop, header, stage } = this.#parts;
    const base = {
      duration: MORPH_MS,
      easing: MORPH_EASING,
      fill: "both",
    };
    const steps = keyframes =>
      opening
        ? keyframes
        : [...keyframes]
            .reverse()
            .map(frame =>
              frame.offset === undefined
                ? frame
                : { ...frame, offset: 1 - frame.offset }
            );
    const chrome = { ...base, easing: "linear" };
    const fadeOut = arriving =>
      opening
        ? arriving
        : [
            { ...arriving.at(-1), offset: 0 },
            { ...arriving[0], offset: CHROME_OUT },
            { ...arriving[0], offset: 1 },
          ];
    backdrop.animate(fadeOut([{ opacity: 0 }, { opacity: 1 }]), chrome);
    const source = thumbnail?.querySelector(".zen-library-media-thumb");
    const from = source?.getBoundingClientRect();
    const to = panel.getBoundingClientRect();
    if (!from?.width || !to.width) {
      return backdrop.animate(
        fadeOut([{ opacity: 0 }, { opacity: 1 }]),
        chrome
      );
    }
    const media = stage?.querySelector(".zen-library-media-preview-media");
    const shown = media?.getBoundingClientRect();
    const target = shown?.width ? shown : to;
    const scale = from.width / target.width;
    const centre = box => ({
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
    });
    const panelCentre = centre(to);
    const shownCentre = centre(target);
    const cardCentre = centre(from);
    const atCard =
      `translate(${cardCentre.x - panelCentre.x - scale * (shownCentre.x - panelCentre.x)}px, ` +
      `${cardCentre.y - panelCentre.y - scale * (shownCentre.y - panelCentre.y)}px) ` +
      `scale(${scale})`;
    const panelStyle = this.#window.getComputedStyle(panel);
    const late = (values, property) => {
      const hidden = property === "boxShadow" ? "none" : "transparent";
      return opening
        ? [
            { [property]: hidden, offset: 0 },
            { [property]: hidden, offset: HANDOVER },
            { [property]: values, offset: 1 },
          ]
        : [
            { [property]: values, offset: 0 },
            { [property]: hidden, offset: CHROME_OUT },
            { [property]: hidden, offset: 1 },
          ];
    };
    panel.animate(late(panelStyle.backgroundColor, "backgroundColor"), chrome);
    panel.animate(late(panelStyle.boxShadow, "boxShadow"), chrome);
    if (stage) {
      const stageStyle = this.#window.getComputedStyle(stage);
      stage.animate(
        late(stageStyle.backgroundColor, "backgroundColor"),
        chrome
      );
      stage.animate(late(stageStyle.borderTopColor, "borderTopColor"), chrome);
    }
    header.animate(
      fadeOut([
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: HANDOVER },
        { opacity: 1, offset: 1 },
      ]),
      chrome
    );
    if (media && shown?.width) {
      media.animate(
        steps([
          { borderRadius: `${Math.round(MEDIA_RADIUS / scale)}px` },
          { borderRadius: `${MEDIA_RADIUS}px` },
        ]),
        base
      );
    }
    return panel.animate(
      steps([{ transform: atCard }, { transform: "none" }]),
      base
    );
  }

  #step(delta) {
    const next = this.#index + delta;
    if (next < 0 || next >= this.#items.length) {
      return;
    }
    this.#index = next;
    this.#origin = this.#thumbFor(this.#item);
    this.#show();
  }

  /**
   * @param {object} item - The media being shown
   * @returns {Element|null} Its card in the grid, so closing lands back on it
   */
  #thumbFor(item) {
    const section = this.#document.querySelector("zen-library-media-section");
    const cards = [
      ...(section?.querySelectorAll(".zen-library-media-item") ?? []),
    ];
    return (
      cards
        .find(card => card.title === item?.name)
        ?.querySelector(".zen-library-media-frame") ?? this.#origin
    );
  }

  #handleKey(event) {
    if (!this.isOpen) {
      return;
    }
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        this.close();
        break;
      case "ArrowLeft":
        this.#step(-1);
        break;
      case "ArrowRight":
        this.#step(1);
        break;
    }
  }

  // Contents

  #show() {
    const item = this.#item;
    if (!item) {
      return;
    }
    const { stage, nameLabel, date, openText, prev, next } = this.#parts;
    const doc = this.#document;
    stage.replaceChildren();
    const media = doc.createElementNS(
      HTML_NS,
      item.kind === "video" ? "video" : "img"
    );
    media.className = "zen-library-media-preview-media";
    media.src = item.url;
    if (item.kind !== "video") {
      media.draggable = true;
      media.addEventListener("dragstart", event =>
        this.#onDragStart(event, item)
      );
    }
    if (item.kind === "video") {
      media.controls = true;
      media.autoplay = true;
      media.preload = "auto";
    } else {
      media.alt = "";
    }
    stage.appendChild(media);

    nameLabel.textContent = item.name;
    date.textContent = this.#relativeDate(item.modified);
    doc.l10n
      .formatValue("library-media-open-in", { app: this.#openerName(item) })
      .then(text => {
        openText.textContent = text;
      });
    prev.disabled = this.#index <= 0;
    next.disabled = this.#index >= this.#items.length - 1;
  }

  #relativeDate(modified) {
    const days = Math.round((modified - Date.now()) / MS_PER_DAY);
    if (Math.abs(days) >= 7) {
      return lazy.relativeDayFormat.format(Math.round(days / 7), "week");
    }
    return lazy.relativeDayFormat.format(days, "day");
  }

  /**
   * @param {object} item - The media being shown
   * @returns {string} What the system opens this kind of file with
   */
  #openerName(item) {
    try {
      const mime = Cc["@mozilla.org/mime;1"].getService(Ci.nsIMIMEService);
      const info = mime.getFromTypeAndExtension(null, item.extension);
      return info.defaultDescription || info.description || "";
    } catch (error) {
      return "";
    }
  }

  #onDragStart(event, item) {
    const file = new lazy.FileUtils.File(item.path);
    if (!file.exists()) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.mozSetDataAt("application/x-moz-file", file, 0);
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData("text/uri-list", item.url);
  }

  #launch(item = this.#item) {
    if (!item) {
      return;
    }
    try {
      new lazy.FileUtils.File(item.path).launch();
    } catch (error) {
      this.#window.openTrustedLinkIn(item.url, "tab");
    }
  }

  #reveal(item = this.#item) {
    if (item) {
      new lazy.FileUtils.File(item.path).reveal();
    }
  }

  #copy(item = this.#item) {
    if (!item) {
      return;
    }
    const transferable = Cc[
      "@mozilla.org/widget/transferable;1"
    ].createInstance(Ci.nsITransferable);
    transferable.init(this.#window.docShell.QueryInterface(Ci.nsILoadContext));
    transferable.addDataFlavor("application/x-moz-file");
    transferable.setTransferData(
      "application/x-moz-file",
      new lazy.FileUtils.File(item.path)
    );
    Services.clipboard.setData(
      transferable,
      null,
      Services.clipboard.kGlobalClipboard
    );
  }

  #openMenu(event) {
    this.#menuItem = this.#item;
    this.#ensureMenu().openPopup(
      event.currentTarget,
      "after_end",
      0,
      0,
      false,
      false
    );
  }

  /**
   * Opens the same menu as the more button, at the pointer, for any media
   * in the grid or the one on show.
   *
   * @param {MouseEvent} event - The right click
   * @param {object} item - The media it was on
   */
  openContextMenu(event, item) {
    event.preventDefault();
    event.stopPropagation();
    if (!item) {
      return;
    }
    this.#menuItem = item;
    this.#ensureMenu().openPopupAtScreen(
      event.screenX,
      event.screenY,
      true,
      event
    );
  }

  #ensureMenu() {
    if (!this.#menu) {
      this.#menu = this.#window.MozXULElement.parseXULToFragment(`
        <menupopup class="zen-library-media-menu">
          <menuitem data-action="open" data-l10n-id="library-media-menu-open"/>
          <menuitem data-action="show" data-l10n-id="downloads-cmd-show-menuitem-2"/>
          <menuseparator/>
          <menuitem data-action="copy" data-l10n-id="library-media-menu-copy"/>
        </menupopup>
      `).firstElementChild;
      this.#menu.addEventListener("command", menuEvent => {
        const item = this.#menuItem;
        switch (menuEvent.target.dataset.action) {
          case "open":
            this.#launch(item);
            break;
          case "show":
            this.#reveal(item);
            break;
          case "copy":
            this.#copy(item);
            break;
        }
      });
      this.#document.getElementById("mainPopupSet").appendChild(this.#menu);
    }
    return this.#menu;
  }
}
