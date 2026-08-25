/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

add_task(async function test() {
  /** Test for Bug 339445 */

  let testURL =
    "http://mochi.test:8888/browser/" +
    "browser/components/sessionstore/test/browser_339445_sample.html";

  let tab = BrowserTestUtils.addTab(gBrowser, testURL);
  await promiseBrowserLoaded(tab.linkedBrowser, true, testURL);

  await SpecialPowers.spawn(tab.linkedBrowser, [], function () {
    let doc = content.document;
    is(
      doc.getElementById("storageTestItem").textContent,
      "PENDING",
      "sessionStorage value has been set"
    );
  });

  let tab2 = gBrowser.duplicateTab(tab);
  await promiseTabRestored(tab2);

  await SpecialPowers.spawn(tab2.linkedBrowser, [], function () {
    let doc2 = content.document;
    is(
      doc2.getElementById("storageTestItem").textContent,
      "SUCCESS",
      "sessionStorage value has been duplicated"
    );
  });

  // clean up
  BrowserTestUtils.removeTab(tab2);
  BrowserTestUtils.removeTab(tab);
});
