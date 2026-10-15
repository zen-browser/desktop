/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 * A session history entry only needs to retain the policy container for loads
 * that inherit their policies (about:blank, about:srcdoc, blob:, data:, ...).
 * Anything fetched over the network gets its policies from the response again,
 * so storing them would only bloat the session store (bug 2011236).
 */

const TEST_ROOT = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "https://example.com"
);
const PARENT_URL = TEST_ROOT + "browser_policy_container_sample.html";
const FRAME_URL = TEST_ROOT + "browser_policy_container_sample_frame.html";

add_task(async function test_policy_container_only_for_inheriting_loads() {
  const tab = BrowserTestUtils.addTab(gBrowser, PARENT_URL);
  gBrowser.selectedTab = tab;
  await promiseBrowserLoaded(tab.linkedBrowser, true, PARENT_URL);
  await TabStateFlusher.flush(tab.linkedBrowser);

  const state = JSON.parse(ss.getTabState(tab));
  const topEntry = state.entries.at(-1);
  is(topEntry.url, PARENT_URL, "collected the parent entry");

  const children = topEntry.children ?? [];
  const networkFrame = children.find(child => child.url === FRAME_URL);
  const blankFrame = children.find(child => child.url === "about:blank");

  ok(networkFrame, "collected the network-scheme subframe entry");
  ok(blankFrame, "collected the about:blank subframe entry");

  // The parent has a CSP, so both subframes inherit a policy container onto
  // their load state. Only the one that cannot recover it from a response
  // should keep it in session history.
  ok(
    !("policyContainer" in networkFrame),
    "https subframe entry does not store a policyContainer"
  );
  ok(
    "policyContainer" in blankFrame,
    "about:blank subframe entry still stores its inherited policyContainer"
  );

  await BrowserTestUtils.removeTab(tab);
});
