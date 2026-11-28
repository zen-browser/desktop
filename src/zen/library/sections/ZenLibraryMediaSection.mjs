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

// Image formats read from the clipboard, and the extension each one is saved
// with. The bytes are written as they come, so the extension must match.
const CLIPBOARD_IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
};

/**
 * @param {Uint8Array} bytes - The data to hash
 * @returns {Promise<string>} Its SHA-256, in hexadecimal
 */
async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

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

  #clipboardItem = null;
  #clipboardCheckId = 0;
  // Every temporary file this section wrote and has not deleted yet.
  #clipboardFiles = new Set();
  // Keeps the files of two windows, or of two checks, from ever sharing a path.
  #instanceId = crypto.randomUUID().slice(0, 8);
  #onClipboardTrigger = () => this.#checkClipboard();

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
    window.addEventListener("focus", this.#onClipboardTrigger);
    this.addEventListener("mouseenter", this.#onClipboardTrigger);
    if (!this.#enabled) {
      this.loading = false;
      return;
    }
    this.#scanHandle = window.requestIdleCallback(() => this.#scan(), {
      timeout: 600,
    });
  }

  onShown() {
    super.onShown?.();
    this.#checkClipboard();
  }

  /** Called when the library opens on this tab, which is already showing. */
  onLibraryOpened() {
    this.#checkClipboard();
    return super.onLibraryOpened?.();
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
      this.#checkClipboard();
      return;
    }
    this.#preview?.destroy();
    this.#preview = null;
    // With the preview gone, this deletes every temporary file.
    this.#checkClipboard();
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
    window.removeEventListener("focus", this.#onClipboardTrigger);
    this.removeEventListener("mouseenter", this.#onClipboardTrigger);
    // Drops any check under way, then deletes every temporary file. A check
    // that is still writing deletes its own file when it finds it is stale.
    this.#clipboardCheckId++;
    this.#clipboardItem = null;
    this.#deleteClipboardFiles(true);
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

  /**
   * @returns {object|null} The image on the clipboard, with its bytes, its
   *   MIME type and the extension that goes with it, or null when there is
   *   no image in a supported format
   */
  #readClipboardImage() {
    const flavors = Object.keys(CLIPBOARD_IMAGE_TYPES);
    if (
      !Services.clipboard.hasDataMatchingFlavors(
        flavors,
        Services.clipboard.kGlobalClipboard
      )
    ) {
      return null;
    }
    const trans = Cc["@mozilla.org/widget/transferable;1"].createInstance(
      Ci.nsITransferable
    );
    trans.init(window.docShell.QueryInterface(Ci.nsILoadContext));
    for (const flavor of flavors) {
      trans.addDataFlavor(flavor);
    }
    Services.clipboard.getData(trans, Services.clipboard.kGlobalClipboard);
    const flavor = {};
    const data = {};
    trans.getAnyTransferData(flavor, data);
    const extension = CLIPBOARD_IMAGE_TYPES[flavor.value];
    if (!extension || !data.value) {
      return null;
    }
    const rawStream = data.value.QueryInterface(Ci.nsIInputStream);
    const binaryStream = Cc[
      "@mozilla.org/binaryinputstream;1"
    ].createInstance(Ci.nsIBinaryInputStream);
    binaryStream.setInputStream(rawStream);
    const size = rawStream.available();
    if (size <= 0) {
      return null;
    }
    const bytes = new Uint8Array(size);
    binaryStream.readArrayBuffer(size, bytes.buffer);
    return { bytes, extension, mimeType: flavor.value };
  }

  /**
   * Forgets the clipboard image. Its file is kept: the preview's menu can put
   * that very file on the clipboard, which makes the image vanish from here
   * while the clipboard still points at the file. It goes with the next image,
   * or when the section goes.
   */
  #clearClipboardItem() {
    if (!this.#clipboardItem) {
      return;
    }
    this.#clipboardItem = null;
    this.requestUpdate();
  }

  /**
   * @param {string} path - A temporary file this section wrote
   */
  #deleteClipboardFile(path) {
    this.#clipboardFiles.delete(path);
    IOUtils.remove(path, { ignoreAbsent: true }).catch(() => {});
  }

  /**
   * Deletes the temporary files that are no longer on show. While the preview
   * is open it may still be showing one of them, so they wait.
   *
   * @param {boolean} [all] - Delete the one on show too, and do not wait
   */
  #deleteClipboardFiles(all = false) {
    if (!all && this.#preview?.isOpen) {
      return;
    }
    for (const path of [...this.#clipboardFiles]) {
      if (all || path !== this.#clipboardItem?.path) {
        this.#deleteClipboardFile(path);
      }
    }
  }

  /** @returns {boolean} Whether the library is open on this tab */
  get #viewed() {
    return (
      this.hasAttribute("showing") && !!this.library?.constructor.isLibraryOpen
    );
  }

  /**
   * Looks at the clipboard and keeps the grid's clipboard card in step with
   * it, only while the library is open on this tab. Several checks can
   * overlap, so each one drops its result when a newer one has started in
   * the meantime.
   */
  async #checkClipboard() {
    if (!this.#enabled) {
      this.#clipboardCheckId++;
      this.#clearClipboardItem();
      this.#deleteClipboardFiles(true);
      return;
    }
    if (!this.#viewed) {
      return;
    }
    const checkId = ++this.#clipboardCheckId;
    const isStale = () => checkId !== this.#clipboardCheckId;
    let path = null;
    try {
      const image = this.#readClipboardImage();
      if (!image) {
        this.#clearClipboardItem();
        return;
      }
      const hash = await sha256Hex(image.bytes);
      if (isStale() || this.#clipboardItem?.hash === hash) {
        return;
      }
      // The path is this check's alone, so nothing else can delete or
      // overwrite it, and a file the preview is showing is never rewritten.
      path = PathUtils.join(
        PathUtils.tempDir,
        `zen-clipboard-${this.#instanceId}-${checkId}.${image.extension}`
      );
      this.#clipboardFiles.add(path);
      await IOUtils.write(path, image.bytes);
      if (isStale()) {
        this.#deleteClipboardFile(path);
        return;
      }
      this.#clipboardItem = {
        isClipboard: true,
        folder: "clipboard",
        path,
        name: `zen-clipboard-media.${image.extension}`,
        extension: image.extension,
        mimeType: image.mimeType,
        kind: "image",
        modified: Date.now(),
        size: image.bytes.length,
        cloudPlaceholder: false,
        url: PathUtils.toFileURI(path),
        hash,
      };
      this.requestUpdate();
      this.#deleteClipboardFiles();
    } catch (e) {
      console.error("[ZenLibraryMediaSection] Error reading clipboard:", e);
      if (path && path !== this.#clipboardItem?.path) {
        this.#deleteClipboardFile(path);
      }
      if (!isStale()) {
        this.#clearClipboardItem();
      }
    }
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
    if (item.isClipboard) {
      card.setAttribute("is-clipboard", "true");
    }
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
    const items = this.items.filter(
      item =>
        (!folders.length || folders.includes(item.folder)) &&
        (!query || item.name.toLowerCase().includes(query))
    );
    // The clipboard image belongs to no scanned folder, so a folder filter
    // hides it; the search still applies to its name.
    if (
      this.#clipboardItem &&
      !folders.length &&
      (!query || this.#clipboardItem.name.toLowerCase().includes(query))
    ) {
      items.unshift(this.#clipboardItem);
    }
    return items;
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
