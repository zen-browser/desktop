"use strict";

function createTestState() {
  let r = Math.round(Math.random() * 100000);

  let cookie = {
    host: "http://example.com",
    path: "/",
    name: `name${r}`,
    value: `value${r}`,
    sameSite: Ci.nsICookie.SAMESITE_UNSET,
  };

  let state = {
    windows: [
      {
        tabs: [
          { entries: [{ url: "about:robots", triggeringPrincipal_base64 }] },
        ],
        cookies: [cookie],
      },
    ],
  };

  return [state, cookie];
}

function waitForNewCookie({ host, name, value }) {
  info(`waiting for cookie ${name}=${value} from ${host}...`);

  return new Promise(resolve => {
    Services.obs.addObserver(function observer(subj, topic) {
      let notification = subj.QueryInterface(Ci.nsICookieNotification);
      if (notification.action != Ci.nsICookieNotification.COOKIE_ADDED) {
        return;
      }

      let cookie = notification.cookie.QueryInterface(Ci.nsICookie);
      if (cookie.host == host && cookie.name == name && cookie.value == value) {
        ok(true, "cookie added by the cookie service");
        Services.obs.removeObserver(observer, topic);
        resolve();
      }
    }, "session-cookie-changed");
  });
}

// Setup and cleanup.
add_task(async function test_setup() {
  Services.cookies.removeAll();

  registerCleanupFunction(() => {
    Services.cookies.removeAll();
  });
});

// Test that calling ss.setWindowState() with a legacy state object that
// contains cookies in the window state restores session cookies properly.
add_task(async function test_window() {
  let [state, cookie] = createTestState();
  let win = await promiseNewWindowLoaded();

  let promiseCookie = waitForNewCookie(cookie);
  ss.setWindowState(win, JSON.stringify(state), true);
  await promiseCookie;

  await BrowserTestUtils.closeWindow(win);
});

// Test that calling ss.setBrowserState() with a legacy state object that
// contains cookies in the window state restores session cookies properly.
add_task(async function test_browser() {
  let backupState = ss.getBrowserState();
  let [state, cookie] = createTestState();
  await Promise.all([waitForNewCookie(cookie), promiseBrowserState(state)]);
  await promiseBrowserState(backupState);
});
