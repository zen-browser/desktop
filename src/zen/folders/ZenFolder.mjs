// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
{
  class ZenFolder extends MozTabbrowserTabGroup {
    #initialized = false;

    static markup = `
      <hbox class="tab-group-label-container" pack="center">
        <html:div class="tab-group-folder-icon"/>
        <label class="tab-group-label" role="button"/>
      </hbox>
      <html:div class="tab-group-container">
        <html:div class="zen-tab-group-start" />
      </html:div>
      <vbox class="tab-group-overflow-count-container" pack="center">
        <label class="tab-group-overflow-count" role="button" />
      </vbox>
    `;

    static rawIcon = new DOMParser().parseFromString(
      `
      <svg width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="-67.409 -14.145 29.279 28.92">
        <defs>
          <linearGradient gradientUnits="userSpaceOnUse" x1="-53.05" y1="-3.8" x2="-53.05" y2="8.998" id="gradient-1">
            <stop offset="0" style="stop-color: rgb(255, 255, 255);"/>
            <stop offset="1" style="stop-color: rgb(0% 0% 0%)"/>
          </linearGradient>
          <linearGradient gradientUnits="userSpaceOnUse" x1="-40.286" y1="-3.091" x2="-40.286" y2="13.31" id="gradient-0" gradientTransform="matrix(1, 0, 0, 1, -12.717999, -4.409)">
            <stop offset="0" style="stop-color: rgb(255, 255, 255);"/>
            <stop offset="1" style="stop-color: rgb(0% 0% 0%)"/>
          </linearGradient>
        </defs>
      <!--Back Folder (path)-->
        <path shape-rendering="geometricPrecision" d="M -61.3 -5.25 C -61.3 -6.492 -60.293 -7.5 -59.05 -7.5 L -55.102 -7.5 C -54.591 -7.5 -54.096 -7.326 -53.697 -7.007 L -52.84 -6.321 C -52.175 -5.79 -51.349 -5.5 -50.498 -5.5 L -47.05 -5.5 C -45.807 -5.5 -44.8 -4.492 -44.8 -3.25 L -44.731 4.42 L -44.708 6.651 C -44.708 7.894 -45.715 8.901 -46.958 8.901 L -58.958 8.901 C -60.201 8.901 -61.208 7.894 -61.208 6.651 L -61.3 4.752 L -61.3 -5.25 Z" style="stroke-width: 1.3px; transform-box: fill-box; transform-origin: 50% 50%; fill: var(--zen-folder-behind-bgcolor); stroke: var(--zen-folder-stroke);">
          <animateTransform type="skewX" additive="sum" attributeName="transform" values="-1;17" dur="0.15s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
          <animateTransform type="translate" additive="sum" attributeName="transform" values="0 0;-1.5 0" dur="0.15s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        </path>
        <path shape-rendering="geometricPrecision" d="M -61.3 -5.25 C -61.3 -6.492 -60.293 -7.5 -59.05 -7.5 L -55.102 -7.5 C -54.591 -7.5 -54.096 -7.326 -53.697 -7.007 L -52.84 -6.321 C -52.175 -5.79 -51.349 -5.5 -50.498 -5.5 L -47.05 -5.5 C -45.807 -5.5 -44.8 -4.492 -44.8 -3.25 L -44.731 4.42 L -44.708 6.651 C -44.708 7.894 -45.715 8.901 -46.958 8.901 L -58.958 8.901 C -60.201 8.901 -61.208 7.894 -61.208 6.651 L -61.3 4.752 L -61.3 -5.25 Z" style="stroke-width: 1.3px; fill-opacity: 0.1; fill: url(&quot;#gradient-0&quot;); transform-origin: -53.004px 0.701px;">
          <animateTransform type="skewX" additive="sum" attributeName="transform" values="-1;17" dur="0.15s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
          <animateTransform type="translate" additive="sum" attributeName="transform" values="0 0;-1.5 0" dur="0.15s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        </path>
      <!--Front Folder (rect)-->
        <rect shape-rendering="geometricPrecision" x="-61.301" y="-3.768" width="16.5" height="12.798" rx="2.25" style="stroke-width: 1.3px; transform-box: fill-box; transform-origin: 50% 50%; fill: var(--zen-folder-front-bgcolor); stroke: var(--zen-folder-stroke);" id="object-0">
          <animateTransform type="skewX" additive="sum" attributeName="transform" values="1;-17" dur="0.15s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
          <animateTransform type="translate" additive="sum" attributeName="transform" values="0 0;3 0" dur="0.15s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        </rect>
        <rect shape-rendering="geometricPrecision" x="-61.3" y="-3.8" width="16.5" height="12.798" style="stroke-width: 1.3px; fill-opacity: 0.1; transform-origin: -53.05px 2.599px; fill: url(&quot;#gradient-1&quot;);" id="rect-1" rx="2.25">
          <animateTransform type="skewX" additive="sum" attributeName="transform" values="1;-17" dur="0.15s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
          <animateTransform type="translate" additive="sum" attributeName="transform" values="0 0;3 0" dur="0.15s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        </rect>
      <!--Icon (g)-->
        <g id="folder-icon" shape-rendering="geometricPrecision" style="fill-opacity: 1; transform-origin: -53.05px 5.399px; fill: var(--zen-folder-stroke);">
          <image href="" height="18px" width="19px"/>
          <animateTransform type="skewX" additive="sum" attributeName="transform" values="0;-17" dur="0.15s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
          <animateTransform type="translate" additive="sum" attributeName="transform" values="-10 -9;-7.5 -9" dur="0.15s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
          <animate attributeName="opacity" values="1;1" dur="0.15s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        </g>
        <!--End Icon (g)-->
        <g id="folder-dots" style="fill-opacity: 1; fill: var(--zen-folder-stroke);">
          <animateTransform type="skewX" additive="sum" attributeName="transform" values="1;-17" dur="0.2s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
          <animateTransform type="translate" additive="sum" attributeName="transform" values="0 0.5;5 -0.5" dur="0.2s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
          <animate attributeName="opacity" values="0;0" dur="0.2s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
          <path transform="translate(1.2, 0)" shape-rendering="geometricPrecision" d="M -59.363 2.243 C -59.363 2.074 -59.33 1.915 -59.262 1.76 C -59.192 1.612 -59.107 1.478 -58.996 1.373 C -58.885 1.256 -58.751 1.165 -58.598 1.101 C -58.448 1.033 -58.289 1 -58.114 1 C -57.945 1 -57.785 1.033 -57.636 1.101 C -57.482 1.165 -57.354 1.256 -57.244 1.373 C -57.131 1.478 -57.042 1.612 -56.972 1.76 C -56.904 1.915 -56.871 2.074 -56.871 2.243 C -56.871 2.414 -56.904 2.573 -56.972 2.727 C -57.042 2.876 -57.131 3.008 -57.244 3.125 C -57.354 3.232 -57.482 3.321 -57.636 3.385 C -57.785 3.455 -57.945 3.486 -58.114 3.486 C -58.289 3.486 -58.448 3.455 -58.598 3.385 C -58.751 3.321 -58.885 3.232 -58.996 3.125 C -59.107 3.008 -59.192 2.876 -59.262 2.727 C -59.33 2.573 -59.363 2.414 -59.363 2.243 Z"/>
          <path shape-rendering="geometricPrecision" d="M -54.38 2.243 C -54.38 2.074 -54.347 1.915 -54.279 1.76 C -54.215 1.612 -54.124 1.478 -54.019 1.373 C -53.902 1.256 -53.769 1.165 -53.621 1.101 C -53.466 1.033 -53.306 1 -53.137 1 C -52.966 1 -52.807 1.033 -52.653 1.101 C -52.504 1.165 -52.372 1.256 -52.265 1.373 C -52.148 1.478 -52.059 1.612 -51.995 1.76 C -51.925 1.915 -51.894 2.074 -51.894 2.243 C -51.894 2.414 -51.925 2.573 -51.995 2.727 C -52.059 2.876 -52.148 3.008 -52.265 3.125 C -52.372 3.232 -52.504 3.321 -52.653 3.385 C -52.807 3.455 -52.966 3.486 -53.137 3.486 C -53.306 3.486 -53.466 3.455 -53.621 3.385 C -53.769 3.321 -53.902 3.232 -54.019 3.125 C -54.124 3.008 -54.215 2.876 -54.279 2.727 C -54.347 2.573 -54.38 2.414 -54.38 2.243 Z"/>
          <path transform="translate(-1.2, 0)" shape-rendering="geometricPrecision" d="M -49.402 2.243 C -49.402 2.074 -49.37 1.915 -49.302 1.76 C -49.232 1.612 -49.147 1.478 -49.036 1.373 C -48.924 1.256 -48.791 1.165 -48.638 1.101 C -48.488 1.033 -48.329 1 -48.154 1 C -47.984 1 -47.824 1.033 -47.676 1.101 C -47.521 1.165 -47.395 1.256 -47.282 1.373 C -47.171 1.478 -47.082 1.612 -47.012 1.76 C -46.942 1.915 -46.911 2.074 -46.911 2.243 C -46.911 2.414 -46.942 2.573 -47.012 2.727 C -47.082 2.876 -47.171 3.008 -47.282 3.125 C -47.395 3.232 -47.521 3.321 -47.676 3.385 C -47.824 3.455 -47.984 3.486 -48.154 3.486 C -48.329 3.486 -48.488 3.455 -48.638 3.385 C -48.791 3.321 -48.924 3.232 -49.036 3.125 C -49.147 3.008 -49.232 2.876 -49.302 2.727 C -49.37 2.573 -49.402 2.414 -49.402 2.243 Z"/>
        </g>
      </svg>`,
      'image/svg+xml'
    ).documentElement;

    constructor() {
      super();
    }

    connectedCallback() {
      super.connectedCallback();
      this.labelElement.pinned = true;
      if (this.#initialized) {
        return;
      }
      this.#initialized = true;
      this.icon.appendChild(ZenFolder.rawIcon.cloneNode(true));
      // Save original values for animations
      this.icon.querySelectorAll('animate, animateTransform, animateMotion').forEach((anim) => {
        const vals = anim.getAttribute('values');
        if (vals) {
          anim.dataset.origValues = vals;
        }
      });

      this.labelElement.parentElement.setAttribute('context', 'zenFolderActions');

      this.labelElement.onRenameFinished = (newLabel) => {
        this.name = newLabel;
        const event = new CustomEvent('ZenFolderRenamed', {
          bubbles: true,
        });
        this.dispatchEvent(event);
      };

      if (this.collapsed) {
        this.querySelector('.tab-group-container').setAttribute('hidden', true);
      }
    }

    get icon() {
      return this.querySelector('.tab-group-folder-icon');
    }

    /**
     * Returns the group this folder belongs to.
     * @returns {MozTabbrowserTabGroup|null} The group this folder belongs to, or null if it is not part of a group.
     **/
    get group() {
      if (gBrowser.isTabGroup(this.parentElement?.parentElement)) {
        return this.parentElement.parentElement;
      }
      return null;
    }

    get isZenFolder() {
      return true;
    }

    get activeGroups() {
      let activeGroups = [];
      let currentGroup = this;
      if (currentGroup?.hasAttribute('has-active')) activeGroups.push(currentGroup);
      while (currentGroup?.group) {
        currentGroup = currentGroup?.group;
        if (currentGroup?.hasAttribute('has-active')) {
          activeGroups.push(currentGroup);
        }
      }
      return activeGroups;
    }

    rename() {
      gZenVerticalTabsManager.renameTabStart({
        target: this.labelElement,
        explicit: true,
      });
    }

    async expandGroupTabs() {
      for (let tab of this.allItems.reverse()) {
        tab = tab.group.hasAttribute('split-view-group') ? tab.group : tab;
        if (tab.hasAttribute('zen-empty-tab')) {
          await ZenPinnedTabsStorage.removePin(tab.getAttribute('zen-pin-id'));
          gBrowser.removeTab(tab);
        } else {
          gBrowser.ungroupTab(tab);
        }
      }
    }

    async delete() {
      for (const tab of this.allItemsRecursive) {
        await ZenPinnedTabsStorage.removePin(tab.getAttribute('zen-pin-id'));
        if (tab.hasAttribute('zen-empty-tab')) {
          // Manually remove the empty tabs as removeTabs() inside removeTabGroup
          // does ignore them.
          gBrowser.removeTab(tab);
        }
      }
      await gBrowser.removeTabGroup(this, { isUserTriggered: true });
    }

    get allItemsRecursive() {
      const items = [];
      for (const item of this.allItems) {
        if (item.isZenFolder) {
          items.push(item, ...item.allItemsRecursive);
        } else {
          items.push(item);
        }
      }
      return items;
    }

    get allItems() {
      return [...this.querySelector('.tab-group-container').children].filter(
        (child) => !child.classList.contains('zen-tab-group-start')
      );
    }

    get pinned() {
      return this.isZenFolder;
    }

    /**
     * Intentionally ignore attempts to change the pinned state.
     * ZenFolder instances determine their "pinned" status based on their type (isZenFolder)
     * and do not support being pinned or unpinned via this setter.
     * This no-op setter ensures compatibility with interfaces expecting a pinned property,
     * while preserving the invariant that ZenFolders cannot have their pinned state changed externally.
     */
    set pinned(value) {}

    get iconURL() {
      return this.icon.querySelector('image')?.getAttribute('href') || '';
    }
  }

  customElements.define('zen-folder', ZenFolder);
}
