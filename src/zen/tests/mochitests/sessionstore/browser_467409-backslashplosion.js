/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Test Summary:
// 1.  Open about:sessionrestore where formdata is a JS object, not a string
// 1a. Check that #sessionData on the page is readable after JSON.parse (skipped, checking formdata is sufficient)
// 1b. Check that there are no backslashes in the formdata
// 1c. Check that formdata doesn't require JSON.parse
//
// 2.  Use the current state (currently about:sessionrestore with data) and then open that in a new instance of about:sessionrestore
// 2a. Check that there are no backslashes in the formdata
// 2b. Check that formdata doesn't require JSON.parse
//
// 3.  [backwards compat] Use a stringified state as formdata when opening about:sessionrestore
// 3a. Make sure there are nodes in the tree on about:sessionrestore (skipped, checking formdata is sufficient)
// 3b. Check that there are no backslashes in the formdata
// 3c. Check that formdata doesn't require JSON.parse

const CRASH_STATE = {
  windows: [
    {
      tabs: [
        { entries: [{ url: "about:mozilla", triggeringPrincipal_base64 }] },
      ],
    },
  ],
};
const STATE = createEntries(CRASH_STATE);
const STATE2 = createEntries({ windows: [{ tabs: [STATE] }] });
const STATE3 = createEntries(JSON.stringify(CRASH_STATE));

function createEntries(sessionData) {
  return {
    entries: [{ url: "about:sessionrestore", triggeringPrincipal_base64 }],
    formdata: { id: { sessionData }, url: "about:sessionrestore" },
  };
}

add_task(async function test_nested_about_sessionrestore() {
  // Prepare a blank tab.
  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let browser = tab.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });

  // test 1
  await promiseTabState(tab, STATE);
  await checkState("test1", tab);

  // test 2
  await promiseTabState(tab, STATE2);
  await checkState("test2", tab);

  // test 3
  await promiseTabState(tab, STATE3);
  await checkState("test3", tab);

  // Cleanup.
  gBrowser.removeTab(tab);
});

async function checkState(prefix, tab) {
  // Flush and query tab state.
  await TabStateFlusher.flush(tab.linkedBrowser);
  let { formdata } = JSON.parse(ss.getTabState(tab));

  ok(
    formdata.id.sessionData,
    prefix + ": we have form data for about:sessionrestore"
  );

  let sessionData_raw = JSON.stringify(formdata.id.sessionData);
  ok(
    !/\\/.test(sessionData_raw),
    prefix + ": #sessionData contains no backslashes"
  );
  info(sessionData_raw);

  let gotError = false;
  try {
    JSON.parse(formdata.id.sessionData);
  } catch (e) {
    info(prefix + ": got error: " + e);
    gotError = true;
  }
  ok(gotError, prefix + ": attempting to JSON.parse form data threw error");
}
