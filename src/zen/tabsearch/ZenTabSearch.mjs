{
  class ZenTabSearch extends ZenDOMOperatedFeature {
    init() {
      this._heuristic = false;
      this._updateAutoSelectResult = this._updateAutoSelectResult.bind(this);
      this._handleKeyUp = this._handleKeyUp.bind(this);
      Services.prefs.addObserver(
        'zen.tabsearch.auto-select-result',
        this._updateAutoSelectResult,
        false
      );
      this._updateAutoSelectResult();
      window.setTimeout(() => {
        this._setupListener();
      }, 500);
    }

    _updateAutoSelectResult() {
      this.autoSelectResult = Services.prefs.getBoolPref('zen.tabsearch.auto-select-result', false);
    }

    _setupListener() {
      // Ensure gURLBar, its panel, and inputField are available
      if (typeof gURLBar !== 'undefined') {
        console.log('gURLBar or its components are not yet initialized');
        // Bind the handlers to this instance for correct 'this' and removal
        const self = this; // Capture the correct 'this' context
        gURLBar.controller.addQueryListener({
          onViewOpen() {
            window.addEventListener('keyup', self._handleKeyUp, true);
            self._heuristic = false;
          },
          onViewClose() {
            window.removeEventListener('keyup', self._handleKeyUp, true);
            self._heuristic = false;
          },
          onQueryStarted() {
            window.removeEventListener('keyup', self._handleKeyUp, true);
          },
          onQueryFinished() {
            self._heuristic = true;  
          },
          
        });
      } else {
        // Retry if gURLBar or its components are not yet initialized
        window.setTimeout(() => {
          // 'this' here will refer to the ZenTabSearch instance because
          // setTimeout is called on 'window', and the callback is an arrow function,
          // which lexically captures 'this' from the surrounding scope (the catch block).
          // In the catch block, 'this' is the ZenTabSearch instance.
          this._setupListener();
        }, 500);
      }
    }

    _handleKeyUp(event) {
      if (event.key === 'Alt' || event.key === 'Control') {
        if (
          this._heuristic &&
          this.autoSelectResult &&
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
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        } else {
          // window.removeEventListener('keyup', this._handleKeyUp, true);
        }
      }
    }

    shouldInjectHeuristic() {
      if (!this.autoSelectResult) return true;
      if (this._heuristic) return true;
      return false;
    }

    async searchTabsShortcut(offset = 1) {
      // if the search is already open, we just need to select the next result
      if (
        gURLBar.view.isOpen &&
        gURLBar.searchMode &&
        gURLBar.searchMode.source === 4 /* URLBarUtils.RESULT_SOURCE.TABS */
      ) {
        if (gURLBar.view.visibleRowCount > 0) {
          if (offset > 0) {
            gURLBar.view.selectBy(offset);
          } else if (offset < 0) {
            gURLBar.view.selectBy(-offset, { reverse: true });
          }
          window.addEventListener('keyup', this._handleKeyUp, true);
          this._heuristic = true;
        }
      } else {
        gURLBar.search('% ');
        this._heuristic = false;
      }
    }
  }

  if (Services.prefs.getBoolPref('zen.tabsearch.enabled', true)) {
    window.gZenTabSearch = new ZenTabSearch();
  }
}
