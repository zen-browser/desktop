/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { peppermintActions, registerPeppermintActions } =
  ChromeUtils.importESModule(
    "moz-src:///peppermint/common/PeppermintActions.sys.mjs"
  );
const { globalActions } = ChromeUtils.importESModule(
  "resource:///modules/ZenUBGlobalActions.sys.mjs"
);
const { gZenCookieConsent } = ChromeUtils.importESModule(
  "resource:///modules/zen/cookieconsent/ZenCookieConsentManager.sys.mjs"
);

const PREF_UNDERPOWERED = "zen.underpowered.enabled";

function byId(id) {
  return peppermintActions().find(action => action.commandId === id);
}

add_task(function test_actions_are_in_the_palette() {
  registerPeppermintActions();
  const ids = [
    "peppermint:toggle-underpowered",
    "peppermint:open-notepad",
    "peppermint:toggle-reader-mode",
    "peppermint:save-article-offline",
    "peppermint:open-saved-articles",
    "peppermint:manage-url-snippets",
    "peppermint:toggle-adblock",
    "peppermint:clear-cookie-exceptions",
  ];
  for (const id of ids) {
    const action = byId(id);
    ok(action, `${id} exists`);
    ok(
      globalActions.some(entry => entry.commandId === id),
      `${id} is registered with the command palette`
    );
    ok(action.label.length > 0, `${id} has a label`);
    // These depend on the page: cookie exceptions on there being some, the
    // reader actions on the tab showing a page Reader Mode can open.
    const dependsOnPage = [
      "peppermint:clear-cookie-exceptions",
      "peppermint:toggle-reader-mode",
      "peppermint:save-article-offline",
    ];
    if (!dependsOnPage.includes(id)) {
      ok(action.isAvailable(window), `${id} is available`);
    }
  }
});

add_task(function test_reader_actions_follow_the_page() {
  ok(
    !byId("peppermint:save-article-offline").isAvailable(window),
    "Saving needs an article open in Reader Mode"
  );
  ok(
    byId("peppermint:open-saved-articles").isAvailable(window),
    "The saved articles list is always available"
  );
});

add_task(function test_underpowered_action_toggles_the_pref() {
  const action = byId("peppermint:toggle-underpowered");
  const before = Services.prefs.getBoolPref(PREF_UNDERPOWERED, false);
  action.command(window);
  is(
    Services.prefs.getBoolPref(PREF_UNDERPOWERED),
    !before,
    "The action flips Underpowered mode"
  );
  action.command(window);
  is(
    Services.prefs.getBoolPref(PREF_UNDERPOWERED),
    before,
    "A second run puts the pref back"
  );
});

add_task(async function test_cookie_exception_action_follows_the_pause_list() {
  const action = byId("peppermint:clear-cookie-exceptions");
  gZenCookieConsent.init();
  gZenCookieConsent.clearPaused();
  ok(!action.isAvailable(window), "The action hides when nothing is paused");
  gZenCookieConsent.setPaused("https://example.com/", true);
  ok(action.isAvailable(window), "The action shows when a site is paused");
  action.command(window);
  ok(!gZenCookieConsent.hasPaused(), "The action clears the pause list");
  ok(!action.isAvailable(window), "The action hides again once the list is empty");
});

add_task(async function test_notepad_action_opens_a_note() {
  const action = byId("peppermint:open-notepad");
  action.command(window);
  let tab;
  await TestUtils.waitForCondition(() => {
    tab = gBrowser.tabs.find(candidate =>
      candidate.linkedBrowser?.currentURI?.spec?.startsWith("mint://note/")
    );
    return !!tab;
  }, "The notepad action opens a note");
  BrowserTestUtils.removeTab(tab);
});
