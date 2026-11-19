/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * These tests ensures that disabling features by flipping nsIDocShell.allow*
 * properties are (re)stored as disabled. Disallowed features must be
 * re-enabled when the tab is re-used by another tab restoration.
 */
add_task(async function docshell_capabilities() {
  let tab = await createTab();
  let browser = tab.linkedBrowser;
  let { browsingContext, docShell } = browser;

  // Get the list of capabilities for docShells.
  let flags = Object.keys(docShell).filter(k => k.startsWith("allow"));

  // Check that everything is allowed by default for new tabs.
  let state = JSON.parse(ss.getTabState(tab));
  ok(!("disallow" in state), "everything allowed by default");
  ok(
    flags.every(f => docShell[f]),
    "all flags set to true"
  );

  // Flip a couple of allow* flags.
  docShell.allowImages = false;
  docShell.allowMetaRedirects = false;
  browsingContext.allowJavascript = false;

  // Now reload the document to ensure that these capabilities
  // are taken into account.
  browser.reload();
  await promiseBrowserLoaded(browser);

  // Flush to make sure chrome received all data.
  await TabStateFlusher.flush(browser);

  // Check that we correctly save disallowed features.
  let disallowedState = JSON.parse(ss.getTabState(tab));
  let disallow = new Set(disallowedState.disallow.split(","));
  ok(disallow.has("Images"), "images not allowed");
  ok(disallow.has("MetaRedirects"), "meta redirects not allowed");
  is(disallow.size, 2, "two capabilities disallowed");

  // Reuse the tab to restore a new, clean state into it.
  await promiseTabState(tab, {
    entries: [{ url: "about:robots", triggeringPrincipal_base64 }],
  });

  // Flush to make sure chrome received all data.
  await TabStateFlusher.flush(browser);

  // After restoring disallowed features must be available again.
  state = JSON.parse(ss.getTabState(tab));
  ok(!("disallow" in state), "everything allowed again");
  ok(
    flags.every(f => docShell[f]),
    "all flags set to true"
  );

  // Restore the state with disallowed features.
  await promiseTabState(tab, disallowedState);

  // Check that docShell flags are set.
  ok(!docShell.allowImages, "images not allowed");
  ok(!docShell.allowMetaRedirects, "meta redirects not allowed");

  // Check that docShell allowJavascript flag is not set.
  ok(browsingContext.allowJavascript, "Javascript still allowed");

  // Check that we correctly restored features as disabled.
  state = JSON.parse(ss.getTabState(tab));
  disallow = new Set(state.disallow.split(","));
  ok(disallow.has("Images"), "images not allowed anymore");
  ok(disallow.has("MetaRedirects"), "meta redirects not allowed anymore");
  ok(!disallow.has("Javascript"), "Javascript still allowed");
  is(disallow.size, 2, "two capabilities disallowed");

  // Clean up after ourselves.
  gBrowser.removeTab(tab);
});

async function createTab() {
  let tab = BrowserTestUtils.addTab(gBrowser, "about:robots");
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);
  return tab;
}
