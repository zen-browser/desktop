"use strict";

// MAX_EXPIRY should be 2^63-1, but JavaScript can't handle that precision.
const MAX_EXPIRY = Math.pow(2, 62);

function addCookie(scheme, secure = false) {
  let cookie = createTestCookie(scheme, secure);
  const cv = Services.cookies.add(
    cookie.host,
    cookie.path,
    cookie.name,
    cookie.value,
    cookie.secure,
    /* isHttpOnly = */ false,
    /* isSession = */ true,
    MAX_EXPIRY,
    /* originAttributes = */ {},
    Ci.nsICookie.SAMESITE_UNSET,
    Ci.nsICookie.SCHEME_HTTPS
  );
  is(cv.result, Ci.nsICookieValidation.eOK, "Valid cookie");
  return cookie;
}

function createTestCookie(scheme, secure = false) {
  let r = Math.round(Math.random() * 100000);

  let cookie = {
    host: `${scheme}://example.com`,
    path: "/",
    name: `name${r}`,
    value: `value${r}`,
    secure,
  };

  return cookie;
}

function getCookie() {
  let state = JSON.parse(ss.getBrowserState());
  let cookies = state.cookies || [];
  return cookies[0];
}

function compareCookies(a) {
  let b = getCookie();
  return a.host == b.host && a.name == b.name && a.value == b.value;
}

// Setup and cleanup.
add_task(async function test_setup() {
  Services.prefs.clearUserPref("browser.sessionstore.privacy_level");

  registerCleanupFunction(() => {
    Services.prefs.clearUserPref("browser.sessionstore.privacy_level");
    Services.cookies.removeAll();
  });
});

// Test privacy_level=none (default). We store all session cookies.
add_task(async function test_level_none() {
  Services.cookies.removeAll();

  // Set level=none, store all cookies.
  Services.prefs.setIntPref("browser.sessionstore.privacy_level", 0);

  // With the default privacy level we collect all cookies.
  ok(compareCookies(addCookie("http")), "non-secure http cookie stored");
  Services.cookies.removeAll();

  // With the default privacy level we collect all cookies.
  ok(compareCookies(addCookie("https")), "non-secure https cookie stored");
  Services.cookies.removeAll();

  // With the default privacy level we collect all cookies.
  ok(compareCookies(addCookie("https", true)), "secure https cookie stored");
  Services.cookies.removeAll();
});

// Test privacy_level=encrypted. We store all non-secure session cookies.
add_task(async function test_level_encrypted() {
  Services.cookies.removeAll();

  // Set level=encrypted, don't store any secure cookies.
  Services.prefs.setIntPref("browser.sessionstore.privacy_level", 1);

  // With level=encrypted, non-secure cookies will be stored.
  ok(compareCookies(addCookie("http")), "non-secure http cookie stored");
  Services.cookies.removeAll();

  // With level=encrypted, non-secure cookies will be stored,
  // even if sent by an HTTPS site.
  ok(compareCookies(addCookie("https")), "non-secure https cookie stored");
  Services.cookies.removeAll();

  // With level=encrypted, non-secure cookies will be stored,
  // even if sent by an HTTPS site.
  ok(
    addCookie("https", true) && !getCookie(),
    "secure https cookie not stored"
  );
  Services.cookies.removeAll();
});

// Test privacy_level=full. We store no session cookies.
add_task(async function test_level_full() {
  Services.cookies.removeAll();

  // Set level=full, don't store any cookies.
  Services.prefs.setIntPref("browser.sessionstore.privacy_level", 2);

  // With level=full we must not store any cookies.
  ok(addCookie("http") && !getCookie(), "non-secure http cookie not stored");
  Services.cookies.removeAll();

  // With level=full we must not store any cookies.
  ok(addCookie("https") && !getCookie(), "non-secure https cookie not stored");
  Services.cookies.removeAll();

  // With level=full we must not store any cookies.
  ok(
    addCookie("https", true) && !getCookie(),
    "secure https cookie not stored"
  );
  Services.cookies.removeAll();
});
