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
  #wasInCollapsedMode = false;
  #hiddenElements = [];

  promiseInitialized = new Promise((resolve) => {
    this.resolveInitialized = resolve;
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
            <hbox class="zen-import-bookmarks-controls">
              <button class="zen-import-bookmarks-select-all" data-l10n-id="zen-import-bookmarks-select-all" />
              <button class="zen-import-bookmarks-select-none" data-l10n-id="zen-import-bookmarks-select-none" />
            </hbox>
            <scrollbox class="zen-import-bookmarks-list-scrollbox" flex="1">
              <vbox class="zen-import-bookmarks-list" />
            </scrollbox>
            <vbox class="zen-import-bookmarks-buttons">
              <html:div>
                <button class="zen-import-bookmarks-import-button footer-button primary"
                  data-l10n-id="zen-import-bookmarks-import" disabled="true" />
              </html:div>
              <button class="zen-import-bookmarks-cancel-button footer-button"
                data-l10n-id="zen-general-cancel-label" />
            </vbox>
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

    console.log('Appending fragment');
    this.appendChild(this.constructor.fragment);
    console.log('Initializing attribute inheritance');
    this.initializeAttributeInheritance();
    console.log('Attribute inheritance initialized');

    console.log('Querying elements');
    this.bookmarksList = this.querySelector('.zen-import-bookmarks-list');
    this.selectAllButton = this.querySelector('.zen-import-bookmarks-select-all');
    this.selectNoneButton = this.querySelector('.zen-import-bookmarks-select-none');
    this.importButton = this.querySelector('.zen-import-bookmarks-import-button');
    this.cancelButton = this.querySelector('.zen-import-bookmarks-cancel-button');
    console.log('Elements found:', {
      bookmarksList: !!this.bookmarksList,
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

    console.log('Setting opacity for elements to animate');
    for (const element of this.elementsToAnimate) {
      if (!element) {
        console.warn('Element to animate is null/undefined');
        continue;
      }
      element.style.opacity = 0;
    }
    console.log('Opacity set for all elements');

    this.#wasInCollapsedMode =
      document.documentElement.getAttribute('zen-sidebar-expanded') !== 'true';

    gNavToolbox.setAttribute('zen-sidebar-expanded', 'true');
    document.documentElement.setAttribute('zen-sidebar-expanded', 'true');

    window.docShell.treeOwner
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIAppWindow)
      .rollupAllPopups();

    for (const element of this.parentElement.children) {
      if (element !== this) {
        element.hidden = true;
        this.#hiddenElements.push(element);
      }
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

    document.getElementById('zen-sidebar-splitter').style.pointerEvents = 'none';

    console.log('Starting animation');
    gZenUIManager.motion
      .animate(
        [gBrowser.tabContainer, gURLBar.textbox],
        {
          opacity: [1, 0],
        },
        {
          duration: 0.3,
          type: 'spring',
          bounce: 0,
        }
      )
      .then(async () => {
        console.log('Animation complete, hiding elements');
        gBrowser.tabContainer.style.visibility = 'collapse';
        if (gZenVerticalTabsManager._hasSetSingleToolbar) {
          document.getElementById('nav-bar').style.visibility = 'collapse';
        }
        this.style.visibility = 'visible';
        gZenCompactModeManager.getAndApplySidebarWidth();

        // Load bookmarks
        console.log('Loading bookmarks');
        await this.#loadBookmarks();
        console.log('Bookmarks loaded, rendering');
        this.#renderBookmarks();
        console.log('Bookmarks rendered');

        this.resolveInitialized();
        console.log('Starting final animation');
        gZenUIManager.motion
          .animate(
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
      })
      .catch(err => {
        console.error('Animation or loading error:', err);
      });
  }

  async #loadBookmarks() {
    console.log('#loadBookmarks: Starting');
    this.#bookmarksData = [];

    const rootFolders = [
      { guid: lazy.PlacesUtils.bookmarks.toolbarGuid, name: 'zen-import-bookmarks-folder-toolbar' },
      { guid: lazy.PlacesUtils.bookmarks.menuGuid, name: 'zen-import-bookmarks-folder-menu' },
      { guid: lazy.PlacesUtils.bookmarks.unfiledGuid, name: 'zen-import-bookmarks-folder-other' },
    ];
    console.log('#loadBookmarks: Root folders:', rootFolders);

    for (const folder of rootFolders) {
      console.log('#loadBookmarks: Processing folder:', folder.name);
      const bookmarks = [];

      await lazy.PlacesUtils.bookmarks.fetch(
        { parentGuid: folder.guid },
        async (bookmark) => {
          if (bookmark.type === lazy.PlacesUtils.bookmarks.TYPE_BOOKMARK && bookmark.url) {
            bookmarks.push({
              guid: bookmark.guid,
              title: bookmark.title || bookmark.url.href,
              url: bookmark.url.href,
              folderName: folder.name,
            });
          }
        }
      );

      console.log(`#loadBookmarks: Found ${bookmarks.length} bookmarks in ${folder.name}`);
      if (bookmarks.length > 0) {
        this.#bookmarksData.push({
          folderName: folder.name,
          bookmarks: bookmarks,
        });
      }
    }
    console.log('#loadBookmarks: Complete, total data:', this.#bookmarksData.length);
  }

  #renderBookmarks() {
    if (this.#bookmarksData.length === 0) {
      const emptyLabel = document.createElement('label');
      emptyLabel.setAttribute('data-l10n-id', 'zen-import-bookmarks-empty');
      emptyLabel.classList.add('zen-import-bookmarks-empty');
      this.bookmarksList.appendChild(emptyLabel);
      // Disable import and select buttons when there are no bookmarks
      this.importButton.setAttribute('disabled', 'true');
      this.selectAllButton.setAttribute('disabled', 'true');
      this.selectNoneButton.setAttribute('disabled', 'true');
      return;
    }

    for (const group of this.#bookmarksData) {
      // Folder separator
      const separator = document.createElement('label');
      separator.setAttribute('data-l10n-id', group.folderName);
      separator.classList.add('zen-import-bookmarks-folder-separator');
      this.bookmarksList.appendChild(separator);

      // Bookmark items
      for (const bookmark of group.bookmarks) {
        const item = document.createXULElement('hbox');
        item.classList.add('zen-import-bookmarks-item');
        item.setAttribute('align', 'center');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('zen-import-bookmarks-checkbox');
        checkbox.dataset.guid = bookmark.guid;
        checkbox.addEventListener('change', () => this.#onCheckboxChange());

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
  }

  #onCheckboxChange() {
    const checkboxes = this.querySelectorAll('.zen-import-bookmarks-checkbox');
    this.#selectedBookmarks.clear();

    for (const checkbox of checkboxes) {
      if (checkbox.checked) {
        this.#selectedBookmarks.add(checkbox.dataset.guid);
      }
    }

    this.importButton.disabled = this.#selectedBookmarks.size === 0;
  }

  #onSelectAll() {
    const checkboxes = this.querySelectorAll('.zen-import-bookmarks-checkbox');
    for (const checkbox of checkboxes) {
      checkbox.checked = true;
    }
    this.#onCheckboxChange();
  }

  #onSelectNone() {
    const checkboxes = this.querySelectorAll('.zen-import-bookmarks-checkbox');
    for (const checkbox of checkboxes) {
      checkbox.checked = false;
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

    if (this.#wasInCollapsedMode) {
      gNavToolbox.removeAttribute('zen-sidebar-expanded');
      document.documentElement.removeAttribute('zen-sidebar-expanded');
    }

    gBrowser.tabContainer.style.visibility = '';
    gBrowser.tabContainer.style.opacity = 0;
    if (gZenVerticalTabsManager._hasSetSingleToolbar) {
      document.getElementById('nav-bar').style.visibility = '';
      gURLBar.textbox.style.opacity = 0;
    }

    this.remove();
    gZenUIManager.updateTabsToolbar();

    await gZenUIManager.motion.animate(
      [gBrowser.tabContainer, gURLBar.textbox],
      {
        opacity: [0, 1],
      },
      {
        duration: 0.3,
        type: 'spring',
        bounce: 0,
      }
    );

    gBrowser.tabContainer.style.opacity = '';
    if (gZenVerticalTabsManager._hasSetSingleToolbar) {
      gURLBar.textbox.style.opacity = '';
    }

    for (const element of this.#hiddenElements) {
      element.hidden = false;
    }

    this.#hiddenElements = [];
  }
}

console.log('Registering zen-import-bookmarks custom element');
customElements.define('zen-import-bookmarks', nsZenImportBookmarks);
console.log('zen-import-bookmarks custom element registered');
