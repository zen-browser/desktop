// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

{
  class nsHasPolyfill {
    constructor() {
      this.observers = [];
      this.idStore = 0;
    }

    /**
     * @param {{selector: string, exists: boolean}} descendantSelectors
     */
    observeSelectorExistence(element, descendantSelectors, stateAttribute, attributeFilter = []) {
      const updateState = () => {
        const exists = descendantSelectors.some(({ selector }) => {
          return element.querySelector(selector);
        });
        const { exists: shouldExist = true } = descendantSelectors;
        if (exists === shouldExist) {
          if (!element.hasAttribute(stateAttribute)) {
            element.setAttribute(stateAttribute, 'true');
          }
        } else {
          if (element.hasAttribute(stateAttribute)) {
            element.removeAttribute(stateAttribute);
          }
        }
      };

      const observer = new MutationObserver(updateState);
      updateState();
      const observerId = this.idStore++;
      this.observers.push({
        id: observerId,
        observer,
        element,
        attributeFilter,
      });
      return observerId;
    }

    disconnectObserver(observerId) {
      const index = this.observers.findIndex((o) => o.id === observerId);
      if (index !== -1) {
        this.observers[index].observer.disconnect();
      }
    }

    connectObserver(observerId) {
      const observer = this.observers.find((o) => o.id === observerId);
      if (observer) {
        observer.observer.observe(observer.element, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: observer.attributeFilter.length ? observer.attributeFilter : undefined,
        });
      }
    }

    destroy() {
      this.observers.forEach((observer) => observer.observer.disconnect());
      this.observers = [];
    }
  }

  const hasPolyfillInstance = new nsHasPolyfill();
  window.addEventListener('unload', () => hasPolyfillInstance.destroy(), { once: true });

  window.ZenHasPolyfill = hasPolyfillInstance;
}
