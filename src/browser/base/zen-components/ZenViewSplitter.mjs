class SplitLeafNode {
  /**
   * The percentage of the size of the parent the node takes up, dependent on parent direction this is either
   * width or height.
   * @type {number}
   */
  sizeInParent;
  /**
   * @type {Object}
   */
  positionToRoot; // position relative to root node
  /**
   * @type {SplitNode}
   */
  parent;
  constructor(tab, sizeInParent) {
    this.tab = tab;
    this.sizeInParent = sizeInParent;
  }

  get heightInParent() {
    return this.parent.direction === 'column' ? this.sizeInParent : 100;
  }

  get widthInParent() {
    return this.parent.direction === 'row' ? this.sizeInParent : 100;
  }
}

class SplitNode extends SplitLeafNode {
  /**
   * @type {string}
   */
  direction;
  _children = [];

  constructor(direction, sizeInParent) {
    super(null, sizeInParent);
    this.sizeInParent = sizeInParent;
    this.direction = direction; // row or column
  }

  set children(children) {
    if (children) children.forEach((c) => (c.parent = this));
    this._children = children;
  }

  get children() {
    return this._children;
  }

  addChild(child, prepend = true) {
    child.parent = this;
    if (prepend) {
      this._children.unshift(child);
    } else {
      this._children.push(child);
    }
  }
}

class ZenViewSplitter extends ZenDOMOperatedFeature {
  currentView = -1;
  canChangeTabOnHover = false;
  _data = [];
  _tabBrowserPanel = null;
  __modifierElement = null;
  __hasSetMenuListener = false;
  overlay = null;
  _splitNodeToSplitters = new Map();
  _tabToSplitNode = new Map();
  dropZone;
  _edgeHoverSize;
  minResizeWidth;

  _lastOpenedTab = null;

  MAX_TABS = 4;

  init() {
    XPCOMUtils.defineLazyPreferenceGetter(this, 'canChangeTabOnHover', 'zen.splitView.change-on-hover', false);
    XPCOMUtils.defineLazyPreferenceGetter(this, 'minResizeWidth', 'zen.splitView.min-resize-width', 7);
    XPCOMUtils.defineLazyPreferenceGetter(this, '_edgeHoverSize', 'zen.splitView.rearrange-edge-hover-size', 24);

    ChromeUtils.defineLazyGetter(this, 'overlay', () => document.getElementById('zen-splitview-overlay'));

    ChromeUtils.defineLazyGetter(this, 'dropZone', () => document.getElementById('zen-splitview-dropzone'));

    window.addEventListener('TabClose', this.handleTabClose.bind(this));
    window.addEventListener('TabSelect', this.onTabSelect.bind(this));
    this.initializeContextMenu();
    this.insertPageActionButton();
    this.insertIntoContextMenu();

    // Add drag over listener to the browser view
    if (Services.prefs.getBoolPref('zen.splitView.enable-tab-drop')) {
      const tabBox = document.getElementById('tabbrowser-tabbox');
      tabBox.addEventListener('dragover', this.onBrowserDragOverToSplit.bind(this));
      this.onBrowserDragEndToSplit = this.onBrowserDragEndToSplit.bind(this);
    }
  }

  insertIntoContextMenu() {
    const sibling = document.getElementById('context-sep-open');
    const menuitem = document.createXULElement('menuitem');
    menuitem.setAttribute('id', 'context-zenSplitLink');
    menuitem.setAttribute('hidden', 'true');
    menuitem.setAttribute('oncommand', 'gZenViewSplitter.splitLinkInNewTab();');
    menuitem.setAttribute('data-l10n-id', 'zen-split-link');
    sibling.insertAdjacentElement('beforebegin', menuitem);
  }

  /**
   * @param {Event} event - The event that triggered the tab close.
   * @description Handles the tab close event.7
   */
  handleTabClose(event) {
    const tab = event.target;
    if (tab === this._lastOpenedTab) {
      this._lastOpenedTab = null;
    }
    const groupIndex = this._data.findIndex((group) => group.tabs.includes(tab));
    if (groupIndex < 0) {
      return;
    }
    this.removeTabFromGroup(tab, groupIndex, event.forUnsplit);
  }

  /**
   * @param {Event} event - The event that triggered the tab select.
   * @description Handles the tab select event.
   * @returns {void}
   */
  onTabSelect(event) {
    const previousTab = event.detail.previousTab;
    if (previousTab && !previousTab.hasAttribute('zen-empty-tab')) {
      this._lastOpenedTab = previousTab;
    }
  }

  /**
   * Removes a tab from a group.
   *
   * @param {Tab} tab - The tab to remove.
   * @param {number} groupIndex - The index of the group.
   * @param {boolean} forUnsplit - Indicates if the tab is being removed for unsplitting.
   */
  removeTabFromGroup(tab, groupIndex, forUnsplit) {
    const group = this._data[groupIndex];
    const tabIndex = group.tabs.indexOf(tab);
    group.tabs.splice(tabIndex, 1);

    this.resetTabState(tab, forUnsplit);
    if (tab.group && tab.group.hasAttribute('split-view-group')) {
      gBrowser.ungroupTab(tab);
    }
    if (group.tabs.length < 2) {
      // We need to remove all remaining tabs from the group when unsplitting
      let remainingTabs = [...group.tabs]; // Copy array since we'll modify it
      for (let remainingTab of remainingTabs) {
        if (remainingTab.group && remainingTab.group.hasAttribute('split-view-group')) {
          gBrowser.ungroupTab(remainingTab);
        }
        this.resetTabState(remainingTab, forUnsplit);
      }
      this.removeGroup(groupIndex);
    } else {
      const node = this.getSplitNodeFromTab(tab);
      const toUpdate = this.removeNode(node);
      this.applyGridLayout(toUpdate);
    }
  }

  onBrowserDragOverToSplit(event) {
    var dt = event.dataTransfer;
    var draggedTab;
    if (dt.mozTypesAt(0)[0] == TAB_DROP_TYPE) {
      // tab copy or move
      draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
      // not our drop then
      if (!draggedTab || gBrowser.selectedTab.hasAttribute('zen-empty-tab')) {
        return;
      }
      draggedTab.container._finishMoveTogetherSelectedTabs(draggedTab);
    }
    if (
      !draggedTab ||
      this._canDrop ||
      this._hasAnimated ||
      this.fakeBrowser ||
      !this._lastOpenedTab ||
      (this._lastOpenedTab &&
        (this._lastOpenedTab.getAttribute('zen-workspace-id') !== draggedTab.getAttribute('zen-workspace-id') ||
          this._lastOpenedTab.hasAttribute('zen-essential')))
    ) {
      return;
    }
    if (draggedTab.splitView) {
      return;
    }
    const currentView = this._data[this._lastOpenedTab.splitViewValue];
    if (currentView?.tabs.length >= this.MAX_TABS) {
      return;
    }
    const panelsRect = gBrowser.tabbox.getBoundingClientRect();
    const panelsWidth = panelsRect.width;
    if (
      event.clientX > panelsRect.left + panelsWidth - 10 ||
      event.clientX < panelsRect.left + 10 ||
      event.clientY < panelsRect.top + 10 ||
      event.clientY > panelsRect.bottom - 10
    ) {
      return;
    }
    // first quarter or last quarter of the screen, but not the middle
    if (!(event.clientX < panelsRect.left + panelsWidth / 4 || event.clientX > panelsRect.left + (panelsWidth / 4) * 3)) {
      return;
    }
    dt.mozCursor = 'default';
    const oldTab = this._lastOpenedTab;
    this._canDrop = true;
    {
      this._draggingTab = draggedTab;
      gBrowser.selectedTab = oldTab;
      this._hasAnimated = true;
      for (const tab of gBrowser.tabs) {
        tab.style.removeProperty('transform');
      }
      const panelsWidth = gBrowser.tabbox.getBoundingClientRect().width;
      const halfWidth = panelsWidth / 2;
      const side = event.clientX > halfWidth ? 'right' : 'left';
      this.fakeBrowser = document.createXULElement('vbox');
      this.fakeBrowser.addEventListener('dragleave', this.onBrowserDragEndToSplit);
      window.addEventListener('dragend', this.onBrowserDragEndToSplit, { once: true });
      const padding = Services.prefs.getIntPref('zen.theme.content-element-separation', 0);
      this.fakeBrowser.setAttribute('flex', '1');
      this.fakeBrowser.id = 'zen-split-view-fake-browser';
      if (oldTab.splitView) {
        this.fakeBrowser.setAttribute('has-split-view', 'true');
      }
      gBrowser.tabbox.appendChild(this.fakeBrowser);
      this.fakeBrowser.style.setProperty('--zen-split-view-fake-icon', `url(${draggedTab.getAttribute('image')})`);
      draggedTab._visuallySelected = true;
      this.fakeBrowser.setAttribute('side', side);
      this._finishAllAnimatingPromise = Promise.all([
        gZenUIManager.motion.animate(
          gBrowser.tabbox,
          side === 'left'
            ? {
                paddingLeft: [0, `${halfWidth}px`],
                paddingRight: 0,
              }
            : {
                paddingRight: [0, `${halfWidth}px`],
                paddingLeft: 0,
              },
          {
            duration: 0.08,
            easing: 'ease-out',
          }
        ),
        gZenUIManager.motion.animate(
          this.fakeBrowser,
          {
            width: [0, `${halfWidth - padding}px`],
            ...(side === 'left'
              ? {
                  marginLeft: [0, `${-halfWidth}px`],
                }
              : {}),
          },
          {
            duration: 0.08,
            easing: 'ease-out',
          }
        ),
      ]);
      if (this._finishAllAnimatingPromise) {
        this._finishAllAnimatingPromise.then(() => {
          this._canDrop = true;
          draggedTab._visuallySelected = true;
        });
      }
    }
  }

  onBrowserDragEndToSplit(event) {
    if (!this._canDrop) {
      return;
    }
    const panelsRect = gBrowser.tabbox.getBoundingClientRect();
    const fakeBrowserRect = this.fakeBrowser && this.fakeBrowser.getBoundingClientRect();
    if (
      (event.target.closest('#tabbrowser-tabbox') && event.target != this.fakeBrowser) ||
      (fakeBrowserRect &&
        event.clientX > fakeBrowserRect.left &&
        event.clientX < fakeBrowserRect.left + fakeBrowserRect.width &&
        event.clientY > fakeBrowserRect.top &&
        event.clientY < fakeBrowserRect.top + fakeBrowserRect.height) ||
      (event.screenX === 0 && event.screenY === 0) // It's equivalent to 0 if the event has been dropped
    ) {
      return;
    }
    if (!this._hasAnimated || !this.fakeBrowser) {
      return;
    }
    const panelsWidth = panelsRect.width;
    const halfWidth = panelsWidth / 2;
    const padding = Services.prefs.getIntPref('zen.theme.content-element-separation', 0);
    if (!this.fakeBrowser) {
      return;
    }
    this.fakeBrowser.classList.add('fade-out');
    const side = this.fakeBrowser.getAttribute('side');
    if (this._draggingTab) this._draggingTab.setAttribute('zen-has-splitted', 'true');
    this._lastOpenedTab = gBrowser.selectedTab;
    this._draggingTab = null;
    try {
      Promise.all([
        gZenUIManager.motion.animate(
          gBrowser.tabbox,
          side === 'left'
            ? {
                paddingLeft: [`${halfWidth}px`, 0],
              }
            : {
                paddingRight: [`${halfWidth}px`, 0],
              },
          {
            duration: 0.1,
            easing: 'ease-out',
          }
        ),
        gZenUIManager.motion.animate(
          this.fakeBrowser,
          {
            width: [`${halfWidth - padding * 2}px`, 0],
            ...(side === 'left'
              ? {
                  marginLeft: [`${-halfWidth}px`, 0],
                }
              : {}),
          },
          {
            duration: 0.1,
            easing: 'ease-out',
          }
        ),
      ]).then(() => {
        this._canDrop = false;
        this._maybeRemoveFakeBrowser();
      });
    } catch (e) {
      this._canDrop = false;
      this._maybeRemoveFakeBrowser();
    }
  }

  /**
   * Remove a SplitNode from its tree and the view
   * @param {SplitNode} toRemove
   * @return {SplitNode} that has to be updated
   */
  removeNode(toRemove) {
    this._removeNodeSplitters(toRemove, true);
    const parent = toRemove.parent;
    const childIndex = parent.children.indexOf(toRemove);
    parent.children.splice(childIndex, 1);
    if (parent.children.length !== 1) {
      const otherNodeIncrease = 100 / (100 - toRemove.sizeInParent);
      parent.children.forEach((c) => (c.sizeInParent *= otherNodeIncrease));
      return parent;
    }
    // node that is not a leaf cannot have less than 2 children, this makes for better resizing
    // node takes place of parent
    const leftOverChild = parent.children[0];
    leftOverChild.sizeInParent = parent.sizeInParent;
    if (parent.parent) {
      const idx = parent.parent.children.indexOf(parent);
      if (parent.parent.direction !== leftOverChild.direction) {
        leftOverChild.parent = parent.parent;
        parent.parent.children[idx] = leftOverChild;
      } else {
        // node cannot have same direction as it's parent
        leftOverChild.children.forEach((c) => {
          c.sizeInParent *= leftOverChild.sizeInParent / 100;
          c.parent = parent.parent;
        });
        parent.parent.children.splice(idx, 1, ...leftOverChild.children);
        this._removeNodeSplitters(leftOverChild, false);
      }
      this._removeNodeSplitters(parent, false);
      return parent.parent;
    } else {
      const viewData = Object.values(this._data).find((s) => s.layoutTree === parent);
      viewData.layoutTree = leftOverChild;
      leftOverChild.positionToRoot = null;
      leftOverChild.parent = null;
      return leftOverChild;
    }
  }

  /**
   * @param node
   * @param {boolean} recursive
   * @private
   */
  _removeNodeSplitters(node, recursive) {
    this.getSplitters(node)?.forEach((s) => s.remove());
    this._splitNodeToSplitters.delete(node);
    if (!recursive) return;
    if (node.children) node.children.forEach((c) => this._removeNodeSplitters(c));
  }

  get rearangeActionTarget() {
    return document.getElementById('urlbar-container');
  }

  afterRearangeAction() {
    document.getElementById('zenSplitViewModifier').hidePopup();
    gZenUIManager.showToast('zen-split-view-modifier-enabled-toast', {
      descriptionId: 'zen-split-view-modifier-enabled-toast-description',
    });
  }

  afterRearangeRemove() {
    gZenUIManager.showToast('zen-split-view-modifier-disabled-toast');
  }

  toggleWrapperDisplay(value) {
    const wrapper = this.overlay?.parentNode;
    if (!wrapper) return;

    wrapper.setAttribute('hidden', !value);
  }

  enableTabRearrangeView(tabDrag = false) {
    if (this.rearrangeViewEnabled) return;
    this.rearrangeViewEnabled = true;
    this.rearrangeViewView = this.currentView;
    if (!this._thumnailCanvas) {
      this._thumnailCanvas = document.createElement('canvas');
      this._thumnailCanvas.width = 280 * devicePixelRatio;
      this._thumnailCanvas.height = 140 * devicePixelRatio;
    }

    const browsers = this._data[this.currentView].tabs.map((t) => t.linkedBrowser);
    browsers.forEach((b) => {
      b.style.pointerEvents = 'none';
      b.style.opacity = '.85';
    });
    if (!tabDrag) {
      this.tabBrowserPanel.addEventListener('dragstart', this.onBrowserDragStart);
      this.tabBrowserPanel.addEventListener('dragend', this.onBrowserDragEnd);
    }

    this.tabBrowserPanel.addEventListener('dragover', this.onBrowserDragOver);
    this.tabBrowserPanel.addEventListener('drop', this.onBrowserDrop);

    this.tabBrowserPanel.addEventListener('click', this.disableTabRearrangeView);
    window.addEventListener('keydown', this.disableTabRearrangeView);
    if (!tabDrag) {
      this.afterRearangeAction();
    }
  }

  disableTabRearrangeView = (event = null) => {
    if (!this.rearrangeViewEnabled) return;
    if (event) {
      // Click or "ESC" key
      if ((event.type === 'click' && event.button !== 0) || (event.type === 'keydown' && event.key !== 'Escape')) {
        return;
      }
    }

    if (!this.rearrangeViewEnabled || (event && event.target.classList.contains('zen-split-view-splitter'))) {
      return;
    }

    this.tabBrowserPanel.removeEventListener('dragstart', this.onBrowserDragStart);
    this.tabBrowserPanel.removeEventListener('dragover', this.onBrowserDragOver);
    this.tabBrowserPanel.removeEventListener('drop', this.onBrowserDrop);
    this.tabBrowserPanel.removeEventListener('click', this.disableTabRearrangeView);
    window.removeEventListener('keydown', this.disableTabRearrangeView);
    const browsers = this._data[this.rearrangeViewView].tabs.map((t) => t.linkedBrowser);
    browsers.forEach((b) => {
      b.style.pointerEvents = '';
      b.style.opacity = '';
    });
    this.rearrangeViewEnabled = false;
    this.rearrangeViewView = null;
    if (!event?.type === 'dragend') {
      // Don't show toast if exiting from drag
      this.afterRearangeRemove();
    }
  };

  onBrowserDragStart = (event) => {
    if (!this.splitViewActive) return;

    let browser;
    let isSplitHeaderDrag = false;

    const container = event.target.closest('.browserSidebarContainer[zen-split]');
    if (container && event.target.closest('.zen-tab-rearrange-button')) {
      // Split tab header drag case
      const containerRect = container.getBoundingClientRect();
      const clickX = event.clientX - containerRect.left;

      // Only allow drag if click is NOT in right 20px (close button area)
      if (clickX > containerRect.width - 22) {
        return;
      }

      browser = container.querySelector('browser');
      isSplitHeaderDrag = true;
    } else {
      // Regular browser drag case
      browser = event.target.querySelector('browser');
    }

    if (!browser) return;

    const tab = gBrowser.getTabForBrowser(browser);
    if (!tab) return;

    // Store the necessary state for drag end
    this._dragState = {
      tab,
      browser,
      isSplitHeaderDrag,
    };

    if (isSplitHeaderDrag) {
      this.enableTabRearrangeView(true);
    }

    browser.style.opacity = '.2';
    event.dataTransfer.setData('text/plain', browser.closest('.browserSidebarContainer').id);
    this._draggingTab = tab;

    // Canvas setup for drag image
    let scale = window.devicePixelRatio;
    let canvas = this._dndCanvas;
    if (!canvas) {
      this._dndCanvas = canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    }

    canvas.width = 160 * scale;
    canvas.height = 90 * scale;
    let toDrag = canvas;
    let dragImageOffset = -16;
    if (gMultiProcessBrowser) {
      var context = canvas.getContext('2d');
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);

      let captureListener;
      let platform = AppConstants.platform;
      // On Windows and Mac we can update the drag image during a drag
      // using updateDragImage. On Linux, we can use a panel.
      if (platform === 'win' || platform === 'macosx') {
        captureListener = () => {
          event.dataTransfer.updateDragImage(canvas, dragImageOffset, dragImageOffset);
        };
      } else {
        // Create a panel to use it in setDragImage
        // which will tell xul to render a panel that follows
        // the pointer while a dnd session is on.
        if (!this._dndPanel) {
          this._dndCanvas = canvas;
          this._dndPanel = document.createXULElement('panel');
          this._dndPanel.className = 'dragfeedback-tab';
          this._dndPanel.setAttribute('type', 'drag');
          let wrapper = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
          wrapper.style.width = '160px';
          wrapper.style.height = '90px';
          wrapper.appendChild(canvas);
          this._dndPanel.appendChild(wrapper);
          document.documentElement.appendChild(this._dndPanel);
        }
        toDrag = this._dndPanel;
      }
      // PageThumb is async with e10s but that's fine
      // since we can update the image during the dnd.
      PageThumbs.captureToCanvas(browser, canvas)
        .then(captureListener)
        .catch((e) => console.error(e));
    } else {
      // For the non e10s case we can just use PageThumbs
      // sync, so let's use the canvas for setDragImage.
      PageThumbs.captureToCanvas(browser, canvas).catch((e) => console.error(e));
      dragImageOffset = dragImageOffset * scale;
    }
    event.dataTransfer.setDragImage(toDrag, dragImageOffset, dragImageOffset);
    return true;
  };

  onBrowserDragOver = (event) => {
    event.preventDefault();
    const browser = event.target.querySelector('browser');
    if (!browser) return;
    const tab = gBrowser.getTabForBrowser(browser);
    if (tab === this._draggingTab) {
      if (this.dropZone.hasAttribute('enabled')) {
        this.dropZone.removeAttribute('enabled');
      }
      return;
    }
    if (!this.dropZone.hasAttribute('enabled')) {
      this.dropZone.setAttribute('enabled', true);
    }
    const splitNode = this.getSplitNodeFromTab(tab);

    const posToRoot = { ...splitNode.positionToRoot };
    const browserRect = browser.getBoundingClientRect();
    const hoverSide = this.calculateHoverSide(event.clientX, event.clientY, browserRect);

    if (hoverSide !== 'center') {
      const isVertical = hoverSide === 'top' || hoverSide === 'bottom';
      const browserSize = 100 - (isVertical ? posToRoot.top + posToRoot.bottom : posToRoot.right + posToRoot.left);
      const reduce = browserSize * 0.5;

      posToRoot[this._oppositeSide(hoverSide)] += reduce;
    }
    const newInset = `${posToRoot.top}% ${posToRoot.right}% ${posToRoot.bottom}% ${posToRoot.left}%`;
    if (this.dropZone.style.inset !== newInset) {
      window.requestAnimationFrame(() => (this.dropZone.style.inset = newInset));
    }
  };

  onBrowserDragEnd = (event) => {
    this.dropZone?.removeAttribute('enabled');

    // If we don't have drag state, just clean up what we can
    if (!this._dragState) {
      this._draggingTab = null;
      return;
    }

    const { tab, browser, isSplitHeaderDrag } = this._dragState;

    if (browser) {
      browser.style.opacity = isSplitHeaderDrag ? '1' : '.85';
    }

    // Handle split view specific cleanup
    if (isSplitHeaderDrag) {
      this.disableTabRearrangeView(event);
    }

    // Clear state
    this._draggingTab = null;
    this._dragState = null;
  };

  _oppositeSide(side) {
    if (side === 'top') return 'bottom';
    if (side === 'bottom') return 'top';
    if (side === 'left') return 'right';
    if (side === 'right') return 'left';
  }

  calculateHoverSide(x, y, elementRect) {
    const hPixelHoverSize = ((elementRect.right - elementRect.left) * this._edgeHoverSize) / 100;
    const vPixelHoverSize = ((elementRect.bottom - elementRect.top) * this._edgeHoverSize) / 100;
    if (x <= elementRect.left + hPixelHoverSize) return 'left';
    if (x > elementRect.right - hPixelHoverSize) return 'right';
    if (y <= elementRect.top + vPixelHoverSize) return 'top';
    if (y > elementRect.bottom - vPixelHoverSize) return 'bottom';
    return 'center';
  }

  onBrowserDrop = (event) => {
    const browserDroppedOn = event.target.querySelector('browser');
    if (!browserDroppedOn) return;

    const droppedTab = this._draggingTab;
    if (!droppedTab) return;
    const droppedOnTab = gBrowser.getTabForBrowser(event.target.querySelector('browser'));
    if (droppedTab === droppedOnTab) return;

    const hoverSide = this.calculateHoverSide(event.clientX, event.clientY, browserDroppedOn.getBoundingClientRect());
    const droppedSplitNode = this.getSplitNodeFromTab(droppedTab);
    const droppedOnSplitNode = this.getSplitNodeFromTab(droppedOnTab);
    if (hoverSide === 'center') {
      this.swapNodes(droppedSplitNode, droppedOnSplitNode);
      this.applyGridLayout(this._data[this.currentView].layoutTree);
      return;
    }
    this.removeNode(droppedSplitNode);
    this.splitIntoNode(droppedOnSplitNode, droppedSplitNode, hoverSide, 0.5);
    this.activateSplitView(this._data[this.currentView], true);
  };

  /**
   *
   * @param node1
   * @param node2
   */
  swapNodes(node1, node2) {
    this._swapField('sizeInParent', node1, node2);

    const node1Idx = node1.parent.children.indexOf(node1);
    const node2Idx = node2.parent.children.indexOf(node2);
    node1.parent.children[node1Idx] = node2;
    node2.parent.children[node2Idx] = node1;

    this._swapField('parent', node1, node2);
  }

  /**
   *
   * @param node
   * @param nodeToInsert
   * @param side
   * @param sizeOfInsertedNode percentage of node width or height that nodeToInsert will take
   */
  splitIntoNode(node, nodeToInsert, side, sizeOfInsertedNode) {
    const splitDirection = side === 'left' || side === 'right' ? 'row' : 'column';
    const splitPosition = side === 'left' || side === 'top' ? 0 : 1;

    let nodeSize;
    let newParent;
    if (splitDirection === node.parent?.direction) {
      newParent = node.parent;
      nodeSize = node.sizeInParent;
    } else {
      nodeSize = 100;
      newParent = new SplitNode(splitDirection, node.sizeInParent);
      if (node.parent) {
        newParent.parent = node.parent;
        const nodeIndex = node.parent.children.indexOf(node);
        node.parent.children[nodeIndex] = newParent;
      } else {
        const viewData = Object.values(this._data).find((s) => s.layoutTree === node);
        viewData.layoutTree = newParent;
      }
      newParent.addChild(node);
    }
    node.sizeInParent = (1 - sizeOfInsertedNode) * nodeSize;
    nodeToInsert.sizeInParent = nodeSize * sizeOfInsertedNode;

    const index = newParent.children.indexOf(node);
    newParent.children.splice(index + splitPosition, 0, nodeToInsert);
    nodeToInsert.parent = newParent;
  }

  _swapField(fieldName, obj1, obj2) {
    const swap = obj1[fieldName];
    obj1[fieldName] = obj2[fieldName];
    obj2[fieldName] = swap;
  }

  /**
   * Resets the state of a tab.
   *
   * @param {Tab} tab - The tab to reset.
   * @param {boolean} forUnsplit - Indicates if the tab is being reset for unsplitting.
   */
  resetTabState(tab, forUnsplit) {
    tab.splitView = false;
    delete tab.splitViewValue;
    tab.removeAttribute('split-view');
    tab.linkedBrowser.zenModeActive = false;
    const container = tab.linkedBrowser.closest('.browserSidebarContainer');
    this._removeHeader(container);
    this.resetContainerStyle(container);
    container.removeEventListener('mousedown', this.handleTabEvent);
    container.removeEventListener('mouseover', this.handleTabEvent);
    if (!forUnsplit) {
      tab.linkedBrowser.docShellIsActive = false;
    }
  }

  /**
   * Removes a group.
   *
   * @param {number} groupIndex - The index of the group to remove.
   */
  removeGroup(groupIndex) {
    const group = this._data[groupIndex];
    gZenFolders.expandGroupTabs(group);
    if (this.currentView === groupIndex) {
      this.deactivateCurrentSplitView();
    }
    for (const tab of this._data[groupIndex].tabs) {
      this.resetTabState(tab, true);
    }
    this._data.splice(groupIndex, 1);
  }

  /**
   * context menu item display update
   */
  insetUpdateContextMenuItems() {
    const contentAreaContextMenu = document.getElementById('tabContextMenu');
    contentAreaContextMenu.addEventListener('popupshowing', () => {
      const tabCountInfo = JSON.stringify({
        tabCount: window.gBrowser.selectedTabs.length,
      });
      document.getElementById('context_zenSplitTabs').setAttribute('data-l10n-args', tabCountInfo);
      document.getElementById('context_zenSplitTabs').disabled = !this.contextCanSplitTabs();
    });
  }

  /**
   * Inserts the split view tab context menu item.
   */
  insertSplitViewTabContextMenu() {
    const element = window.MozXULElement.parseXULToFragment(`
      <menuseparator/>
      <menuitem id="context_zenSplitTabs"
                data-lazy-l10n-id="tab-zen-split-tabs"
                oncommand="gZenViewSplitter.contextSplitTabs();"/>
      <menuseparator/>
    `);
    document.getElementById('context_closeDuplicateTabs').after(element);
  }

  /**
   * Initializes the context menu.
   */
  initializeContextMenu() {
    this.insertSplitViewTabContextMenu();
    this.insetUpdateContextMenuItems();
  }

  /**
   * Insert Page Action button
   */
  insertPageActionButton() {
    const element = window.MozXULElement.parseXULToFragment(`
      <hbox id="zen-split-views-box"
          hidden="true"
          role="button"
          class="urlbar-page-action"
          onclick="gZenViewSplitter.openSplitViewPanel(event);">
        <image id="zen-split-views-button"
              class="urlbar-icon"/>
      </hbox>
    `);
    document.getElementById('star-button-box').after(element);
  }

  /**
   * Gets the tab browser panel.
   *
   * @returns {Element} The tab browser panel.
   */
  get tabBrowserPanel() {
    if (!this._tabBrowserPanel) {
      this._tabBrowserPanel = document.getElementById('tabbrowser-tabpanels');
    }
    return this._tabBrowserPanel;
  }

  get splitViewActive() {
    return this.currentView >= 0;
  }

  /**
   * Splits a link in a new tab.
   */
  splitLinkInNewTab() {
    const url =
      window.gContextMenu.linkURL ||
      window.gContextMenu.mediaURL ||
      window.gContextMenu.contentData.docLocation ||
      window.gContextMenu.target.ownerDocument.location.href;
    const currentTab = window.gBrowser.selectedTab;
    const newTab = this.openAndSwitchToTab(url);
    this.splitTabs([currentTab, newTab]);
  }

  /**
   * Splits the selected tabs.
   */
  contextSplitTabs() {
    const tabs = window.gBrowser.selectedTabs;
    this.splitTabs(tabs);
  }

  /**
   * Checks if the selected tabs can be split.
   *
   * @returns {boolean} True if the tabs can be split, false otherwise.
   */
  contextCanSplitTabs() {
    if (window.gBrowser.selectedTabs.length < 2 || window.gBrowser.selectedTabs.length > this.MAX_TABS) {
      return false;
    }
    for (const tab of window.gBrowser.selectedTabs) {
      if (tab.splitView || tab.hasAttribute('zen-empty-tab') || tab.hasAttribute('zen-essential')) {
        return false;
      }
    }
    return true;
  }

  /**
   * Handles the location change event.
   *
   * @param {Browser} browser - The browser instance.
   */
  async onLocationChange(browser) {
    this.disableTabRearrangeView();
    const tab = window.gBrowser.getTabForBrowser(browser);
    this.updateSplitViewButton(!tab?.splitView);
    if (tab) {
      this.updateSplitView(tab);
      tab.linkedBrowser.docShellIsActive = true;
    }
    this._maybeRemoveFakeBrowser();
  }

  /**
   * @param {Tab} tab
   */
  _moveTabsToContainer(tabs, relativeTab) {
    const relativeTabIsPinned = relativeTab.pinned;
    const relativeTabIsEssential = relativeTab.hasAttribute('zen-essential');

    if (relativeTabIsEssential) {
      gZenPinnedTabManager.addToEssentials(tabs);
    } else {
      for (const tab of tabs) {
        if (relativeTabIsPinned) {
          gBrowser.pinTab(tab);
        } else {
          gBrowser.unpinTab(tab);
        }
      }
    }
  }

  /**
   * Splits the given tabs.
   *
   * @param {Tab[]} tabs - The tabs to split.
   * @param {string} gridType - The type of grid layout.
   */
  splitTabs(tabs, gridType, initialIndex = 0) {
    // TODO: Add support for splitting essential tabs
    tabs = tabs.filter((t) => !t.hidden && !t.hasAttribute('zen-empty-tab') && !t.hasAttribute('zen-essential'));
    if (tabs.length < 2 || tabs.length > this.MAX_TABS) {
      return;
    }
    this._moveTabsToContainer(tabs, tabs[initialIndex]);

    const existingSplitTab = tabs.find((tab) => tab.splitView);
    if (existingSplitTab) {
      const groupIndex = this._data.findIndex((group) => group.tabs.includes(existingSplitTab));
      const group = this._data[groupIndex];
      const gridTypeChange = gridType && group.gridType !== gridType;
      const newTabsAdded = tabs.find((t) => !group.tabs.includes(t));
      if (gridTypeChange || !newTabsAdded) {
        // reset layout
        group.gridType = gridType;
        group.layoutTree = this.calculateLayoutTree([...new Set(group.tabs.concat(tabs))], gridType);
      } else {
        // Add any tabs that are not already in the group
        for (let i = 0; i < tabs.length; i++) {
          const tab = tabs[i];
          if (!group.tabs.includes(tab) && tab.pinned === !!group.pinned) {
            gBrowser.moveTabToGroup(tab, this._getSplitViewGroup(tabs));
            this.addTabToSplit(tab, group.layoutTree);
          }
        }
      }
      this.activateSplitView(group, true);
      return;
    }
    gridType ??= 'grid';

    const splitData = {
      tabs,
      gridType,
      layoutTree: this.calculateLayoutTree(tabs, gridType),
    };
    this._data.push(splitData);
    window.gBrowser.selectedTab = tabs[0];

    // Add tabs to the split view group
    let splitGroup = this._getSplitViewGroup(tabs);
    if (splitGroup) {
      for (const tab of tabs) {
        if (!tab.group || tab.group !== splitGroup) {
          gBrowser.moveTabToGroup(tab, splitGroup);
        }
      }
    }
    this.activateSplitView(splitData);
  }

  addTabToSplit(tab, splitNode, prepend = true) {
    const reduce = splitNode.children.length / (splitNode.children.length + 1);
    splitNode.children.forEach((c) => (c.sizeInParent *= reduce));
    splitNode.addChild(new SplitLeafNode(tab, (1 - reduce) * 100), prepend);
  }

  /**
   * Updates the split view.
   *
   * @param {Tab} tab - The tab to update the split view for.
   */
  updateSplitView(tab) {
    const oldView = this.currentView;
    const newView = this._data.findIndex((group) => group.tabs.includes(tab));

    if (oldView === newView) return;
    if (newView < 0 && oldView >= 0) {
      this.updateSplitViewButton(true);
      this.deactivateCurrentSplitView();
      return;
    }
    this.disableTabRearrangeView();
    this.activateSplitView(this._data[newView]);
  }

  /**
   * Deactivates the split view.
   */
  deactivateCurrentSplitView() {
    for (const tab of this._data[this.currentView].tabs) {
      const container = tab.linkedBrowser.closest('.browserSidebarContainer');
      this.resetContainerStyle(container);
    }
    this.removeSplitters();
    this.tabBrowserPanel.removeAttribute('zen-split-view');
    this.setTabsDocShellState(this._data[this.currentView].tabs, false);
    this.updateSplitViewButton(true);
    this.currentView = -1;
    this.toggleWrapperDisplay(false);
  }

  /**
   * Activates the split view.
   *
   * @param {object} splitData - The split data.
   */
  activateSplitView(splitData, reset = false) {
    const oldView = this.currentView;
    const newView = this._data.indexOf(splitData);
    if (oldView >= 0 && oldView !== newView) this.deactivateCurrentSplitView();
    this.currentView = newView;
    if (reset) this.removeSplitters();
    splitData.tabs.forEach((tab) => {
      if (tab.hasAttribute('pending')) {
        gBrowser.getBrowserForTab(tab).reload();
      }
    });

    this.tabBrowserPanel.setAttribute('zen-split-view', 'true');

    this.setTabsDocShellState(splitData.tabs, true);
    this.updateSplitViewButton(false);
    this.applyGridToTabs(splitData.tabs);
    this.applyGridLayout(splitData.layoutTree);
    this.toggleWrapperDisplay(true);
  }

  calculateLayoutTree(tabs, gridType) {
    let rootNode;
    if (gridType === 'vsep' || (tabs.length === 2 && gridType === 'grid')) {
      rootNode = new SplitNode('row');
      rootNode.children = tabs.map((tab) => new SplitLeafNode(tab, 100 / tabs.length));
    } else if (gridType === 'hsep') {
      rootNode = new SplitNode('column');
      rootNode.children = tabs.map((tab) => new SplitLeafNode(tab, 100 / tabs.length));
    } else if (gridType === 'grid') {
      rootNode = new SplitNode('row');
      const rowWidth = 100 / Math.ceil(tabs.length / 2);
      for (let i = 0; i < tabs.length - 1; i += 2) {
        const columnNode = new SplitNode('column', rowWidth, 100);
        columnNode.children = [new SplitLeafNode(tabs[i], 50), new SplitLeafNode(tabs[i + 1], 50)];
        rootNode.addChild(columnNode);
      }
      if (tabs.length % 2 !== 0) {
        rootNode.addChild(new SplitLeafNode(tabs[tabs.length - 1], rowWidth));
      }
    }

    return rootNode;
  }

  /**
   * Applies the grid layout to the tabs.
   *
   * @param {Tab[]} tabs - The tabs to apply the grid layout to.
   * @param {Tab} activeTab - The active tab.
   */
  applyGridToTabs(tabs) {
    tabs.forEach((tab, index) => {
      tab.splitView = true;
      tab.splitViewValue = this.currentView;
      tab.setAttribute('split-view', 'true');
      const container = tab.linkedBrowser?.closest('.browserSidebarContainer');
      if (!container?.querySelector('.zen-tab-rearrange-button')) {
        // insert a header into the container
        const header = this._createHeader(container);
        container.insertBefore(header, container.firstChild);
      }
      this.styleContainer(container);
    });
  }

  /**
   * Creates a header for the tab.
   * @param container
   * @returns {*|!Element|HTMLElement|HTMLUnknownElement|HTMLDirectoryElement|HTMLFontElement|HTMLFrameElement|HTMLFrameSetElement|HTMLPreElement|HTMLMarqueeElement|HTMLParamElement}
   * @private
   */
  _createHeader(container) {
    const headerContainer = document.createElement('div');
    headerContainer.classList.add('zen-view-splitter-header-container');
    const header = document.createElement('div');
    header.classList.add('zen-view-splitter-header');
    const removeButton = document.createXULElement('toolbarbutton');
    removeButton.classList.add('zen-tab-unsplit-button');
    removeButton.addEventListener('click', () => {
      this.removeTabFromSplit(container);
    });
    const rearrangeButton = document.createXULElement('toolbarbutton');
    rearrangeButton.classList.add('zen-tab-rearrange-button');
    header.appendChild(rearrangeButton);
    header.appendChild(removeButton);
    headerContainer.appendChild(header);
    return headerContainer;
  }

  _removeHeader(container) {
    const header = container.querySelector('.zen-view-splitter-header-container');
    if (header) {
      header.remove();
    }
  }

  /**
   * Apply grid layout to tabBrowserPanel
   *
   * @param {SplitNode} splitNode SplitNode
   */
  applyGridLayout(splitNode) {
    if (!splitNode.positionToRoot) {
      splitNode.positionToRoot = { top: 0, bottom: 0, left: 0, right: 0 };
    }
    const nodeRootPosition = splitNode.positionToRoot;
    if (!splitNode.children) {
      const browserContainer = splitNode.tab.linkedBrowser.closest('.browserSidebarContainer');
      browserContainer.style.inset = `${nodeRootPosition.top}% ${nodeRootPosition.right}% ${nodeRootPosition.bottom}% ${nodeRootPosition.left}%`;
      this._tabToSplitNode.set(splitNode.tab, splitNode);
      return;
    }

    const rootToNodeWidthRatio = (100 - nodeRootPosition.right - nodeRootPosition.left) / 100;
    const rootToNodeHeightRatio = (100 - nodeRootPosition.bottom - nodeRootPosition.top) / 100;

    const splittersNeeded = splitNode.children.length - 1;
    const currentSplitters = this.getSplitters(splitNode, splittersNeeded);

    let leftOffset = nodeRootPosition.left;
    let topOffset = nodeRootPosition.top;
    splitNode.children.forEach((childNode, i) => {
      const childRootPosition = {
        top: topOffset,
        right: 100 - (leftOffset + childNode.widthInParent * rootToNodeWidthRatio),
        bottom: 100 - (topOffset + childNode.heightInParent * rootToNodeHeightRatio),
        left: leftOffset,
      };
      childNode.positionToRoot = childRootPosition;
      this.applyGridLayout(childNode);

      if (splitNode.direction === 'column') {
        topOffset += childNode.sizeInParent * rootToNodeHeightRatio;
      } else {
        leftOffset += childNode.sizeInParent * rootToNodeWidthRatio;
      }

      if (i < splittersNeeded) {
        const splitter = currentSplitters[i];
        if (splitNode.direction === 'column') {
          splitter.style.inset = `${100 - childRootPosition.bottom}% ${childRootPosition.right}% 0% ${childRootPosition.left}%`;
        } else {
          splitter.style.inset = `${childRootPosition.top}% 0% ${childRootPosition.bottom}% ${100 - childRootPosition.right}%`;
        }
      }
    });
  }

  /**
   *
   * @param {String} orient
   * @param {SplitNode} parentNode
   * @param {Number} idx
   */
  createSplitter(orient, parentNode, idx) {
    const splitter = document.createElement('div');
    splitter.className = 'zen-split-view-splitter';
    splitter.setAttribute('orient', orient);
    splitter.setAttribute('gridIdx', idx);
    this.overlay.insertAdjacentElement('afterbegin', splitter);

    splitter.addEventListener('mousedown', this.handleSplitterMouseDown);
    return splitter;
  }

  /**
   * @param {SplitNode} parentNode
   * @param {number|undefined} splittersNeeded if provided the amount of splitters for node will be adjusted to match
   */
  getSplitters(parentNode, splittersNeeded) {
    let currentSplitters = this._splitNodeToSplitters.get(parentNode) || [];
    if (!splittersNeeded || currentSplitters.length === splittersNeeded) return currentSplitters;
    for (let i = currentSplitters?.length || 0; i < splittersNeeded; i++) {
      currentSplitters.push(this.createSplitter(parentNode.direction === 'column' ? 'horizontal' : 'vertical', parentNode, i));
      currentSplitters[i].parentSplitNode = parentNode;
    }
    if (currentSplitters.length > splittersNeeded) {
      currentSplitters.slice(splittersNeeded - currentSplitters.length).forEach((s) => s.remove());
      currentSplitters = currentSplitters.slice(0, splittersNeeded);
    }
    this._splitNodeToSplitters.set(parentNode, currentSplitters);
    return currentSplitters;
  }

  removeSplitters() {
    [...this.overlay.children].filter((c) => c.classList.contains('zen-split-view-splitter')).forEach((s) => s.remove());
    this._splitNodeToSplitters.clear();
  }

  /**
   * @param {Tab} tab
   * @return {SplitNode} splitNode
   */
  getSplitNodeFromTab(tab) {
    return this._tabToSplitNode.get(tab);
  }

  /**
   * Styles the container for a tab.
   *
   * @param {Element} container - The container element.
   */
  styleContainer(container) {
    container.setAttribute('zen-split-anim', 'true');
    container.addEventListener('mousedown', this.handleTabEvent);
    container.addEventListener('mouseover', this.handleTabEvent);
  }

  /**
   * Handles tab events.
   *
   * @param {Event} event - The event.
   */
  handleTabEvent = (event) => {
    if (this.rearrangeViewEnabled || (event.type === 'mouseover' && !this.canChangeTabOnHover)) {
      return;
    }
    const container = event.currentTarget.closest('.browserSidebarContainer');
    const tab = window.gBrowser.tabs.find((t) => t.linkedBrowser.closest('.browserSidebarContainer') === container);
    if (tab) {
      window.gBrowser.selectedTab = tab;
    }
  };

  handleSplitterMouseDown = (event) => {
    this.tabBrowserPanel.setAttribute('zen-split-resizing', true);
    const isVertical = event.target.getAttribute('orient') === 'vertical';
    const dimension = isVertical ? 'width' : 'height';
    const clientAxis = isVertical ? 'clientX' : 'clientY';

    const gridIdx = parseInt(event.target.getAttribute('gridIdx'));
    const startPosition = event[clientAxis];
    const splitNode = event.target.parentSplitNode;
    let rootToNodeSize;
    if (isVertical) rootToNodeSize = 100 / (100 - splitNode.positionToRoot.right - splitNode.positionToRoot.left);
    else rootToNodeSize = 100 / (100 - splitNode.positionToRoot.bottom - splitNode.positionToRoot.top);
    const originalSizes = splitNode.children.map((c) => c.sizeInParent);

    const dragFunc = (dEvent) => {
      requestAnimationFrame(() => {
        originalSizes.forEach((s, i) => (splitNode.children[i].sizeInParent = s)); // reset changes

        const movement = dEvent[clientAxis] - startPosition;
        let movementPercent = (movement / this.tabBrowserPanel.getBoundingClientRect()[dimension]) * rootToNodeSize * 100;

        let reducingMovement = Math.max(movementPercent, -movementPercent);
        for (
          let i = gridIdx + (movementPercent < 0 ? 0 : 1);
          0 <= i && i < originalSizes.length;
          i += movementPercent < 0 ? -1 : 1
        ) {
          const current = originalSizes[i];
          const newSize = Math.max(this.minResizeWidth, current - reducingMovement);
          splitNode.children[i].sizeInParent = newSize;
          const amountReduced = current - newSize;
          reducingMovement -= amountReduced;
          if (reducingMovement <= 0) break;
        }
        const increasingMovement = Math.max(movementPercent, -movementPercent) - reducingMovement;
        const increaseIndex = gridIdx + (movementPercent < 0 ? 1 : 0);
        splitNode.children[increaseIndex].sizeInParent = originalSizes[increaseIndex] + increasingMovement;
        this.applyGridLayout(splitNode);
      });
    };

    setCursor(isVertical ? 'ew-resize' : 'ns-resize');
    document.addEventListener('mousemove', dragFunc);
    document.addEventListener(
      'mouseup',
      () => {
        document.removeEventListener('mousemove', dragFunc);
        setCursor('auto');
        this.tabBrowserPanel.removeAttribute('zen-split-resizing');
      },
      { once: true }
    );
  };

  /**
   * Sets the docshell state for the tabs.
   *
   * @param {Tab[]} tabs - The tabs.
   * @param {boolean} active - Indicates if the tabs are active.
   */
  setTabsDocShellState(tabs, active) {
    for (const tab of tabs) {
      // zenModeActive allow us to avoid setting docShellisActive to false later on,
      // see browser-custom-elements.js's patch
      tab.linkedBrowser.zenModeActive = active;
      if (!active && tab === gBrowser.selectedTab) continue;
      try {
        tab.linkedBrowser.docShellIsActive = active;
      } catch (e) {
        console.error(e);
      }
      const browser = tab.linkedBrowser.closest('.browserSidebarContainer');
      if (active) {
        browser.setAttribute('zen-split', 'true');

        browser.addEventListener('dragstart', this.onBrowserDragStart);
        browser.addEventListener('dragend', this.onBrowserDragEnd);
      } else {
        browser.removeAttribute('zen-split');
        browser.removeAttribute('style');

        browser.removeEventListener('dragstart', this.onBrowserDragStart);
        browser.removeEventListener('dragend', this.onBrowserDragEnd);
      }
    }
  }

  /**
   * Resets the container style.
   *
   * @param {Element} container - The container element.
   */
  resetContainerStyle(container) {
    container.removeAttribute('zen-split');
    container.style.inset = '';
  }

  /**
   * Updates the split view button visibility.
   *
   * @param {boolean} hidden - Indicates if the button should be hidden.
   */
  updateSplitViewButton(hidden) {
    const button = document.getElementById('zen-split-views-box');
    if (hidden) {
      button?.setAttribute('hidden', 'true');
    } else {
      button?.removeAttribute('hidden');
    }
  }

  /**
   * Gets the modifier element.
   *
   * @returns {Element} The modifier element.
   */
  get modifierElement() {
    if (!this.__modifierElement) {
      const wrapper = document.getElementById('template-zen-split-view-modifier');
      const panel = wrapper.content.firstElementChild;
      wrapper.replaceWith(wrapper.content);
      this.__modifierElement = panel;
    }
    return this.__modifierElement;
  }

  /**
   * Opens the split view panel.
   *
   * @param {Event} event - The event that triggered the panel opening.
   */
  async openSplitViewPanel(event) {
    const panel = this.modifierElement;
    const target = event.target.parentNode;
    this.updatePanelUI(panel);

    if (!this.__hasSetMenuListener) {
      this.setupPanelListeners(panel);
      this.__hasSetMenuListener = true;
    }

    window.PanelMultiView.openPopup(panel, target, {
      position: 'bottomright topright',
      triggerEvent: event,
    }).catch(console.error);
  }

  /**
   * Updates the UI of the panel.
   *
   * @param {Element} panel - The panel element.
   */
  updatePanelUI(panel) {
    for (const gridType of ['hsep', 'vsep', 'grid', 'unsplit']) {
      const selector = panel.querySelector(`.zen-split-view-modifier-preview.${gridType}`);
      selector.classList.remove('active');
      if (this.currentView >= 0 && this._data[this.currentView].gridType === gridType) {
        selector.classList.add('active');
      }
    }
  }

  /**
   * @description sets up the listeners for the panel.
   * @param {Element} panel - The panel element
   */
  setupPanelListeners(panel) {
    for (const gridType of ['hsep', 'vsep', 'grid', 'unsplit']) {
      const selector = panel.querySelector(`.zen-split-view-modifier-preview.${gridType}`);
      selector.addEventListener('click', () => this.handlePanelSelection(gridType, panel));
    }
  }

  /**
   * @description handles the panel selection.
   * @param {string} gridType - The grid type
   * @param {Element} panel - The panel element
   */
  handlePanelSelection(gridType, panel) {
    if (gridType === 'unsplit') {
      this.unsplitCurrentView();
    } else {
      const group = this._data[this.currentView];
      group.gridType = gridType;
      group.layoutTree = this.calculateLayoutTree(group.tabs, gridType);
      this.activateSplitView(group, true);
    }
    panel.hidePopup();
  }

  /**
   * @description unsplit the current view.]
   */
  unsplitCurrentView() {
    if (this.currentView < 0) return;
    this.removeGroup(this.currentView);
    const currentTab = window.gBrowser.selectedTab;
    window.gBrowser.selectedTab = currentTab;
  }

  /**
   * @description opens a new tab and switches to it.
   * @param {string} url - The url to open
   * @param {object} options - The options for the tab
   * @returns {tab} The tab that was opened
   */
  openAndSwitchToTab(url, options) {
    const parentWindow = window.ownerGlobal.parent;
    const targetWindow = parentWindow || window;
    const tab = targetWindow.gBrowser.addTrustedTab(url, options);
    targetWindow.gBrowser.selectedTab = tab;
    return tab;
  }

  toggleShortcut(gridType) {
    if (gridType === 'unsplit') {
      this.unsplitCurrentView();
      return;
    }
    const tabs = gBrowser.visibleTabs;
    if (tabs.length < 2 || this.currentView >= 0) {
      return;
    }
    let nextTabIndex = tabs.indexOf(gBrowser.selectedTab) + 1;
    if (nextTabIndex >= tabs.length) {
      // Find the first non-hidden tab
      nextTabIndex = tabs.findIndex((tab) => !tab.hidden);
    } else if (nextTabIndex < 0) {
      // reverse find the first non-hidden tab
      nextTabIndex = tabs
        .slice()
        .reverse()
        .findIndex((tab) => !tab.hidden);
    }
    const selected_tabs = gBrowser.selectedTab.multiselected
      ? gBrowser.selectedTabs
      : [gBrowser.selectedTab, tabs[nextTabIndex]];
    this.splitTabs(selected_tabs, gridType);
  }

  /**
   * @description removes the tab from the split
   * @param container - The container element
   */
  removeTabFromSplit = (container) => {
    const browser = container.querySelector('browser');
    if (browser) {
      const tab = gBrowser.getTabForBrowser(browser);
      if (tab) {
        const groupIndex = this._data.findIndex((group) => group.tabs.includes(tab));
        this.deactivateCurrentSplitView();
        if (groupIndex >= 0) {
          this.removeTabFromGroup(tab, groupIndex, true);
        }
      }
    }
  };

  _maybeRemoveFakeBrowser(select = true) {
    gBrowser.tabbox.removeAttribute('style');
    if (this.fakeBrowser) {
      delete this._hasAnimated;
      this.fakeBrowser.remove();
      this.fakeBrowser = null;
      if (this._draggingTab) this._draggingTab._visuallySelected = false;
      if (select) {
        gBrowser.selectedTab = this._draggingTab;
        this._draggingTab = null;
      }
    }
  }

  /**
   * @description moves the tab to the split view if dragged on a browser
   * @param event - The event
   * @param draggedTab - The dragged tab
   * @returns {boolean} true if the tab was moved to the split view
   */
  moveTabToSplitView(event, draggedTab) {
    const canDrop = this._canDrop;
    this._canDrop = false;

    if (!canDrop || !this.fakeBrowser) {
      this._maybeRemoveFakeBrowser(false);
      return false;
    }

    const dropSide = this.fakeBrowser?.getAttribute('side');
    const containerRect = this.fakeBrowser.getBoundingClientRect();
    const padding = Services.prefs.getIntPref('zen.theme.content-element-separation', 0);
    const dropTarget = document.elementFromPoint(
      dropSide === 'left' ? containerRect.left + containerRect.width + padding + 5 : containerRect.left - padding - 5,
      event.clientY
    );
    const browser = dropTarget?.closest('browser');

    if (!browser) {
      this._maybeRemoveFakeBrowser(false);
      return false;
    }

    gBrowser.selectedTab = this._draggingTab;
    this._draggingTab = null;
    const browserContainer = draggedTab.linkedBrowser?.closest('.browserSidebarContainer');
    if (browserContainer) {
      browserContainer.style.opacity = '0';
    }

    const droppedOnTab = gBrowser.getTabForBrowser(browser);
    if (droppedOnTab && droppedOnTab !== draggedTab) {
      // Calculate which side of the target browser the drop occurred
      // const browserRect = browser.getBoundingClientRect();
      // const hoverSide = this.calculateHoverSide(event.clientX, event.clientY, browserRect);
      const hoverSide = dropSide;

      if (droppedOnTab.splitView) {
        // Add to existing split view
        const groupIndex = this._data.findIndex((group) => group.tabs.includes(droppedOnTab));
        const group = this._data[groupIndex];

        if (!group.tabs.includes(draggedTab) && group.tabs.length < this.MAX_TABS) {
          // First move the tab to the split view group
          let splitGroup = droppedOnTab.group;
          if (splitGroup && (!draggedTab.group || draggedTab.group !== splitGroup)) {
            this._moveTabsToContainer([draggedTab], droppedOnTab);
            gBrowser.moveTabToGroup(draggedTab, splitGroup);
          }

          const droppedOnSplitNode = this.getSplitNodeFromTab(droppedOnTab);
          const parentNode = droppedOnSplitNode.parent;

          // Then add the tab to the split view
          group.tabs.push(draggedTab);

          // If dropping on a side, create a new split in that direction
          if (hoverSide !== 'center') {
            const splitDirection = hoverSide === 'left' || hoverSide === 'right' ? 'row' : 'column';
            if (parentNode.direction !== splitDirection) {
              this.splitIntoNode(droppedOnSplitNode, new SplitLeafNode(draggedTab, 50), hoverSide, 0.5);
            } else {
              this.addTabToSplit(draggedTab, parentNode, /* prepend = */ hoverSide === 'left' || hoverSide === 'top');
            }
          } else {
            this.addTabToSplit(draggedTab, group.layoutTree);
          }

          this.activateSplitView(group, true);
        }
      } else {
        // Create new split view with layout based on drop position
        let gridType = 'vsep';
        //switch (hoverSide) {
        //  case 'left':
        //  case 'right':
        //    gridType = 'vsep';
        //    break;
        //  case 'top':
        //  case 'bottom':
        //    gridType = 'hsep';
        //    break;
        //  default:
        //    gridType = 'grid';
        //}

        // Put tabs always as if it was dropped from the left
        this.splitTabs(dropSide == 'left' ? [draggedTab, droppedOnTab] : [droppedOnTab, draggedTab], gridType, 1);
      }
    }
    if (this._finishAllAnimatingPromise) {
      this._finishAllAnimatingPromise.then(() => {
        this._maybeRemoveFakeBrowser(false);
      });
    }

    if (browserContainer) {
      gZenUIManager.motion
        .animate(
          browserContainer,
          {
            scale: [0.97, 1],
            opacity: [0, 1],
          },
          {
            type: 'spring',
            bounce: 0.4,
            duration: 0.2,
            delay: 0.1,
          }
        )
        .then(() => {
          this._maybeRemoveFakeBrowser(false);
          this._finishAllAnimatingPromise = null;
        });
    }
    return true;
  }

  handleTabDrop(event, urls, replace, inBackground) {
    if (replace || urls.length !== 1) {
      return false;
    }
    const url = urls[0];
    if (!url.startsWith('panel-')) {
      return false;
    }
    const browserContainer = document.getElementById(url);
    const browser = browserContainer?.querySelector('browser');
    if (!browser) {
      return false;
    }
    const tab = gBrowser.getTabForBrowser(browser);
    if (!tab) {
      return false;
    }
    if (tab.splitView) {
      // Unsplit the tab and exit from the drag view
      this.dropZone?.removeAttribute('enabled');
      this.disableTabRearrangeView(event);
      this.removeTabFromSplit(browserContainer);
      return true;
    }
    return false;
  }

  /**
   * Gets or creates a tab group for split view tabs
   * @param {Array} tabs Initial tabs to add to the group if creating new
   * @returns {TabGroup} The tab group for split view tabs
   */
  _getSplitViewGroup(tabs) {
    if (tabs.some((tab) => tab.hasAttribute('zen-essential'))) {
      return null;
    }

    // Try to find an existing split view group
    let splitGroup = gBrowser.tabGroups.find(
      (group) => group.getAttribute('split-view-group') && group.tabs.some((tab) => tabs.includes(tab) && tab.splitView)
    );

    if (splitGroup) {
      return splitGroup;
    }

    // We can't create an empty group, so only create if we have tabs
    if (tabs?.length) {
      // Create a new group with the initial tabs
      const group = gBrowser.addTabGroup(tabs, {
        label: '',
        showCreateUI: false,
        insertBefore: tabs[0],
        forSplitView: true,
      });
    }

    return null;
  }
}

window.gZenViewSplitter = new ZenViewSplitter();
