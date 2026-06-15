// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

class nsHasPolyfill {
  constructor() {
    this.observers = [];
    this.idStore = 0;
  }

  /**
   * @param {HTMLElement} element
   * @param {Array<{selector: string, exists: boolean}>} descendantSelectors
   * @param {string} stateAttribute
   * @param {Array<string>} attributeFilter
   */
  observeSelectorExistence(
    element,
    descendantSelectors,
    stateAttribute,
    attributeFilter = []
  ) {
    const updateState = () => {
      const exists = descendantSelectors.some(({ selector }) => {
        let selected = element.querySelector(selector);
        if (selected?.tagName?.toLowerCase() === "menu") {
          return null;
        }
        if (selected) {
          gZenCompactModeManager.log(
            `Selector "${selector}" exists for: `,
            element
          );
        }
        return selected;
      });
      const { exists: shouldExist = true } = descendantSelectors;
      if (exists === shouldExist) {
        if (!element.hasAttribute(stateAttribute)) {
          gZenCompactModeManager._setElementExpandAttribute(
            element,
            true,
            stateAttribute
          );
        }
      } else if (element.hasAttribute(stateAttribute)) {
        gZenCompactModeManager._setElementExpandAttribute(
          element,
          false,
          stateAttribute
        );
      }
    };

    const observer = new MutationObserver(updateState);
    const observerId = this.idStore++;
    this.observers.push({
      id: observerId,
      observer,
      // God-Tier Memory Fix: Use WeakRef so the array doesn't hold the DOM node hostage.
      // The Garbage Collector can now freely clear orphaned nodes.
      elementRef: new WeakRef(element),
      attributeFilter,
    });
    return observerId;
  }

  disconnectObserver(observerId) {
    const index = this.observers.findIndex(o => o.id === observerId);
    if (index !== -1) {
      this.observers[index].observer.disconnect();
    }
  }

  connectObserver(observerId) {
    const observer = this.observers.find(o => o.id === observerId);
    if (observer) {
      const element = observer.elementRef.deref();
      if (element) {
        observer.observer.observe(element, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: observer.attributeFilter.length
            ? observer.attributeFilter
            : undefined,
        });
      } else {
        // Element was garbage collected! We can safely prune this dead observer.
        this.observers = this.observers.filter(o => o.id !== observerId);
      }
    }
  }

  destroy() {
    this.observers.forEach(observer => observer.observer.disconnect());
    this.observers = [];
  }
}

const hasPolyfillInstance = new nsHasPolyfill();
window.addEventListener("unload", () => hasPolyfillInstance.destroy(), {
  once: true,
});

window.ZenHasPolyfill = hasPolyfillInstance;
