/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_ORIGIN = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "http://example.com"
);

const { HttpServer } = ChromeUtils.importESModule(
  "resource://testing-common/httpd.sys.mjs"
);

add_task(async function test_ss_cookie_redirect() {
  // Set the samesite cookie
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    TEST_ORIGIN + "setSameSiteCookie.html"
  );
  BrowserTestUtils.removeTab(tab);

  let server = new HttpServer();
  server.start(-1);
  server.registerPathHandler("/foo", (request, response) => {
    response.setStatusLine(request.httpVersion, 302, "Found");
    response.setHeader("Location", TEST_ORIGIN + "getCookies.sjs");
  });
  registerCleanupFunction(() => server.stop());
  const { primaryPort, primaryHost } = server.identity;
  const serverURL = `http://${primaryHost}:${primaryPort}/foo`;

  // Now open `getCookies.sjs` but via a redirect:
  await BrowserTestUtils.withNewTab("about:blank", async browser => {
    let loaded = BrowserTestUtils.waitForContentEvent(
      browser,
      "AboutReaderContentReady"
    );
    BrowserTestUtils.startLoadingURIString(
      browser,
      "about:reader?url=" + encodeURIComponent(serverURL)
    );
    await loaded;
    await SpecialPowers.spawn(browser, [], () => {
      is(
        content.document.getElementById("cookieSpan").textContent,
        "",
        "Shouldn't get cookies."
      );
    });
  });
});
