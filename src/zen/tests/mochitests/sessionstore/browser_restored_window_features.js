/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Validates that reopening a closed window with specific chrome flags/window
// features will restore all of those chrome flags/window features.

const ALL_BARPROPS = {
  locationbar: true,
  menubar: true,
  personalbar: true,
  toolbar: true,
};

/**
 * @typedef {object} TestData
 * @property {true} [chrome]
 * @property {string} url
 * @property {true} [checkContentTitleEmpty]
 * @property {string} features
 * @property {Partial<typeof ALL_BARPROPS>} barprops
 * @property {u32} chromeFlags
 * @property {u32} [unsetFlags]
 * @property {object} [extraOptions]
 */

/**
 * @param {Window} win
 * @param {TestData} test
 */
function testFeatures(win, test) {
  for (let name of Object.keys(ALL_BARPROPS)) {
    is(
      win[name].visible,
      !!test.barprops?.[name],
      name + " should be " + (test.barprops?.[name] ? "visible" : "hidden")
    );
  }
  let toolbar = win.document.getElementById("TabsToolbar");
  is(
    toolbar.collapsed,
    !win.toolbar.visible,
    win.toolbar.visible
      ? "tabbar should not be collapsed"
      : "tabbar should be collapsed"
  );
  let chromeFlags = win.docShell.treeOwner
    .QueryInterface(Ci.nsIInterfaceRequestor)
    .getInterface(Ci.nsIAppWindow).chromeFlags;
  is(chromeFlags & test.chromeFlags, test.chromeFlags, "flags should be set");
  if (test.unsetFlags) {
    is(chromeFlags & test.unsetFlags, 0, "flags should be unset");
  }
}

/**
 * @param {Window} win
 * @param {TestData} test
 */
function testExtraOptions(win, test) {
  for (let key of Object.keys(test.extraOptions)) {
    ok(
      win.document.documentElement.hasAttribute(key),
      `${key} attribute should be set`
    );
  }
}

add_task(async function testRestoredWindowFeatures() {
  const DUMMY_PAGE =
    "browser/components/tabbrowser/test/browser/tabs/dummy_page.html";

  /** @type {TestData[]} */
  const TESTS = [
    {
      url: "http://example.com/browser/" + DUMMY_PAGE,
      features: "resizable",
      barprops: { locationbar: true },
      chromeFlags: Ci.nsIWebBrowserChrome.CHROME_WINDOW_RESIZE,
      unsetFlags: Ci.nsIWebBrowserChrome.CHROME_OPENAS_DIALOG,
    },
    {
      url: "data:,", // title should be empty
      checkContentTitleEmpty: true,
      features: "resizable",
      barprops: { locationbar: true },
      chromeFlags: Ci.nsIWebBrowserChrome.CHROME_WINDOW_RESIZE,
      unsetFlags: Ci.nsIWebBrowserChrome.CHROME_OPENAS_DIALOG,
    },
    {
      url: "http://example.com/browser/" + DUMMY_PAGE,
      features: "dialog,resizable",
      barprops: { locationbar: true },
      chromeFlags:
        Ci.nsIWebBrowserChrome.CHROME_OPENAS_DIALOG |
        Ci.nsIWebBrowserChrome.CHROME_WINDOW_RESIZE,
    },
    {
      chrome: true,
      url: "http://example.com/browser/" + DUMMY_PAGE,
      features: "chrome,all,dialog=no",
      barprops: ALL_BARPROPS,
      chromeFlags: Ci.nsIWebBrowserChrome.CHROME_ALL,
      unsetFlags: Ci.nsIWebBrowserChrome.CHROME_OPENAS_DIALOG,
    },
    {
      chrome: true,
      url: "http://example.com/browser/" + DUMMY_PAGE,
      features: "chrome,all,dialog=no,centerscreen",
      barprops: ALL_BARPROPS,
      chromeFlags: Ci.nsIWebBrowserChrome.CHROME_CENTER_SCREEN,
    },
    {
      chrome: true,
      url: "http://example.com/browser/" + DUMMY_PAGE,
      features: "chrome,all,dialog=no,dependent",
      barprops: ALL_BARPROPS,
      chromeFlags: Ci.nsIWebBrowserChrome.CHROME_DEPENDENT,
    },
    {
      // Mirrors URILoadingHelper.sys.mjs's openInWindow() when opening a
      // chromeless window with no width/height override.
      url: "http://example.com/browser/" + DUMMY_PAGE,
      features: "chrome,dialog=no,resizable,minimizable,titlebar,close",
      barprops: { locationbar: true },
      chromeFlags:
        Ci.nsIWebBrowserChrome.CHROME_WINDOW_RESIZE |
        Ci.nsIWebBrowserChrome.CHROME_WINDOW_MINIMIZE |
        Ci.nsIWebBrowserChrome.CHROME_TITLEBAR,
      unsetFlags: Ci.nsIWebBrowserChrome.CHROME_OPENAS_DIALOG,
      extraOptions: { "chromeless-window": true },
    },
    {
      // Mirrors ext-windows.js's windows.create() opening a popup-type
      // window with no explicit left/top (so it centers on screen).
      url: "http://example.com/browser/" + DUMMY_PAGE,
      features:
        "chrome,dialog,resizable,minimizable,titlebar,close,centerscreen",
      barprops: { locationbar: true },
      chromeFlags:
        Ci.nsIWebBrowserChrome.CHROME_OPENAS_DIALOG |
        Ci.nsIWebBrowserChrome.CHROME_WINDOW_RESIZE |
        Ci.nsIWebBrowserChrome.CHROME_WINDOW_MINIMIZE |
        Ci.nsIWebBrowserChrome.CHROME_TITLEBAR |
        Ci.nsIWebBrowserChrome.CHROME_CENTER_SCREEN,
      extraOptions: { "web-extension-popup-window": true },
    },
  ];
  const TEST_URL_CHROME = "chrome://mochitests/content/browser/" + DUMMY_PAGE;

  BrowserTestUtils.startLoadingURIString(
    gBrowser.selectedBrowser,
    TEST_URL_CHROME
  );
  await BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser);

  for (let test of TESTS) {
    let newWindowPromise = BrowserTestUtils.waitForNewWindow({
      url: test.url,
    });
    let win;
    if (test.extraOptions) {
      let args = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
      let uri = Cc["@mozilla.org/supports-string;1"].createInstance(
        Ci.nsISupportsString
      );
      uri.data = test.url;
      args.appendElement(uri);
      let extraOptions = Cc["@mozilla.org/hash-property-bag;1"].createInstance(
        Ci.nsIWritablePropertyBag2
      );
      for (let [key, value] of Object.entries(test.extraOptions)) {
        extraOptions.setPropertyAsBool(key, value);
      }
      args.appendElement(extraOptions);
      Services.ww.openWindow(
        window,
        AppConstants.BROWSER_CHROME_URL,
        "_blank",
        test.features,
        args
      );
    } else if (test.chrome) {
      win = window.openDialog(
        AppConstants.BROWSER_CHROME_URL,
        "_blank",
        test.features,
        test.url
      );
    } else {
      await SpecialPowers.spawn(gBrowser.selectedBrowser, [test], t => {
        content.window.open(t.url, "_blank", t.features);
      });
    }
    win = await newWindowPromise;

    let title = win.document.title;
    if (test.checkContentTitleEmpty) {
      let contentTitle = await SpecialPowers.spawn(
        win.gBrowser.selectedBrowser,
        [],
        () => content.document.title
      );
      is(contentTitle, "", "title should be empty");
    }

    testFeatures(win, test);
    if (test.extraOptions) {
      testExtraOptions(win, test);
    }
    let chromeFlags = win.docShell.treeOwner
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIAppWindow).chromeFlags;

    await BrowserTestUtils.closeWindow(win);

    newWindowPromise = BrowserTestUtils.waitForNewWindow({
      url: test.url,
    });
    SessionStore.undoCloseWindow(0);
    win = await newWindowPromise;

    is(title, win.document.title, "title should be preserved");
    testFeatures(win, test);
    if (test.extraOptions) {
      testExtraOptions(win, test);
    }
    is(
      win.docShell.treeOwner
        .QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIAppWindow).chromeFlags,
      // Use |>>> 0| to force unsigned.
      (chromeFlags |
        Ci.nsIWebBrowserChrome.CHROME_OPENAS_CHROME |
        Ci.nsIWebBrowserChrome.CHROME_SUPPRESS_ANIMATION) >>>
        0,
      "unexpected chromeFlags"
    );

    await BrowserTestUtils.closeWindow(win);
  }
});
