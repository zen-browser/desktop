/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Tabs the tree must never adopt: essentials, glance tabs, empty tabs, and live
// folder items are all ineligible and can't be nested.
add_task(async function test_special_tabs_are_ineligible() {
  const parent = await addNormalTab();
  const cases = [
    ["zen-essential", "true"],
    ["zen-glance-tab", ""],
    ["zen-empty-tab", ""],
    ["zen-live-folder-item-id", "folder:1"],
  ];

  for (const [attr, value] of cases) {
    const tab = await addNormalTab();
    tab.setAttribute(attr, value);
    Assert.ok(
      !gZenTabTree.isTreeEligible(tab),
      `a [${attr}] tab is not tree-eligible`
    );
    Assert.ok(
      !gZenTabTree.nestTab(tab, parent),
      `a [${attr}] tab cannot be nested`
    );
    tab.removeAttribute(attr);
    await cleanupTabs(tab);
  }

  await cleanupTabs(parent);
});
