/*
 * Bug 1267910 - The regression test case for session cookies.
 */

"use strict";

const TEST_HOST = "www.example.com";
const COOKIE = {
  name: "test1",
  value: "yes1",
  path: "/browser/browser/components/sessionstore/test/",
  sameSite: Ci.nsICookie.SAMESITE_UNSET,
};
const SESSION_DATA = JSON.stringify({
  version: ["sessionrestore", 1],
  windows: [
    {
      tabs: [
        {
          entries: [],
          lastAccessed: 1463893009797,
          hidden: false,
          attributes: {},
          image: null,
        },
        {
          entries: [
            {
              url: "http://www.example.com/browser/browser/components/sessionstore/test/browser_1267910_page.html",
              triggeringPrincipal_base64,
              charset: "UTF-8",
              ID: 0,
              docshellID: 2,
              originalURI:
                "http://www.example.com/browser/browser/components/sessionstore/test/browser_1267910_page.html",
              docIdentifier: 0,
              persist: true,
            },
          ],
          lastAccessed: 1463893009321,
          hidden: false,
          attributes: {},
          userContextId: 0,
          index: 1,
          image: "http://www.example.com/favicon.ico",
        },
      ],
      selected: 1,
      _closedTabs: [],
      busy: false,
      width: 1024,
      height: 768,
      screenX: 4,
      screenY: 23,
      sizemode: "normal",
      cookies: [
        {
          host: "www.example.com",
          value: "yes1",
          path: "/browser/browser/components/sessionstore/test/",
          name: "test1",
          sameSite: Ci.nsICookie.SAMESITE_UNSET,
        },
      ],
    },
  ],
  selectedWindow: 1,
  _closedWindows: [],
  session: {
    lastUpdate: 1463893009801,
    startTime: 1463893007134,
    recentCrashes: 0,
  },
  global: {},
});

const SESSION_DATA_OA = JSON.stringify({
  version: ["sessionrestore", 1],
  windows: [
    {
      tabs: [
        {
          entries: [],
          lastAccessed: 1463893009797,
          hidden: false,
          attributes: {},
          image: null,
        },
        {
          entries: [
            {
              url: "http://www.example.com/browser/browser/components/sessionstore/test/browser_1267910_page.html",
              triggeringPrincipal_base64,
              charset: "UTF-8",
              ID: 0,
              docshellID: 2,
              originalURI:
                "http://www.example.com/browser/browser/components/sessionstore/test/browser_1267910_page.html",
              docIdentifier: 0,
              persist: true,
            },
          ],
          lastAccessed: 1463893009321,
          hidden: false,
          attributes: {},
          userContextId: 0,
          index: 1,
          image: "http://www.example.com/favicon.ico",
        },
      ],
      selected: 1,
      _closedTabs: [],
      busy: false,
      width: 1024,
      height: 768,
      screenX: 4,
      screenY: 23,
      sizemode: "normal",
      cookies: [
        {
          host: "www.example.com",
          value: "yes1",
          path: "/browser/browser/components/sessionstore/test/",
          name: "test1",
          sameSite: Ci.nsICookie.SAMESITE_UNSET,
          originAttributes: {
            addonId: "",
            inIsolatedMozBrowser: false,
            userContextId: 0,
          },
        },
      ],
    },
  ],
  selectedWindow: 1,
  _closedWindows: [],
  session: {
    lastUpdate: 1463893009801,
    startTime: 1463893007134,
    recentCrashes: 0,
  },
  global: {},
});

add_task(async function run_test() {
  // Wait until initialization is complete.
  await SessionStore.promiseInitialized;

  // Clear cookies.
  Services.cookies.removeAll();

  // Open a new window.
  let win = await promiseNewWindowLoaded();

  // Restore window with session cookies that have no originAttributes.
  await setWindowState(win, SESSION_DATA, true);

  let cookieCount = 0;
  for (var cookie of Services.cookies.getCookiesFromHost(TEST_HOST, {})) {
    cookieCount++;
  }

  // Check that the cookie is restored successfully.
  is(cookieCount, 1, "expected one cookie");
  is(cookie.name, COOKIE.name, "cookie name successfully restored");
  is(cookie.value, COOKIE.value, "cookie value successfully restored");
  is(cookie.path, COOKIE.path, "cookie path successfully restored");

  // Clear cookies.
  Services.cookies.removeAll();

  // In real usage, the event loop would get to spin between setWindowState
  // uses.  Without a spin, we can defer handling the STATE_STOP that
  // removes the progress listener until after the mozbrowser has been
  // destroyed, causing a window leak.
  await new Promise(resolve => win.setTimeout(resolve, 0));

  // Restore window with session cookies that have originAttributes within.
  await setWindowState(win, SESSION_DATA_OA, true);

  cookieCount = 0;
  for (cookie of Services.cookies.getCookiesFromHost(TEST_HOST, {})) {
    cookieCount++;
  }

  // Check that the cookie is restored successfully.
  is(cookieCount, 1, "expected one cookie");
  is(cookie.name, COOKIE.name, "cookie name successfully restored");
  is(cookie.value, COOKIE.value, "cookie value successfully restored");
  is(cookie.path, COOKIE.path, "cookie path successfully restored");

  // Close our window.
  await BrowserTestUtils.closeWindow(win);
});
