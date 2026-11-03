/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { ZenLibrarySearchSection } from "moz-src:///zen/library/sections/ZenLibrarySearchSection.mjs";
import { ZenLibraryMediaPreview } from "moz-src:///zen/library/ZenLibraryMediaPreview.mjs";

let lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  FileUtils: "resource://gre/modules/FileUtils.sys.mjs",
  canDrawThumbnail: "moz-src:///zen/library/ZenLibraryUtils.sys.mjs",
  extensionOf: "moz-src:///zen/library/ZenLibraryUtils.sys.mjs",
  MEDIA_EXTENSIONS: "moz-src:///zen/library/ZenLibraryUtils.sys.mjs",
  mediaKindOf: "moz-src:///zen/library/ZenLibraryUtils.sys.mjs",
});

XPCOMUtils.defineLazyServiceGetter(
  lazy,
  "zenLibraryFiles",
  "@mozilla.org/zen/library-files;1",
  Ci.nsIZenLibraryFiles
);

const FILE_MIME = "application/x-moz-file";
const HTML_NS = "http://www.w3.org/1999/xhtml";
const FOLDERS_PREF = "zen.library.media.folders";
const ENABLED_PREF = "zen.library.media.enabled";

const FOLDERS = {
  downloads: { key: "DfltDwnld", home: "Downloads" },
  documents: { key: "Docs", home: "Documents" },
  desktop: { key: "Desk", home: "Desktop" },
  pictures: { home: "Pictures" },
  music: { home: "Music" },
  videos: { home: AppConstants.platform === "macosx" ? "Movies" : "Videos" },
};

/**
 * @param {string} fileName - A file found while looking through a folder
 * @returns {string|null} How the grid shows it
 */
function kindFor(fileName) {
  const kind = lazy.mediaKindOf(fileName);
  if (kind === "video") {
    return "video";
  }
  if (kind === "image") {
    return lazy.canDrawThumbnail(fileName) ? "image" : "file";
  }
  return null;
}

const MAX_DEPTH = 2;
const MAX_FOLDERS = 60;
const MAX_ITEMS = 300;

export class ZenLibraryMediaSection extends ZenLibrarySearchSection {
  static id = "media";
  static label = "library-media-section-title";

  /** @returns {object[]} What a right click on the media tab offers */
  static get tabMenu() {
    if (!Services.prefs.getBoolPref(ENABLED_PREF, false)) {
      return [];
    }
    return [
      {
        l10nId: "library-media-turn-off",
        command: () => Services.prefs.setBoolPref(ENABLED_PREF, false),
      },
    ];
  }

  static properties = {
    items: { state: true },
    loading: { state: true },
  };

  #preview = null;
  #scanId = 0;
  #scanned = [];
  #scanHandle = null;
  #thumbObserver = null;
  #cardItems = new WeakMap();

  constructor() {
    super();
    this.items = [];
    this.loading = true;
  }

  static render(library) {
    return html`
      <zen-library-media-section
        class="zen-library-section"
        data-section="media"
        .library=${library}
      ></zen-library-media-section>
    `;
  }

  get searchPlaceholderL10nId() {
    return "library-media-search-placeholder";
  }

  get filterTitleL10nId() {
    return "library-media-filter-title";
  }

  get filterGroups() {
    if (!this.#enabled || this.#scanned.length < 2) {
      return [];
    }
    return [
      {
        id: "folder",
        titleL10nId: "library-media-filter-folders",
        options: this.#scanned.map(path => ({
          id: path,
          label: PathUtils.filename(path),
        })),
      },
    ];
  }

  onFiltersChanged() {
    this.requestUpdate();
  }

  #enabledObserver = { observe: () => this.#onEnabledChanged() };

  connectedCallback() {
    super.connectedCallback();
    Services.prefs.addObserver(ENABLED_PREF, this.#enabledObserver);
    if (!this.#enabled) {
      this.loading = false;
      return;
    }
    this.#scanHandle = window.requestIdleCallback(() => this.#scan(), {
      timeout: 600,
    });
  }

  /** @returns {boolean} Whether looking through the folders was agreed to */
  get #enabled() {
    return Services.prefs.getBoolPref(ENABLED_PREF, false);
  }

  #enable() {
    Services.prefs.setBoolPref(ENABLED_PREF, true);
  }

  /**
   * Looking through the folders was just agreed to, or taken back, which can
   * happen from the tab's menu, from settings or from another window.
   */
  #onEnabledChanged() {
    this.#stopScan();
    if (this.#enabled) {
      this.loading = true;
      this.requestUpdate();
      this.#scan();
      return;
    }
    this.#preview?.destroy();
    this.#preview = null;
    this.items = [];
    this.#scanned = [];
    this.loading = false;
    this.requestUpdate();
  }

  /** Forgets any scan under way, so that its results are dropped. */
  #stopScan() {
    this.#scanId++;
    if (this.#scanHandle) {
      window.cancelIdleCallback(this.#scanHandle);
      this.#scanHandle = null;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    Services.prefs.removeObserver(ENABLED_PREF, this.#enabledObserver);
    this.#stopScan();
    this.#thumbObserver?.disconnect();
    this.#thumbObserver = null;
    this.#preview?.destroy();
    this.#preview = null;
  }

  /**
   * @returns {string[]} Absolute paths of the folders to look through. The
   *   pref takes named locations such as "downloads" and absolute paths
   *   alike, and anything that cannot be found is passed over.
   */
  #folders() {
    const home = Services.dirsvc.get("Home", Ci.nsIFile).path;
    const paths = [];
    for (const raw of Services.prefs
      .getStringPref(FOLDERS_PREF, "")
      .split(",")) {
      const entry = raw.trim();
      if (!entry) {
        continue;
      }
      if (PathUtils.isAbsolute(entry)) {
        paths.push(entry);
        continue;
      }
      const folder = FOLDERS[entry.toLowerCase()];
      if (!folder) {
        continue;
      }
      let path = null;
      if (folder.key) {
        try {
          path = Services.dirsvc.get(folder.key, Ci.nsIFile).path;
        } catch (error) {
          path = null;
        }
      }
      paths.push(path ?? PathUtils.join(home, folder.home));
    }
    return [...new Set(paths)];
  }

  async #scan() {
    const scanId = ++this.#scanId;
    this.#scanHandle = null;
    this.loading = true;
    this.#scanned = this.#folders();
    const files = await this.#scanFolders(this.#scanned);
    if (scanId !== this.#scanId) {
      return;
    }
    const found = [];
    for (const file of files) {
      const fileName = PathUtils.filename(file.path);
      const kind = kindFor(fileName);
      if (!kind) {
        continue;
      }
      found.push({
        folder: file.root,
        path: file.path,
        name: fileName,
        extension: lazy.extensionOf(fileName),
        kind,
        modified: file.lastModified,
        size: file.size,
        cloudPlaceholder: file.cloudPlaceholder,
        url: PathUtils.toFileURI(file.path),
      });
    }
    this.items = found;
    this.loading = false;
  }

  /**
   * Hands the folders to the scanner, which goes through them on a thread
   * of its own: a folder listing already carries the dates and sizes this
   * wants, so there is nothing left to ask about each file.
   *
   * @param {string[]} roots - The folders to look through
   * @returns {Promise<object[]>} What it found, newest first
   */
  #scanFolders(roots) {
    return new Promise(resolve => {
      try {
        lazy.zenLibraryFiles.scanMedia(
          roots,
          lazy.MEDIA_EXTENSIONS,
          MAX_DEPTH,
          MAX_FOLDERS,
          MAX_ITEMS,
          resolve
        );
      } catch (error) {
        console.error("ZenLibraryMediaSection: the scan went nowhere", error);
        resolve([]);
      }
    });
  }

  // Interaction

  #onDragStart(event, item) {
    const file = new lazy.FileUtils.File(item.path);
    if (!file.exists()) {
      event.preventDefault();
      return;
    }
    const { dataTransfer } = event;
    dataTransfer.mozSetDataAt(FILE_MIME, file, 0);
    dataTransfer.effectAllowed = "copyMove";
    dataTransfer.setData("text/uri-list", item.url);
    dataTransfer.addElement(event.currentTarget);
  }

  #onItemContextMenu(event, item) {
    this.#preview ??= new ZenLibraryMediaPreview(window);
    this.#preview.openContextMenu(event, item);
  }

  #onItemClick(event, item) {
    this.#preview ??= new ZenLibraryMediaPreview(window);
    const shown = this.#shown;
    this.#preview.open({
      items: shown,
      index: shown.indexOf(item),
      from: event.currentTarget.querySelector(".zen-library-media-frame"),
    });
  }

  // Rendering

  /**
   * Builds one card, empty. Its picture is fetched only once the card comes
   * into view, so opening the tab does not read every file at once.
   *
   * @param {object} item - The media the card stands for
   * @returns {Element} Its card
   */
  #buildCard(item) {
    const card = document.createElementNS(HTML_NS, "div");
    card.className = "zen-library-media-item";
    card.draggable = true;
    card.title = item.name;
    card.addEventListener("dragstart", event => this.#onDragStart(event, item));
    card.addEventListener("click", event => this.#onItemClick(event, item));
    card.addEventListener("contextmenu", event =>
      this.#onItemContextMenu(event, item)
    );

    const frame = document.createElementNS(HTML_NS, "div");
    frame.className = "zen-library-media-frame";
    frame.dataset.kind = item.kind;
    card.appendChild(frame);

    this.#cardItems.set(card, item);
    return card;
  }

  /**
   * @param {Element} card - A card that has come into view
   */
  #loadThumb(card) {
    const item = this.#cardItems.get(card);
    const frame = card.firstElementChild;
    if (!item || !frame || frame.childElementCount) {
      return;
    }
    const make = tag => {
      const element = document.createElementNS(HTML_NS, tag);
      frame.appendChild(element);
      return element;
    };
    const kind = item.cloudPlaceholder ? "file" : item.kind;
    if (kind === "video") {
      const video = make("video");
      video.className = "zen-library-media-thumb";
      video.src = `${item.url}#t=0.1`;
      video.preload = "metadata";
      video.muted = true;
      video.tabIndex = -1;
      const badge = make("img");
      badge.className = "zen-library-media-play no-squircles";
      badge.src = "chrome://browser/skin/zen-icons/media-play.svg";
      badge.alt = "";
      return;
    }
    const image = make("img");
    image.decoding = "async";
    image.className =
      kind === "image"
        ? "zen-library-media-thumb"
        : "zen-library-media-thumb zen-library-media-file";
    image.src =
      kind === "image" ? item.url : `moz-icon://${item.name}?size=128`;
    image.alt = "";
  }

  #fillGrid() {
    const grid = this.querySelector(".zen-library-media-grid");
    if (!grid || !this.#enabled) {
      return;
    }
    const shown = this.#shown;
    const signature = shown.map(item => item.path).join("\n");
    if (grid.dataset.signature === signature) {
      return;
    }
    grid.dataset.signature = signature;
    this.#thumbObserver?.disconnect();
    this.#thumbObserver = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.#loadThumb(entry.target);
            this.#thumbObserver.unobserve(entry.target);
          }
        }
      },
      {
        root: this.querySelector(".zen-library-search-results"),
        rootMargin: "300px",
      }
    );
    const fragment = document.createDocumentFragment();
    const cards = shown.map(item => this.#buildCard(item));
    for (const card of cards) {
      fragment.appendChild(card);
    }
    grid.replaceChildren(fragment);
    for (const card of cards) {
      this.#thumbObserver.observe(card);
    }
  }

  /** @returns {object[]} What the grid shows, once the search has its say */
  get #shown() {
    const folders = this.#scanned.filter(path =>
      this.isFilterActive("folder", path)
    );
    const query = this.searchQuery.trim().toLowerCase();
    return this.items.filter(
      item =>
        (!folders.length || folders.includes(item.folder)) &&
        (!query || item.name.toLowerCase().includes(query))
    );
  }

  renderItems() {
    if (!this.#enabled) {
      return this.#renderOptIn();
    }
    if (this.loading) {
      return html`
        <div
          class="zen-library-empty"
          data-l10n-id="library-media-loading"
        ></div>
      `;
    }
    const shown = this.#shown;
    if (!shown.length) {
      return html`
        <div class="zen-library-empty" data-l10n-id="library-media-empty"></div>
      `;
    }
    return html`<div class="zen-library-media-grid"></div>`;
  }

  updated(changedProperties) {
    super.updated?.(changedProperties);
    this.toggleAttribute("needs-opt-in", !this.#enabled);
    this.#fillGrid();
  }

  /**
   * An empty grid behind a note saying what turning this on would do. The
   * cards are only shapes: nothing has been looked at yet.
   */
  #renderOptIn() {
    return html`
      <div class="zen-library-media-skeleton" behind></div>
      <div class="zen-library-media-opt-in">
        <div class="zen-library-media-opt-in-icon">
          <div class="empty-state-icon-image"></div>
        </div>
        <h3 data-l10n-id="library-media-opt-in-title"></h3>
        <p data-l10n-id="library-media-opt-in-body"></p>
        <button
          class="zen-big-accent-button primary zen-library-media-opt-in-button"
          data-l10n-id="library-media-opt-in-button"
          @click=${() => this.#enable()}
        ></button>
        <div class="zen-library-media-opt-in-note">
          <img src="chrome://global/skin/icons/security.svg" alt="" />
          <span data-l10n-id="library-media-opt-in-note"></span>
        </div>
      </div>
    `;
  }
}

customElements.define("zen-library-media-section", ZenLibraryMediaSection);
