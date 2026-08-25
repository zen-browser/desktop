/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const MOCHI_ROOT = ROOT.replace(
  "chrome://mochitests/content/",
  "http://mochi.test:8888/"
);
if (gFissionBrowser) {
  addCoopTask(
    "browser_463206_sample.html",
    test_restore_text_data_subframes,
    HTTPSROOT
  );
}
addNonCoopTask(
  "browser_463206_sample.html",
  test_restore_text_data_subframes,
  HTTPSROOT
);
addNonCoopTask(
  "browser_463206_sample.html",
  test_restore_text_data_subframes,
  HTTPROOT
);
addNonCoopTask(
  "browser_463206_sample.html",
  test_restore_text_data_subframes,
  MOCHI_ROOT
);

async function test_restore_text_data_subframes(aURL) {
  // Add a new tab.
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, aURL);

  await setPropertyOfFormField(
    tab.linkedBrowser,
    "#out1",
    "value",
    Date.now().toString(16)
  );

  await setPropertyOfFormField(
    tab.linkedBrowser,
    "input[name='1|#out2']",
    "value",
    Math.random()
  );

  await setPropertyOfFormField(
    tab.linkedBrowser.browsingContext.children[0].children[1],
    "#in1",
    "value",
    new Date()
  );

  // Duplicate the tab.
  let tab2 = gBrowser.duplicateTab(tab);
  let browser2 = tab2.linkedBrowser;
  await promiseTabRestored(tab2);

  isnot(
    await getPropertyOfFormField(browser2, "#out1", "value"),
    await getPropertyOfFormField(
      browser2.browsingContext.children[1],
      "#out1",
      "value"
    ),
    "text isn't reused for frames"
  );

  isnot(
    await getPropertyOfFormField(browser2, "input[name='1|#out2']", "value"),
    "",
    "text containing | and # is correctly restored"
  );

  is(
    await getPropertyOfFormField(
      browser2.browsingContext.children[1],
      "#out2",
      "value"
    ),
    "",
    "id prefixes can't be faked"
  );

  // Query a few values from the top and its child frames.
  await SpecialPowers.spawn(tab2.linkedBrowser, [], async function () {
    // Bug 588077
    // XXX(farre): disabling this, because it started passing more heavily on Windows.
    /*
    let in1ValFrame0_1 = await SpecialPowers.spawn(
      content.frames[0],
      [],
      async function() {
        return SpecialPowers.spawn(content.frames[1], [], async function() {
          return content.document.getElementById("in1").value;
        });
      }
    );
    todo_is(in1ValFrame0_1, "", "id prefixes aren't mixed up");
    */
  });

  is(
    await getPropertyOfFormField(
      browser2.browsingContext.children[1].children[0],
      "#in1",
      "value"
    ),
    "",
    "id prefixes aren't mixed up"
  );
  // Cleanup.
  gBrowser.removeTab(tab2);
  gBrowser.removeTab(tab);
}
