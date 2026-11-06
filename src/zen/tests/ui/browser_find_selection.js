/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PREFILL_PREF = "accessibility.typeaheadfind.prefillwithselection";
const SELECTION_PAGE =
  "data:text/html;charset=utf-8," +
  encodeURIComponent(
    "<p id='first'>Zen selection</p><p id='second'>New query</p>"
  );

add_task(function test_selection_prefill_default() {
  ok(
    Services.prefs.getDefaultBranch("").getBoolPref(PREFILL_PREF),
    "Find uses the page selection by default, including on macOS"
  );
  ok(!Services.prefs.prefIsLocked(PREFILL_PREF), "Users can disable prefill");
});

add_task(async function test_find_shortcut_prefills_page_selection() {
  await BrowserTestUtils.withNewTab(SELECTION_PAGE, async browser => {
    const findbar = await gBrowser.getFindBar();
    for (const [id, expected] of [
      ["first", "Zen selection"],
      ["second", "New query"],
    ]) {
      await SimpleTest.promiseFocus(browser);
      await SpecialPowers.spawn(browser, [id], elementId => {
        content
          .getSelection()
          .selectAllChildren(content.document.getElementById(elementId));
      });

      const opened = BrowserTestUtils.waitForEvent(findbar, "findbaropen");
      EventUtils.synthesizeKey("f", { accelKey: true }, window);
      await opened;
      await TestUtils.waitForCondition(
        () => findbar._findField.value == expected,
        "Cmd/Ctrl+F to prefill the current selection without Cmd+E"
      );
      is(
        document.activeElement,
        findbar._findField,
        "The find field has focus"
      );

      const closed = BrowserTestUtils.waitForEvent(findbar, "findbarclose");
      EventUtils.synthesizeKey("KEY_Escape", {}, window);
      await closed;
    }
  });
});
