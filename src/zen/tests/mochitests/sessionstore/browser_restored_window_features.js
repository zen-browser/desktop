/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const BARPROP_NAMES = [
  "locationbar",
  "menubar",
  "personalbar",
  "scrollbars",
  "statusbar",
  "toolbar",
];

function testFeatures(win, test) {
  for (let name of BARPROP_NAMES) {
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

add_task(async function testRestoredWindowFeatures() {
  const DUMMY_PAGE =
    "browser/components/tabbrowser/test/browser/tabs/dummy_page.html";
  const ALL_BARPROPS = {
    locationbar: true,
    menubar: true,
    personalbar: true,
    scrollbars: true,
    statusbar: true,
    toolbar: true,
  };
  const TESTS = [
    {
      url: "http://example.com/browser/" + DUMMY_PAGE,
      features: "menubar=0,resizable",
      barprops: { scrollbars: true },
      chromeFlags: Ci.nsIWebBrowserChrome.CHROME_WINDOW_RESIZE,
      unsetFlags: Ci.nsIWebBrowserChrome.CHROME_OPENAS_DIALOG,
    },
    {
      url: "data:,", // title should be empty
      checkContentTitleEmpty: true,
      features: "location,resizable",
      barprops: { locationbar: true, scrollbars: true },
      chromeFlags: Ci.nsIWebBrowserChrome.CHROME_WINDOW_RESIZE,
      unsetFlags: Ci.nsIWebBrowserChrome.CHROME_OPENAS_DIALOG,
    },
    {
      url: "http://example.com/browser/" + DUMMY_PAGE,
      features: "dialog,resizable",
      barprops: { scrollbars: true },
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
    if (test.chrome) {
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
