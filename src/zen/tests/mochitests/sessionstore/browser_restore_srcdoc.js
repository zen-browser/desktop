/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function makeURL(srcdocValue) {
  return `data:text/html;charset=utf-8,<iframe srcdoc="${srcdocValue}">`;
}

async function runTest(srcdocValue) {
  forgetClosedWindows();

  // Open a new tab.
  let tab = BrowserTestUtils.addTab(gBrowser, makeURL(srcdocValue));
  await promiseBrowserLoaded(tab.linkedBrowser);

  // Close that tab.
  await promiseRemoveTabAndSessionState(tab);

  // Restore that tab.
  tab = ss.undoCloseTab(window, 0);
  await promiseTabRestored(tab);

  // Verify contents were restored correctly.
  let iframe = await SpecialPowers.spawn(
    tab.linkedBrowser,
    [],
    () => content.document.querySelector("iframe").browsingContext
  );
  await SpecialPowers.spawn(iframe, [srcdocValue], text => {
    Assert.equal(content.document.body.innerText, text, "Didn't load neterror");
  });

  // Cleanup.
  gBrowser.removeTab(tab);
}

add_task(async function test_non_blank() {
  await runTest("value");
});

add_task(async function test_blank() {
  await runTest("");
});
