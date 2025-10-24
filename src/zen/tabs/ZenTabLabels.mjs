// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * ZenTabLabels - Manages colored labels for tabs
 *
 * Features:
 * - Add colored labels to tabs via context menu
 * - Labels appear under the tab title with a color indicator
 * - Quick selection of previously created labels
 * - Session persistence of labels
 */
{
  const LABEL_COLORS = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FFEAA7', // Yellow
    '#DDA15E', // Orange
    '#BC6C25', // Brown
    '#B19CD9', // Purple
    '#FF85A2', // Pink
    '#95E1D3', // Mint
  ];

  class ZenTabLabels extends nsZenDOMOperatedFeature {
    constructor() {
      super();
      // Store label definitions: { id: { text: string, color: string } }
      this._labels = new Map();
      // Store tab->label mappings: { tabId: labelId }
      this._tabLabels = new Map();
      // Counter for generating unique label IDs
      this._labelIdCounter = 0;

      this._currentEditingTab = null;
    }

  init() {
    this._initContextMenu();
    this._initEventListeners();
    this._initDialog();
  }

  _initContextMenu() {
    // Add "Add Label" menu item to tab context menu
    const contextMenuItems = window.MozXULElement.parseXULToFragment(`
      <menu id="zen-context-menu-tab-label" data-l10n-id="zen-tab-label-menu">
        <menupopup id="zen-tab-label-popup">
          <menuitem id="zen-context-menu-new-label" data-l10n-id="zen-tab-label-new" class="menuitem-iconic" />
          <menuseparator id="zen-tab-label-separator" hidden="true"/>
          <menuitem id="zen-context-menu-edit-label" data-l10n-id="zen-tab-label-edit" hidden="true"/>
          <menuitem id="zen-context-menu-remove-label" data-l10n-id="zen-tab-label-remove" hidden="true"/>
        </menupopup>
      </menu>
    `);

    // Insert after "Reload Tab" in context menu
    const reloadTab = document.getElementById('context_reloadTab');
    if (reloadTab) {
      reloadTab.after(contextMenuItems);
    }

    // Listen for context menu opening to populate quick labels
    const labelPopup = document.getElementById('zen-tab-label-popup');
    if (labelPopup) {
      labelPopup.addEventListener('popupshowing', this._onLabelMenuShowing.bind(this));
    }
  }

  _initEventListeners() {
    // New label menu item
    const newLabelItem = document.getElementById('zen-context-menu-new-label');
    if (newLabelItem) {
      newLabelItem.addEventListener('command', () => {
        this._openLabelDialog();
      });
    }

    // Edit label menu item
    const editLabelItem = document.getElementById('zen-context-menu-edit-label');
    if (editLabelItem) {
      editLabelItem.addEventListener('command', () => {
        this._openLabelDialog(true);
      });
    }

    // Remove label menu item
    const removeLabelItem = document.getElementById('zen-context-menu-remove-label');
    if (removeLabelItem) {
      removeLabelItem.addEventListener('command', () => {
        this._removeTabLabel(TabContextMenu.contextTab);
      });
    }

    // Listen for tab close to clean up labels
    window.addEventListener('TabClose', (event) => {
      this._onTabClose(event.detail.adoptedBy ? null : event.target);
    });
  }

  _initDialog() {
    // Save button
    const saveButton = document.getElementById('zenTabLabelSave');
    if (saveButton) {
      saveButton.addEventListener('click', () => {
        this._saveLabel();
      });
    }

    // Cancel button
    const cancelButton = document.getElementById('zenTabLabelCancel');
    if (cancelButton) {
      cancelButton.addEventListener('click', () => {
        this._closeDialog();
      });
    }

    // Enter key to save
    const input = document.getElementById('zenTabLabelInput');
    if (input) {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          this._saveLabel();
        } else if (event.key === 'Escape') {
          this._closeDialog();
        }
      });
    }

    // Color picker preview
    const colorPicker = document.getElementById('zenTabLabelColorPicker');
    const colorPreview = document.querySelector('.zen-tab-label-color-preview');
    if (colorPicker && colorPreview) {
      colorPicker.addEventListener('input', (event) => {
        colorPreview.style.backgroundColor = event.target.value;
      });
    }
  }

  _onLabelMenuShowing(event) {
    const tab = TabContextMenu.contextTab;
    if (!tab) return;

    const popup = event.target;
    const separator = document.getElementById('zen-tab-label-separator');
    const editItem = document.getElementById('zen-context-menu-edit-label');
    const removeItem = document.getElementById('zen-context-menu-remove-label');

    // Remove existing quick label items
    const existingItems = popup.querySelectorAll('.zen-quick-label-item');
    existingItems.forEach(item => item.remove());

    // Check if tab has a label
    const tabId = this._getTabId(tab);
    const hasLabel = this._tabLabels.has(tabId);

    // Show/hide edit and remove items
    if (hasLabel) {
      editItem.hidden = false;
      removeItem.hidden = false;
    } else {
      editItem.hidden = true;
      removeItem.hidden = true;
    }

    // Add quick selection items for existing labels
    if (this._labels.size > 0) {
      separator.hidden = false;

      const currentLabelId = this._tabLabels.get(tabId);

      for (const [labelId, label] of this._labels) {
        const item = document.createXULElement('menuitem');
        item.classList.add('zen-quick-label-item', 'menuitem-iconic');
        item.setAttribute('label', label.text);
        item.style.setProperty('--label-color', label.color);

        if (currentLabelId === labelId) {
          item.setAttribute('checked', 'true');
          item.setAttribute('type', 'checkbox');
        }

        item.addEventListener('command', () => {
          if (currentLabelId === labelId) {
            this._removeTabLabel(tab);
          } else {
            this._applyLabelToTab(tab, labelId);
          }
        });

        separator.after(item);
      }
    } else {
      separator.hidden = true;
    }
  }

  _openLabelDialog(isEdit = false) {
    const tab = TabContextMenu.contextTab;
    if (!tab) return;

    this._currentEditingTab = tab;
    const dialog = document.getElementById('zenTabLabelDialog');
    const input = document.getElementById('zenTabLabelInput');
    const colorPicker = document.getElementById('zenTabLabelColorPicker');
    const colorPreview = document.querySelector('.zen-tab-label-color-preview');
    const title = document.getElementById('zenTabLabelDialogTitle');

    if (isEdit) {
      const tabId = this._getTabId(tab);
      const labelId = this._tabLabels.get(tabId);
      const label = this._labels.get(labelId);

      if (label) {
        input.value = label.text;
        colorPicker.value = label.color;
        if (colorPreview) {
          colorPreview.style.backgroundColor = label.color;
        }
        title.setAttribute('data-l10n-id', 'zen-tab-label-dialog-edit-title');
      }
    } else {
      input.value = '';
      const randomColor = this._getRandomColor();
      colorPicker.value = randomColor;
      if (colorPreview) {
        colorPreview.style.backgroundColor = randomColor;
      }
      title.setAttribute('data-l10n-id', 'zen-tab-label-dialog-new-title');
    }

    // Open dialog as popup anchored to the tab
    dialog.openPopup(tab, 'after_start', 0, 0, false, false);

    // Focus input after a short delay to ensure dialog is rendered
    setTimeout(() => {
      input.focus();
      input.select();
    }, 100);
  }

  _closeDialog() {
    const dialog = document.getElementById('zenTabLabelDialog');
    if (dialog.state === 'open') {
      dialog.hidePopup();
    }
    this._currentEditingTab = null;
  }

  _saveLabel() {
    const input = document.getElementById('zenTabLabelInput');
    const colorPicker = document.getElementById('zenTabLabelColorPicker');
    const labelText = input.value.trim();

    if (!labelText || !this._currentEditingTab) {
      this._closeDialog();
      return;
    }

    const tab = this._currentEditingTab;
    const tabId = this._getTabId(tab);
    const existingLabelId = this._tabLabels.get(tabId);

    let labelId;
    if (existingLabelId) {
      // Update existing label
      labelId = existingLabelId;
      this._labels.set(labelId, {
        text: labelText,
        color: colorPicker.value
      });
    } else {
      // Create new label
      labelId = `label-${this._labelIdCounter++}`;
      this._labels.set(labelId, {
        text: labelText,
        color: colorPicker.value
      });
    }

    this._applyLabelToTab(tab, labelId);
    this._closeDialog();
  }

  _applyLabelToTab(tab, labelId) {
    const tabId = this._getTabId(tab);
    const label = this._labels.get(labelId);

    if (!label) return;

    this._tabLabels.set(tabId, labelId);

    // Set attributes on tab for session storage
    tab.setAttribute('zen-tab-label-id', labelId);
    tab.setAttribute('zen-tab-label-text', label.text);
    tab.setAttribute('zen-tab-label-color', label.color);

    // Update UI
    this._updateTabLabelUI(tab, label);
  }

  _removeTabLabel(tab) {
    const tabId = this._getTabId(tab);
    this._tabLabels.delete(tabId);

    // Remove attributes
    tab.removeAttribute('zen-tab-label-id');
    tab.removeAttribute('zen-tab-label-text');
    tab.removeAttribute('zen-tab-label-color');

    // Update UI
    this._updateTabLabelUI(tab, null);
  }

  _updateTabLabelUI(tab, label) {
    let labelContainer = tab.querySelector('.zen-tab-label-display');

    if (!label) {
      // Remove label display
      if (labelContainer) {
        labelContainer.remove();
      }
      return;
    }

    if (!labelContainer) {
      // Create label display element
      const tabLabelContainer = tab.querySelector('.tab-label-container');
      if (tabLabelContainer) {
        labelContainer = document.createXULElement('hbox');
        labelContainer.classList.add('zen-tab-label-display');
        tabLabelContainer.after(labelContainer);
      }
    }

    if (labelContainer) {
      labelContainer.innerHTML = '';

      const colorDot = document.createXULElement('box');
      colorDot.classList.add('zen-tab-label-color');
      colorDot.style.backgroundColor = label.color;

      const labelText = document.createXULElement('label');
      labelText.classList.add('zen-tab-label-text');
      labelText.textContent = label.text;

      labelContainer.appendChild(colorDot);
      labelContainer.appendChild(labelText);
    }
  }

  _onTabClose(tab) {
    if (!tab) return;

    const tabId = this._getTabId(tab);
    this._tabLabels.delete(tabId);

    // Clean up unused labels (not associated with any tab)
    this._cleanupUnusedLabels();
  }

  _cleanupUnusedLabels() {
    const usedLabelIds = new Set(this._tabLabels.values());

    for (const labelId of this._labels.keys()) {
      if (!usedLabelIds.has(labelId)) {
        this._labels.delete(labelId);
      }
    }
  }

  _getTabId(tab) {
    // Use tab's linkedPanel as unique ID
    return tab.linkedPanel || tab.getAttribute('linkedpanel');
  }

  _getRandomColor() {
    return LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)];
  }

  /**
   * Restore label data from session storage
   */
  restoreTabLabel(tab) {
    const labelId = tab.getAttribute('zen-tab-label-id');
    const labelText = tab.getAttribute('zen-tab-label-text');
    const labelColor = tab.getAttribute('zen-tab-label-color');

    if (labelId && labelText && labelColor) {
      const tabId = this._getTabId(tab);

      // Restore label definition if not exists
      if (!this._labels.has(labelId)) {
        this._labels.set(labelId, { text: labelText, color: labelColor });
      }

      // Restore tab-label mapping
      this._tabLabels.set(tabId, labelId);

      // Update UI
      this._updateTabLabelUI(tab, { text: labelText, color: labelColor });

      // Update counter to avoid ID collisions
      const numericId = parseInt(labelId.replace('label-', ''));
      if (!isNaN(numericId) && numericId >= this._labelIdCounter) {
        this._labelIdCounter = numericId + 1;
      }
    }
  }

    /**
     * Restore all tab labels for the current session
     */
    restoreAllTabLabels() {
      const tabs = gBrowser.tabs;
      for (const tab of tabs) {
        this.restoreTabLabel(tab);
      }
    }
  }

  // Create global instance
  window.gZenTabLabels = new ZenTabLabels();
}
