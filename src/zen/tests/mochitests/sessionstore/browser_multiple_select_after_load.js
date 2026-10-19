/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const URL = `data:text/html;charset=utf-8,
<select id="select">
  <option value="1"> 1
  <option value="2"> 2
  <option value="3"> 3
</select>`;

const VALUES = ["1", "3"];

// Tests that a document that changes a <select> element's "multiple" attribute
// *after* the load event (eg. perhaps in response to some user action) doesn't
// crash the browser when being restored.
add_task(async function () {
  // Create new tab.
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  await promiseBrowserLoaded(tab.linkedBrowser);

  // Change the "multiple" attribute of the <select> element and select some
  // options.
  await setPropertyOfFormField(tab.linkedBrowser, "select", "multiple", true);

  for (let v of VALUES) {
    await setPropertyOfFormField(
      tab.linkedBrowser,
      `option[value="${v}"]`,
      "selected",
      true
    );
  }

  // Remove the tab.
  await promiseRemoveTabAndSessionState(tab);

  // Verify state of the closed tab.
  let tabData = ss.getClosedTabDataForWindow(window);
  Assert.deepEqual(
    tabData[0].state.formdata.id.select,
    VALUES,
    "Collected correct formdata"
  );

  // Restore the close tab.
  tab = ss.undoCloseTab(window, 0);
  await promiseTabRestored(tab);
  ok(true, "Didn't crash!");

  // Cleanup.
  gBrowser.removeTab(tab);
});
