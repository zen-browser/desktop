/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_search_engines() {
  const win = await openSettingsWindow(() => ZenSettings.open("search"));
  const doc = win.document;
  const list = doc.getElementById("zen-settings-search-engines");
  const engines = await SearchService.getEngines();
  const defaultEngine = await SearchService.getDefault();
  await TestUtils.waitForCondition(
    () => list.children.length == engines.length,
    "Every search engine has a row"
  );
  const rowFor = engine => list.querySelector(`[data-id="${engine.id}"]`);
  ok(
    rowFor(defaultEngine).querySelector("moz-toggle").disabled,
    "The default engine can't be turned off"
  );

  const engine = engines.find(e => e != defaultEngine && !e.hidden);
  const originalAlias = engine.alias;
  registerCleanupFunction(() => {
    engine.hidden = false;
    engine.alias = originalAlias;
  });

  await clickToggle(rowFor(engine).querySelector("moz-toggle"));
  ok(engine.hidden, "Turning an engine off hides it");
  await TestUtils.waitForCondition(
    () => !rowFor(engine).querySelector("moz-toggle").pressed,
    "The row shows the engine as off"
  );
  const defaultList = doc.getElementById("zen-settings-search-engine");
  ok(
    ![...defaultList.menupopup.children].some(i => i.value == engine.id),
    "A hidden engine can't be picked as the default"
  );
  await clickToggle(rowFor(engine).querySelector("moz-toggle"));
  ok(!engine.hidden, "Turning it on again shows it");

  await TestUtils.waitForCondition(
    () => rowFor(engine).querySelector("moz-toggle").pressed,
    "The row shows the engine as on"
  );
  const keyword = rowFor(engine).querySelector("input");
  keyword.value = "zensettingstest";
  keyword.dispatchEvent(new win.Event("change", { bubbles: true }));
  await TestUtils.waitForCondition(
    () => engine.alias == "zensettingstest",
    "Typing a keyword sets it on the engine"
  );

  const other = engines.find(e => e != engine);
  await TestUtils.waitForCondition(
    () => rowFor(other)?.isConnected,
    "The rows are back after the change"
  );
  const otherKeyword = rowFor(other).querySelector("input");
  const otherAlias = other.alias;
  otherKeyword.value = "zensettingstest";
  otherKeyword.dispatchEvent(new win.Event("change", { bubbles: true }));
  await TestUtils.waitForCondition(
    () => otherKeyword.value == (otherAlias ?? ""),
    "A keyword another engine uses is refused"
  );
  is(other.alias, otherAlias, "The other engine keeps its keyword");

  await BrowserTestUtils.closeWindow(win);
});
