// First test - open a tab and duplicate it, using session restore to restore the history into the new tab.
add_task(async function duplicateTab() {
  const TEST_URL = "data:text/html,foo";
  let tab = BrowserTestUtils.addTab(gBrowser, TEST_URL);
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);

  let historyID = tab.linkedBrowser.browsingContext.historyID;
  let shEntry =
    tab.linkedBrowser.browsingContext.sessionHistory.getEntryAtIndex(0);
  is(shEntry.docshellID.toString(), historyID.toString());

  let tab2 = gBrowser.duplicateTab(tab);
  await BrowserTestUtils.browserLoaded(tab2.linkedBrowser);

  historyID = tab2.linkedBrowser.browsingContext.historyID;
  shEntry =
    tab2.linkedBrowser.browsingContext.sessionHistory.getEntryAtIndex(0);
  is(shEntry.docshellID.toString(), historyID.toString());

  BrowserTestUtils.removeTab(tab);
  BrowserTestUtils.removeTab(tab2);
});

// Second test - open a tab and navigate across processes, which triggers sessionrestore to persist history.
add_task(async function contentToChromeNavigate() {
  const TEST_URL = "data:text/html,foo";
  let tab = BrowserTestUtils.addTab(gBrowser, TEST_URL);
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);

  let historyID = tab.linkedBrowser.browsingContext.historyID;
  let sh = tab.linkedBrowser.browsingContext.sessionHistory;
  is(sh.count, 1);
  is(sh.getEntryAtIndex(0).docshellID.toString(), historyID.toString());

  // Force the browser to navigate to the chrome process.
  BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, "about:config");
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);

  // Check to be sure that we're in the chrome process.
  let docShell = tab.linkedBrowser.frameLoader.docShell;

  // 'cause we're in the chrome process, we can just directly poke at the shistory.
  sh = docShell.browsingContext.sessionHistory;

  is(sh.count, 2);
  is(
    sh.getEntryAtIndex(0).docshellID.toString(),
    docShell.historyID.toString()
  );
  is(
    sh.getEntryAtIndex(1).docshellID.toString(),
    docShell.historyID.toString()
  );

  BrowserTestUtils.removeTab(tab);
});
