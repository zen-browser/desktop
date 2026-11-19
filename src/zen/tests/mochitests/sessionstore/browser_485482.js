/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

if (gFissionBrowser) {
  addCoopTask(
    "browser_485482_sample.html",
    test_xpath_exp_for_strange_documents,
    HTTPSROOT
  );
}
addNonCoopTask(
  "browser_485482_sample.html",
  test_xpath_exp_for_strange_documents,
  ROOT
);
addNonCoopTask(
  "browser_485482_sample.html",
  test_xpath_exp_for_strange_documents,
  HTTPSROOT
);
addNonCoopTask(
  "browser_485482_sample.html",
  test_xpath_exp_for_strange_documents,
  HTTPROOT
);

/**
 * Bug 485482 - Make sure that we produce valid XPath expressions even for very
 * weird HTML documents.
 */
async function test_xpath_exp_for_strange_documents(aURL) {
  // Load a page with weird tag names.
  let tab = BrowserTestUtils.addTab(gBrowser, aURL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Fill in some values.
  let uniqueValue = Math.random();
  await setPropertyOfFormField(
    browser,
    "input[type=text]",
    "value",
    uniqueValue
  );
  await setPropertyOfFormField(
    browser,
    "input[type=checkbox]",
    "checked",
    true
  );

  // Duplicate the tab.
  let tab2 = gBrowser.duplicateTab(tab);
  let browser2 = tab2.linkedBrowser;
  await promiseTabRestored(tab2);

  // Check that we generated valid XPath expressions to restore form values.
  let text = await getPropertyOfFormField(
    browser2,
    "input[type=text]",
    "value"
  );
  is("" + text, "" + uniqueValue, "generated XPath expression was valid");
  let checkbox = await getPropertyOfFormField(
    browser2,
    "input[type=checkbox]",
    "checked"
  );
  ok(checkbox, "generated XPath expression was valid");

  // Cleanup.
  gBrowser.removeTab(tab2);
  gBrowser.removeTab(tab);
}
