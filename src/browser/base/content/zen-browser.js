var { XPCOMUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/XPCOMUtils.sys.mjs"
);

function BrowserOpenZenProfilesMgr(aView, { selectTabByViewId = false } = {}) {
  return new Promise(resolve => {
    let emWindow;
    let browserWindow;

    var receivePong = function (aSubject, aTopic, aData) {
      let browserWin = aSubject.browsingContext.topChromeWindow;
      if (!emWindow || browserWin == window /* favor the current window */) {
        if (
          selectTabByViewId &&
          aSubject.gViewController.currentViewId !== aView
        ) {
          return;
        }

        emWindow = aSubject;
        browserWindow = browserWin;
      }
    };
    Services.obs.addObserver(receivePong, "EM-pong");
    Services.obs.notifyObservers(null, "EM-ping");
    Services.obs.removeObserver(receivePong, "EM-pong");

    if (emWindow) {
      if (aView && !selectTabByViewId) {
        emWindow.loadView(aView);
      }
      let tab = browserWindow.gBrowser.getTabForBrowser(
        emWindow.docShell.chromeEventHandler
      );
      browserWindow.gBrowser.selectedTab = tab;
      emWindow.focus();
      resolve(emWindow);
      return;
    }

    if (selectTabByViewId) {
      const target = isBlankPageURL(gBrowser.currentURI.spec)
        ? "current"
        : "tab";
      openTrustedLinkIn("about:profiles", target);
    } else {
      // This must be a new load, else the ping/pong would have
      // found the window above.
      switchToTabHavingURI("about:profiles", true);
    }

    Services.obs.addObserver(function observer(aSubject, aTopic, aData) {
      Services.obs.removeObserver(observer, aTopic);
      if (aView) {
        aSubject.loadView(aView);
      }
      aSubject.focus();
      resolve(aSubject);
    }, "EM-loaded");
  });
}
