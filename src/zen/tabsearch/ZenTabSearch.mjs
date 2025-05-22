{
  class ZenTabSearch extends ZenDOMOperatedFeature {
    init() {
      this._counter = 0;
      window.addEventListener('keyup', this._handleKeyUp, true);
    }

    _handleKeyUp(event) {
      if (event.key === 'Alt' || event.key === 'Control') {
        if (
          window.gZenTabSearch._counter > 0 &&
          gURLBar.view.isOpen &&
          gURLBar.searchMode?.source === 4 /* URLBarUtils.RESULT_SOURCE.TABS */
        ) {
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
          this._counter = 0;
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
      }
    }

    async searchTabsShortcut(offset = 1) {
      if (
        gURLBar.view.isOpen &&
        gURLBar.searchMode &&
        gURLBar.searchMode.source === 4 /* URLBarUtils.RESULT_SOURCE.TABS */
      ) {
        this._counter += 1;
        if (offset > 0) {
          gURLBar.view.selectBy(offset);
        } else if (offset < 0) {
          gURLBar.view.selectBy(-offset, {reverse: true});
        }
      } else {
        gURLBar.search('% ');
        this._counter = 0;
      }
    }
  }

  window.gZenTabSearch = new ZenTabSearch();
}
