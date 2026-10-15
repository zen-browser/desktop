/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const URL = ROOT + "browser_463205_sample.html";

/**
 * Bug 463205 - Check URLs before restoring form data to make sure a malicious
 * website can't modify frame URLs and make us inject form data into the wrong
 * web pages.
 */
add_task(async function test_check_urls_before_restoring() {
  // Add a blank tab.
  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let browser = tab.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });

  // Restore form data with a valid URL.
  await promiseTabState(tab, getState(URL));

  let value = await getPropertyOfFormField(browser, "#text", "value");
  is(value, "foobar", "value was restored");

  // Restore form data with an invalid URL.
  await promiseTabState(tab, getState("http://example.com/"));

  value = await getPropertyOfFormField(browser, "#text", "value");
  is(value, "", "value was not restored");

  // Cleanup.
  gBrowser.removeTab(tab);
});

function getState(url) {
  return JSON.stringify({
    entries: [{ url: URL, triggeringPrincipal_base64 }],
    formdata: { url, id: { text: "foobar" } },
  });
}
