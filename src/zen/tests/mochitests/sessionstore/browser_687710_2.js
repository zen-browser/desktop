/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Test that the fix for bug 687710 isn't too aggressive -- shentries which are
// cousins should be able to share bfcache entries.

var stateBackup = ss.getBrowserState();

var state = {
  entries: [
    {
      docIdentifier: 1,
      url: "http://example.com?1",
      triggeringPrincipal_base64,
      children: [
        {
          docIdentifier: 10,
          url: "http://example.com?10",
          triggeringPrincipal_base64,
        },
      ],
    },
    {
      docIdentifier: 1,
      url: "http://example.com?1#a",
      triggeringPrincipal_base64,
      children: [
        {
          docIdentifier: 10,
          url: "http://example.com?10#aa",
          triggeringPrincipal_base64,
        },
      ],
    },
  ],
};

add_task(async function test() {
  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank");

  // addTab sends a message to the child to load about:blank, which sends a
  // message to the parent to add the SH entry.
  // promiseTabState modifies the SH syncronously, so ensure it is settled.
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser, {
    wantLoad: "about:blank",
  });

  await promiseTabState(tab, state);

  function compareEntries(i, j, history) {
    let e1 = history.getEntryAtIndex(i);
    let e2 = history.getEntryAtIndex(j);

    ok(e1.sharesDocumentWith(e2), `${i} should share doc with ${j}`);
    is(e1.childCount, e2.childCount, `Child count mismatch (${i}, ${j})`);

    for (let c = 0; c < e1.childCount; c++) {
      let c1 = e1.GetChildAt(c);
      let c2 = e2.GetChildAt(c);

      ok(
        c1.sharesDocumentWith(c2),
        `Cousins should share documents. (${i}, ${j}, ${c})`
      );
    }
  }

  let history = tab.linkedBrowser.browsingContext.sessionHistory;

  is(history.count, 2, "history.count");
  for (let i = 0; i < history.count; i++) {
    for (let j = 0; j < history.count; j++) {
      compareEntries(i, j, history);
    }
  }

  ss.setBrowserState(stateBackup);
});
