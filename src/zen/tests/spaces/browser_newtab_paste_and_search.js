/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { SearchTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/SearchTestUtils.sys.mjs"
);

const NEW_TAB_L10N_ID = "tabs-toolbar-new-tab";
const PASTE_L10N_ID = "zen-tabs-newtab-paste-and-search";

function newTabButton() {
  return gZenWorkspaces.activeWorkspaceElement.newTabButton;
}

function sublabel() {
  return newTabButton().querySelector(".zen-tab-sublabel");
}

function isOffering() {
  return newTabButton().hasAttribute("zen-paste-and-search");
}

async function labelFor(id) {
  const [message] = await document.l10n.formatMessages([{ id }]);
  const label = message?.attributes?.find(attr => attr.name === "label");
  ok(label, `${id} should provide a label`);
  return label.value;
}

async function awaitLabel(id) {
  const expected = await labelFor(id);
  await TestUtils.waitForCondition(
    () => newTabButton().getAttribute("label") === expected,
    `The button should be labelled "${expected}"`
  );
}

async function copyToClipboard(text) {
  await new Promise((resolve, reject) => {
    SimpleTest.waitForClipboard(
      text,
      () => {
        Cc["@mozilla.org/widget/clipboardhelper;1"]
          .getService(Ci.nsIClipboardHelper)
          .copyString(text);
      },
      resolve,
      () => {
        ok(false, "Clipboard copy failed");
        reject();
      }
    );
  });
}

function hoverNewTabButton(modifiers = {}) {
  EventUtils.synthesizeMouseAtCenter(
    newTabButton(),
    { type: "mousemove", ...modifiers },
    window
  );
}

function unhoverNewTabButton() {
  EventUtils.synthesizeMouseAtCenter(
    gZenWorkspaces.activeWorkspaceElement.querySelector(
      ".zen-workspace-empty-space"
    ),
    { type: "mousemove" },
    window
  );
}

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      // Awaiting the new tab is only reliable without a preloaded one.
      ["browser.newtab.preload", false],
    ],
  });
  NewTabPagePreloading.removePreloadedBrowser(window);

  SearchTestUtils.init(this);
  await SearchTestUtils.installSearchExtension(
    {
      name: "MozSearch",
      search_url: "https://example.org/",
      search_url_get_params: "q={searchTerms}",
    },
    { setAsDefault: true }
  );

  registerCleanupFunction(async () => {
    unhoverNewTabButton();
    await SpecialPowers.popPrefEnv();
    while (gBrowser.tabs.length > 1) {
      BrowserTestUtils.removeTab(gBrowser.selectedTab);
    }
  });
});

add_task(async function test_accel_hover_offers_paste_and_search() {
  unhoverNewTabButton();
  const url = "https://example.com/pasted";
  await copyToClipboard(url);

  hoverNewTabButton({ accelKey: true });
  ok(isOffering(), "The accel key should turn the button into paste & search");
  await awaitLabel(PASTE_L10N_ID);
  Assert.strictEqual(
    sublabel().value,
    url,
    "The clipboard should be previewed under the label"
  );

  unhoverNewTabButton();
  ok(!isOffering(), "Leaving the button should put it back");
  await awaitLabel(NEW_TAB_L10N_ID);
});

add_task(async function test_preview_is_flattened_onto_one_line() {
  unhoverNewTabButton();
  await copyToClipboard("  https://example.com/a\n  b  ");

  hoverNewTabButton({ accelKey: true });
  ok(isOffering(), "Multi-line clipboard text should still be offered");
  Assert.strictEqual(
    sublabel().value,
    "https://example.com/a b",
    "The preview should be trimmed and collapsed onto one line"
  );

  unhoverNewTabButton();
});

add_task(async function test_nothing_offered_without_clipboard_text() {
  unhoverNewTabButton();
  await SpecialPowers.cleanupAllClipboard();

  hoverNewTabButton({ accelKey: true });
  ok(!isOffering(), "An empty clipboard should offer nothing");
  await awaitLabel(NEW_TAB_L10N_ID);

  unhoverNewTabButton();
});

add_task(async function test_accel_click_pastes_a_url() {
  unhoverNewTabButton();
  // The javascript: prefix has to be stripped before the tab is opened.
  await copyToClipboard("javascript:https://example.com/pasted");
  const expected = "https://example.com/pasted";

  hoverNewTabButton({ accelKey: true });
  ok(isOffering(), "The button should be offering paste & search");

  const newTab = BrowserTestUtils.waitForNewTab(gBrowser, expected, true);
  EventUtils.synthesizeMouseAtCenter(
    newTabButton(),
    { accelKey: true },
    window
  );
  const tab = await newTab;

  Assert.strictEqual(
    tab.linkedBrowser.currentURI.spec,
    expected,
    "The clipboard should have been loaded in the new tab"
  );

  BrowserTestUtils.removeTab(tab);
  unhoverNewTabButton();
});

add_task(async function test_accel_click_searches_plain_text() {
  unhoverNewTabButton();
  await copyToClipboard("word");
  const expected = "https://example.org/?q=word";

  hoverNewTabButton({ accelKey: true });
  ok(isOffering(), "The button should be offering paste & search");

  const newTab = BrowserTestUtils.waitForNewTab(gBrowser, expected, true);
  EventUtils.synthesizeMouseAtCenter(
    newTabButton(),
    { accelKey: true },
    window
  );
  const tab = await newTab;

  Assert.strictEqual(
    tab.linkedBrowser.currentURI.spec,
    expected,
    "Text that is not a URL should have been searched for"
  );

  BrowserTestUtils.removeTab(tab);
  unhoverNewTabButton();
});

add_task(async function test_plain_click_still_opens_a_new_tab() {
  unhoverNewTabButton();
  await copyToClipboard("https://example.com/not-pasted");

  const newTab = BrowserTestUtils.waitForNewTab(gBrowser);
  EventUtils.synthesizeMouseAtCenter(newTabButton(), {}, window);
  const tab = await newTab;

  Assert.notStrictEqual(
    tab.linkedBrowser.currentURI.spec,
    "https://example.com/not-pasted",
    "A click without the accel key should ignore the clipboard"
  );

  BrowserTestUtils.removeTab(tab);
  unhoverNewTabButton();
});
