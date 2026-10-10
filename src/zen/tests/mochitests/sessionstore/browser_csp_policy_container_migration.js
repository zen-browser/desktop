"use strict";

// We use about:blank because CSP_ShouldURIInheritCSP requires the URL to be
// about:blank, about:srcdoc, or be a blob, filesystem, data, or javascript
// scheme. Top-level data: URI navigation is always blocked.
const URL = "about:blank";

const CSP_JSON = `{"csp-policies":[{"default-src":["'self'"],"report-only":false}]}`;

const CSP_SERIALIZED =
  "CdntGuXUQAS/4CfOuSPZrAAAAAAAAAAAwAAAAAAAAEYB3pRy0IA0EdOTmQAQS6D9QJIHOlRteE8wkTq4cYEyCMYAAAAC/////wAAAbsBAAAAKmh0dHBzOi8vYi5jb21wYXNzLWRlbW8uY29tL2NzcF9wbGF5Z3JvdW5kLwAAAAAAAAAFAAAACAAAABIAAAAI/////wAAAAj/////AAAACAAAABIAAAAaAAAAEAAAABoAAAAQAAAAGgAAABAAAAAqAAAAAAAAACr/////AAAAAP////8AAAAa/////wAAABr/////AQAAAAAAAAAAADh7IjEiOnsiMCI6Imh0dHBzOi8vYi5jb21wYXNzLWRlbW8uY29tL2NzcF9wbGF5Z3JvdW5kLyJ9fQAAAAEAAAASAGQAZQBmAGEAdQBsAHQALQBzAHIAYwAgACcAcwBlAGwAZgAnAAAA";

// Same CSP, but serialized as a policy container
const POLICY_CONTAINER_SERIALIZED =
  "ydqGXsPXSqGicQ9XHwE8MAAAAAAAAAAAwAAAAAAAAEYAAAABAQnZ7Rrl1EAEv+Anzrkj2awdYyAIbJdIrqUcFuLaoPT2Ad6UctCANBHTk5kAEEug/UCSBzpUbXhPMJE6uHGBMgjGAAAAAv////8AAAG7AQAAACpodHRwczovL2IuY29tcGFzcy1kZW1vLmNvbS9jc3BfcGxheWdyb3VuZC8AAAAAAAAABQAAAAgAAAASAAAACP////8AAAAI/////wAAAAgAAAASAAAAGgAAABAAAAAaAAAAEAAAABoAAAAQAAAAKgAAAAAAAAAq/////wAAAAD/////AAAAGv////8AAAAa/////wEAAAAAAAAAAAA4eyIxIjp7IjAiOiJodHRwczovL2IuY29tcGFzcy1kZW1vLmNvbS9jc3BfcGxheWdyb3VuZC8ifX0AAAABAAAAEgBkAGUAZgBhAHUAbAB0AC0AcwByAGMAIAAnAHMAZQBsAGYAJwAAAAFIEv8yG/9CO5f8QKVpba0iSBL/Mhv/QjuX/EClaW2tIgAAAAEAAA==";

/*
 * Tests that whether we pass a serialized CSP or policy container
 * to the session store, it gets deserialized correctly and restored
 * in the tab state.
 */
add_task(async function () {
  // Sanity check: ensure that the CSP JSON and serialized CSP match
  is(
    E10SUtils.deserializeCSP(CSP_SERIALIZED).toJSON(),
    CSP_JSON,
    "CSP should deserialize correctly from serialized CSP string"
  );

  // Firefox 142 and earlier writes entry.csp;
  await checkCSPWithSessionHistoryEntry({ url: URL, csp: CSP_SERIALIZED });
  // Firefox 143 and later writes to policyContainer (bug 1974070).
  await checkCSPWithSessionHistoryEntry({
    url: URL,
    policyContainer: POLICY_CONTAINER_SERIALIZED,
  });
});

async function checkCSPWithSessionHistoryEntry(entry) {
  const tab = await createTabWithSessionHistoryEntry(entry);

  is(
    tab.linkedBrowser.policyContainer.csp.toJSON(),
    CSP_JSON,
    "CSP should be restored correctly from session history entry"
  );

  BrowserTestUtils.removeTab(tab);
}

async function createTabWithSessionHistoryEntry(entry) {
  const state = {
    entries: [entry],
  };

  // Open a tab at a non-about:blank URL first. If the tab is already at
  // about:blank, setTabState with url=about:blank won't trigger a real
  // cross-document navigation, so the CSP from the session history entry
  // would never be applied to the document's policyContainer.
  const tab = BrowserTestUtils.addTab(gBrowser, "about:robots");
  await promiseBrowserLoaded(tab.linkedBrowser, true, "about:robots");

  const restored = promiseTabRestored(tab);
  ss.setTabState(tab, JSON.stringify(state));
  await restored;

  return tab;
}
