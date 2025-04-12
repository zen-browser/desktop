
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

    animateLibrary() {
      window.docShell.treeOwner.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIAppWindow).rollupAllPopups();
    }
  }

  window.gZenLibrary = new ZenLibrary();
}
