{
  class ZenLibrary {
    constructor() {
      ChromeUtils.defineLazyGetter(this, 'wrapper', () => document.getElementById('zen-library'));
    }

    get isOpen() {
      return this.wrapper.hasAttribute('open');
    }

    set isOpen(value) {
      if (value) {
        this.wrapper.setAttribute('open', 'true');
      } else {
        this.wrapper.removeAttribute('open');
      }
      this.animateLibrary();
    }

    open() {
      this.isOpen = true;
    }

    close() {
      this.isOpen = false;
    }

    toggle() {
      this.isOpen = !this.isOpen;
    }

    async animateLibrary() {
      window.docShell.treeOwner.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIAppWindow).rollupAllPopups();

      let elementsToAnimate = [gNavToolbox];
      if (gZenVerticalTabsManager._hasSetSingleToolbar) {
        elementsToAnimate.push(gURLBar.textbox);
      }
      if (this.isOpen) {
        await gZenUIManager.motion.animate(elementsToAnimate, {
          transform: ['scale(1)', 'scale(0.8)'],
          opacity: [1, 0],
        });
      } else {
        await gZenUIManager.motion.animate(elementsToAnimate, {
          transform: ['scale(0.8)', 'scale(1)'],
          opacity: [0, 1],
        });
      }
    }
  }

  window.gZenLibrary = new ZenLibrary();
}
