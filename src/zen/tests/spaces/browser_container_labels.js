/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function getSetContainerMenu() {
  // The menu is injected by gZenVerticalTabsManager.init(), which can run
  // after the test starts, so wait for it instead of assuming it exists.
  await TestUtils.waitForCondition(
    () => document.getElementById("zen-toolbar-context-set-profile"),
    "Waiting for the set-container toolbar context menu"
  );
  return document.getElementById("zen-toolbar-context-set-profile");
}

add_task(async function test_set_container_menu_label() {
  const menu = await getSetContainerMenu();
  Assert.equal(
    menu.getAttribute("data-lazy-l10n-id"),
    "zen-workspaces-panel-context-set-container",
    "The space menu uses the container l10n id"
  );
  const [message] = await document.l10n.formatMessages([
    { id: "zen-workspaces-panel-context-set-container" },
  ]);
  Assert.ok(message, "The set-container message exists");
  const label = message?.attributes?.find(attr => attr.name === "label");
  Assert.equal(
    label?.value,
    "Set Container",
    "The space menu is labeled Set Container"
  );
});

add_task(async function test_creation_form_strings() {
  Assert.equal(
    await document.l10n.formatValue("zen-workspace-creation-container"),
    "Container",
    "The creation form labels the field Container"
  );
  Assert.equal(
    await document.l10n.formatValue("zen-workspace-no-container"),
    "No Container",
    "The empty container option is No Container"
  );
});

add_task(async function test_old_ids_removed() {
  // Under automation Fluent rejects missing ids instead of returning null.
  await Assert.rejects(
    document.l10n.formatValue("zen-workspace-default-profile"),
    /Missing message in locale en-US: zen-workspace-default-profile/,
    "The old default-profile id no longer resolves to Default"
  );
});
