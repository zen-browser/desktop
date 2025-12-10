// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

console.log('Loading ZenImportBookmarks.mjs');

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
});

console.log('Defining nsZenImportBookmarks class');

class nsZenImportBookmarks extends MozXULElement {
  #targetFolder = null;
  #selectedBookmarks = new Set();
  #bookmarksData = [];
  #allBookmarks = [];
  #displayLimit = 50;

  promiseInitialized = new Promise((resolve) => {
    this.resolveInitialized = resolve;
  });

  promiseRendered = new Promise((resolve) => {
    this.resolveRendered = resolve;
  });

  static get elementsToDisable() {
    return [
      'cmd_zenOpenWorkspacePanel',
      'cmd_zenOpenWorkspaceCreation',
      'cmd_zenOpenFolderCreation',
      'cmd_zenToggleSidebar',
      'cmd_newNavigatorTab',
      'cmd_newNavigatorTabNoEvent',
      'cmd_zenImportBookmarksToFolder',
    ];
  }

  static get markup() {
    return `
        <vbox class="zen-import-bookmarks" flex="1">
          <form>
            <vbox>
              <html:h1 data-l10n-id="zen-import-bookmarks-header" class="zen-import-bookmarks-title" />
              <html:div>
                <label data-l10n-id="zen-import-bookmarks-label" class="zen-import-bookmarks-label" />
              </html:div>
            </vbox>
            <html:input type="search" class="zen-import-bookmarks-search" placeholder="Search bookmarks..." />
            <hbox class="zen-import-bookmarks-controls">
              <button class="zen-import-bookmarks-select-all" data-l10n-id="zen-import-bookmarks-select-all" />
              <button class="zen-import-bookmarks-select-none" data-l10n-id="zen-import-bookmarks-select-none" />
            </hbox>
            <scrollbox class="zen-import-bookmarks-list-scrollbox" flex="1">
              <vbox class="zen-import-bookmarks-list" />
            </scrollbox>
            <hbox class="zen-import-bookmarks-buttons">
              <button class="zen-import-bookmarks-import-button footer-button primary"
                data-l10n-id="zen-import-bookmarks-import" disabled="true" />
              <button class="zen-import-bookmarks-cancel-button footer-button"
                data-l10n-id="zen-general-cancel-label" />
            </hbox>
          </form>
        </vbox>
      `;
  }

  get folderId() {
    return this.getAttribute('folder-id');
  }

  get elementsToAnimate() {
    return [
      this.querySelector('.zen-import-bookmarks-title'),
      this.querySelector('.zen-import-bookmarks-label').parentElement,
      this.searchInput,
      this.querySelector('.zen-import-bookmarks-controls'),
      this.querySelector('.zen-import-bookmarks-list-scrollbox'),
      this.importButton.parentNode,
      this.cancelButton,
    ];
  }

  connectedCallback() {
    console.log('ZenImportBookmarks connectedCallback called');
    if (this.delayConnectedCallback()) {
      console.log('Delaying callback');
      return;
    }

    // Reset promises for each connection
    this.promiseInitialized = new Promise((resolve) => {
      this.resolveInitialized = resolve;
    });
    this.promiseRendered = new Promise((resolve) => {
      this.resolveRendered = resolve;
    });

    // Clear any existing content first
    this.innerHTML = '';

    console.log('Appending fragment');
    this.appendChild(this.constructor.fragment);
    console.log('Initializing attribute inheritance');
    this.initializeAttributeInheritance();
    console.log('Attribute inheritance initialized');

    console.log('Querying elements');
    this.bookmarksList = this.querySelector('.zen-import-bookmarks-list');
    this.searchInput = this.querySelector('.zen-import-bookmarks-search');
    this.selectAllButton = this.querySelector('.zen-import-bookmarks-select-all');
    this.selectNoneButton = this.querySelector('.zen-import-bookmarks-select-none');
    this.importButton = this.querySelector('.zen-import-bookmarks-import-button');
    this.cancelButton = this.querySelector('.zen-import-bookmarks-cancel-button');
    console.log('Elements found:', {
      bookmarksList: !!this.bookmarksList,
      searchInput: !!this.searchInput,
      selectAllButton: !!this.selectAllButton,
      selectNoneButton: !!this.selectNoneButton,
      importButton: !!this.importButton,
      cancelButton: !!this.cancelButton
    });

    // Find the target folder
    console.log('Finding target folder:', this.folderId);
    this.#targetFolder = document.getElementById(this.folderId);
    if (!this.#targetFolder) {
      console.error('Target folder not found:', this.folderId);
      this.remove();
      return;
    }
    console.log('Target folder found:', this.#targetFolder);

    // Set initial opacity for animation
    for (const element of this.elementsToAnimate) {
      if (!element) {
        console.warn('Element to animate is null/undefined');
        continue;
      }
      element.style.opacity = 0;
    }

    for (const element of nsZenImportBookmarks.elementsToDisable) {
      const el = document.getElementById(element);
      if (el) {
        el.setAttribute('disabled', 'true');
      }
    }

    this.selectAllButton.addEventListener('command', this.#onSelectAll.bind(this));
    this.selectNoneButton.addEventListener('command', this.#onSelectNone.bind(this));
    this.importButton.addEventListener('command', this.#onImportButtonCommand.bind(this));
    this.cancelButton.addEventListener('command', this.#onCancelButtonCommand.bind(this));
    this.searchInput.addEventListener('input', this.#onSearchInput.bind(this));

    document.getElementById('zen-sidebar-splitter').style.pointerEvents = 'none';

    console.log('Starting initialization');
    (async () => {
        // Load bookmarks
        console.log('Loading bookmarks');
        await this.#loadBookmarks();
        console.log('Bookmarks loaded, rendering');
        this.#renderBookmarks();
        console.log('Bookmarks rendered');

        this.resolveInitialized();

        // Wait a frame for layout
        await new Promise(resolve => requestAnimationFrame(resolve));
        this.resolveRendered();
        console.log('Content ready for display');

        // Animate elements in
        await gZenUIManager.motion.animate(
          this.elementsToAnimate,
          {
            y: [20, 0],
            opacity: [0, 1],
            filter: ['blur(2px)', 'blur(0)'],
          },
          {
            duration: 0.6,
            type: 'spring',
            bounce: 0,
            delay: gZenUIManager.motion.stagger(0.05, { startDelay: 0.2 }),
          }
        );
        console.log('Animation complete!');
      })().catch(err => {
        console.error('Animation or loading error:', err);
      });
  }

  // Helper function to recursively collect bookmarks from a tree node
  #collectBookmarksFromTree(node, bookmarks = []) {
    if (node.type === lazy.PlacesUtils.TYPE_X_MOZ_PLACE) {
      // This is a bookmark
      if (node.uri) {
        bookmarks.push({
          guid: node.guid,
          title: node.title || node.uri,
          url: node.uri,
        });
      }
    } else if (node.children) {
      // This is a folder with children, recurse into it
      for (const child of node.children) {
        this.#collectBookmarksFromTree(child, bookmarks);
      }
    }
    return bookmarks;
  }

  async #loadBookmarks() {
    this.#bookmarksData = [];
    this.#allBookmarks = [];

    const rootFolders = [
      { guid: lazy.PlacesUtils.bookmarks.toolbarGuid, name: 'zen-import-bookmarks-folder-toolbar' },
      { guid: lazy.PlacesUtils.bookmarks.menuGuid, name: 'zen-import-bookmarks-folder-menu' },
      { guid: lazy.PlacesUtils.bookmarks.unfiledGuid, name: 'zen-import-bookmarks-folder-other' },
    ];

    for (const folder of rootFolders) {
      // Get the full bookmark tree for this folder
      const tree = await lazy.PlacesUtils.promiseBookmarksTree(folder.guid);

      // Recursively collect all bookmarks from this tree
      const bookmarks = this.#collectBookmarksFromTree(tree);

      // Add folder name to each bookmark
      bookmarks.forEach(bookmark => {
        bookmark.folderName = folder.name;
      });

      if (bookmarks.length > 0) {
        this.#bookmarksData.push({
          folderName: folder.name,
          bookmarks: bookmarks,
        });
        this.#allBookmarks.push(...bookmarks);
      }
    }
    console.log(`Loaded ${this.#bookmarksData.reduce((sum, group) => sum + group.bookmarks.length, 0)} bookmarks from ${this.#bookmarksData.length} folders`);
  }

  #renderBookmarks(searchQuery = '') {
    // Clear existing content
    this.bookmarksList.innerHTML = '';

    let bookmarksToDisplay = this.#allBookmarks;

    // Filter by search query if provided
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      bookmarksToDisplay = this.#allBookmarks.filter(bookmark =>
        bookmark.title.toLowerCase().includes(query) ||
        bookmark.url.toLowerCase().includes(query)
      );
    }

    // Limit to displayLimit
    bookmarksToDisplay = bookmarksToDisplay.slice(0, this.#displayLimit);

    if (bookmarksToDisplay.length === 0) {
      const emptyLabel = document.createElement('label');
      emptyLabel.textContent = searchQuery ? 'No bookmarks found' : 'No bookmarks available';
      emptyLabel.classList.add('zen-import-bookmarks-empty');
      this.bookmarksList.appendChild(emptyLabel);
      // Disable import and select buttons when there are no bookmarks
      this.importButton.setAttribute('disabled', 'true');
      this.selectAllButton.setAttribute('disabled', 'true');
      this.selectNoneButton.setAttribute('disabled', 'true');
      return;
    }

    // Group bookmarks by folder for display
    const groupedByFolder = new Map();
    for (const bookmark of bookmarksToDisplay) {
      if (!groupedByFolder.has(bookmark.folderName)) {
        groupedByFolder.set(bookmark.folderName, []);
      }
      groupedByFolder.get(bookmark.folderName).push(bookmark);
    }

    // Render grouped bookmarks
    for (const [folderName, bookmarks] of groupedByFolder) {
      // Folder separator
      const separator = document.createElement('label');
      separator.setAttribute('data-l10n-id', folderName);
      separator.classList.add('zen-import-bookmarks-folder-separator');
      this.bookmarksList.appendChild(separator);

      // Bookmark items
      for (const bookmark of bookmarks) {
        const item = document.createXULElement('hbox');
        item.classList.add('zen-import-bookmarks-item');
        item.setAttribute('align', 'center');

        const checkbox = document.createXULElement('checkbox');
        checkbox.classList.add('zen-import-bookmarks-checkbox');
        checkbox.setAttribute('data-guid', bookmark.guid);
        checkbox.addEventListener('command', () => this.#onCheckboxChange());

        const favicon = document.createElement('image');
        favicon.classList.add('zen-import-bookmarks-favicon');
        favicon.setAttribute('src', `page-icon:${bookmark.url}`);

        const label = document.createElement('label');
        label.classList.add('zen-import-bookmarks-item-label');
        label.textContent = bookmark.title;
        label.setAttribute('flex', '1');
        label.setAttribute('crop', 'end');

        item.appendChild(checkbox);
        item.appendChild(favicon);
        item.appendChild(label);

        this.bookmarksList.appendChild(item);
      }
    }

    // Show count if limited
    if (this.#allBookmarks.length > this.#displayLimit && !searchQuery) {
      const countLabel = document.createElement('label');
      countLabel.textContent = `Showing ${bookmarksToDisplay.length} of ${this.#allBookmarks.length} bookmarks. Use search to find more.`;
      countLabel.classList.add('zen-import-bookmarks-count');
      countLabel.style.cssText = 'opacity: 0.6; text-align: center; padding: 10px; font-size: 0.9em;';
      this.bookmarksList.appendChild(countLabel);
    }
  }

  #onSearchInput(event) {
    const searchQuery = event.target.value.trim();
    this.#renderBookmarks(searchQuery);
  }

  #onCheckboxChange() {
    const checkboxes = this.querySelectorAll('.zen-import-bookmarks-checkbox');
    this.#selectedBookmarks.clear();

    for (const checkbox of checkboxes) {
      if (checkbox.hasAttribute('checked')) {
        this.#selectedBookmarks.add(checkbox.getAttribute('data-guid'));
      }
    }

    this.importButton.disabled = this.#selectedBookmarks.size === 0;
  }

  #onSelectAll() {
    const checkboxes = this.querySelectorAll('.zen-import-bookmarks-checkbox');
    for (const checkbox of checkboxes) {
      checkbox.setAttribute('checked', 'true');
    }
    this.#onCheckboxChange();
  }

  #onSelectNone() {
    const checkboxes = this.querySelectorAll('.zen-import-bookmarks-checkbox');
    for (const checkbox of checkboxes) {
      checkbox.removeAttribute('checked');
    }
    this.#onCheckboxChange();
  }

  async #onImportButtonCommand() {
    if (this.#selectedBookmarks.size === 0) {
      return;
    }

    // Collect selected bookmarks
    const bookmarksToImport = [];
    for (const group of this.#bookmarksData) {
      for (const bookmark of group.bookmarks) {
        if (this.#selectedBookmarks.has(bookmark.guid)) {
          bookmarksToImport.push(bookmark);
        }
      }
    }

    // Get workspace ID from folder
    const workspaceId = this.#targetFolder.getAttribute('zen-workspace-id');

    // Create tabs
    const newTabs = [];
    for (const bookmark of bookmarksToImport) {
      try {
        const tab = gBrowser.addTab(bookmark.url, {
          skipAnimation: true,
          pinned: true,
          triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        });
        gBrowser.pinTab(tab);
        tab.setAttribute('zen-workspace-id', workspaceId);
        newTabs.push(tab);
      } catch (error) {
        console.error(`Failed to create tab for bookmark: ${bookmark.title}`, error);
      }
    }

    if (newTabs.length > 0) {
      // Add tabs to folder
      this.#targetFolder.addTabs(newTabs);

      // Flush tab state
      for (const tab of newTabs) {
        gBrowser.TabStateFlusher.flush(tab.linkedBrowser);
      }

      // Animate the newly added tabs (nudge to the right)
      await this.#animateAddedTabs(newTabs);
    }

    await this.#cleanup();
  }

  async #animateAddedTabs(tabs) {
    if (tabs.length === 0) return;

    await gZenUIManager.motion.animate(
      tabs,
      {
        x: [0, 10, 0],
      },
      {
        duration: 0.3,
        type: 'spring',
        bounce: 0.2,
        delay: gZenUIManager.motion.stagger(0.05),
      }
    );
  }

  async #onCancelButtonCommand() {
    await this.#cleanup();
  }

  async #cleanup() {
    // Animate elements out
    await gZenUIManager.motion.animate(
      this.elementsToAnimate.reverse(),
      {
        y: [0, 20],
        opacity: [1, 0],
        filter: ['blur(0)', 'blur(2px)'],
      },
      {
        duration: 0.4,
        type: 'spring',
        bounce: 0,
        delay: gZenUIManager.motion.stagger(0.05),
      }
    );

    document.getElementById('zen-sidebar-splitter').style.pointerEvents = '';

    for (const element of this.constructor.elementsToDisable) {
      const el = document.getElementById(element);
      if (el) {
        el.removeAttribute('disabled');
      }
    }

    // Close the panel
    const panel = document.getElementById('PanelUI-zen-import-bookmarks');
    if (panel) {
      PanelMultiView.hidePopup(panel);
    }
  }
}

console.log('Registering zen-import-bookmarks custom element');
customElements.define('zen-import-bookmarks', nsZenImportBookmarks);
console.log('zen-import-bookmarks custom element registered');
