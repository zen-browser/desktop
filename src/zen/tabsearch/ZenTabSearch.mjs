{
  class ZenTabSearch extends ZenDOMOperatedFeature {
    init() {
      this._counter = 0;
      window.addEventListener('keyup', this._handleKeyUp, true);
    }

    _handleKeyUp(event) {
      console.log('Key up event:', event);
      if (event.key === 'Alt' || event.key === 'Control') {
        if (window.gZenTabSearch > 0 && gURLBar.view.isOpen && gURLBar.searchMode?.source === 4 /* URLBarUtils.RESULT_SOURCE.TABS */) {
          // simulate enter key press
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
          });
          gURLBar.handleCommand(enterEvent);
        }
      }
    }

    async searchTabsShortcut(offset = 1) {
      if (gURLBar.view.isOpen && gURLBar.searchMode && gURLBar.searchMode.source === 4 /* URLBarUtils.RESULT_SOURCE.TABS */) {
        this._counter += 1;
        gURLBar.view.selectBy(offset);
      } else {
        gURLBar.search("% ");
        this._counter = 0;
      }
    }
  }

  window.gZenTabSearch = new ZenTabSearch();
}
