/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_language() {
  const win = await openSettingsWindow(() => ZenSettings.open("language"));
  const doc = win.document;
  const list = doc.getElementById("zen-settings-language");
  const values = [...list.menupopup.children]
    .filter(item => item.localName == "menuitem")
    .map(item => item.value);
  Assert.deepEqual(
    values,
    [...Services.locale.availableLocales, "more"],
    "Every installed language is offered, then the way to get more"
  );
  is(
    list.value,
    Services.locale.requestedLocales[0],
    "The requested language is selected"
  );
  ok(list.label, "The selected language is named");

  await SpecialPowers.pushPrefEnv({
    set: [["browser.translations.enable", false]],
  });
  ok(
    toggleFor(win, "browser.translations.automaticallyPopup").closest(
      ".zen-settings-row"
    ).inert,
    "Translation options are inert while translations are off"
  );
  await SpecialPowers.popPrefEnv();
  await BrowserTestUtils.closeWindow(win);
});
