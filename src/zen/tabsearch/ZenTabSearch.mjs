{
  class ZenTabSearch extends ZenDOMOperatedFeature {
    init() {
      this._triggerCounter = 0;
      this.shouldInjectHeuristic = true;
      this._updateAutoSelectResult = this._updateAutoSelectResult.bind(this);
      this._handleKeyUp = this._handleKeyUp.bind(this);
      this.autoSelectResult = Services.prefs.getBoolPref('zen.tabsearch.auto-select-result', false);

      window.addEventListener('keyup', this._handleKeyUp, true);

      Services.prefs.addObserver(
        'zen.tabsearch.auto-select-result',
        this._updateAutoSelectResult,
        false
      );
      this._updateAutoSelectResult();
    }

    _updateAutoSelectResult() {
      this.autoSelectResult = Services.prefs.getBoolPref('zen.tabsearch.auto-select-result', false);
    }

    _handleKeyUp(event) {
      if (event.key === 'Alt' || event.key === 'Control') {
        if (
          this._triggerCounter > 0 &&
          gURLBar.view.isOpen &&
          gURLBar.searchMode?.source === 4 /* URLBarUtils.RESULT_SOURCE.TABS */
        ) {
          // simulate enter key press
          if (this.autoSelectResult) {
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true,
            });
            gURLBar.handleCommand(enterEvent);
            this.shouldInjectHeuristic = false;
          }
          this._triggerCounter = 0;
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
      }
    }

    async searchTabsShortcut(offset = 1) {
      // if the search is already open, we just need to select the next result
      if (
        gURLBar.view.isOpen &&
        gURLBar.searchMode &&
        gURLBar.searchMode.source === 4 /* URLBarUtils.RESULT_SOURCE.TABS */
      ) {
        this._triggerCounter += 1;
        if (gURLBar.view.visibleRowCount > 0) {
          if (offset > 0) {
            gURLBar.view.selectBy(offset);
          } else if (offset < 0) {
            gURLBar.view.selectBy(-offset, { reverse: true });
          }
        }
      } else {
        this._triggerCounter = 0;
        if (this.autoSelectResult) {
          this.shouldInjectHeuristic = false;
        }
        gURLBar.search('% ');
      }
    }
  }

  window.gZenTabSearch = new ZenTabSearch();
}
