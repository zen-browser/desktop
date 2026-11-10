/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const EXPANDED_PREF = "zen.view.sidebar-expanded";
const SINGLE_TOOLBAR_PREF = "zen.view.use-single-toolbar";

async function collapseAndExpand(startWithSingleToolbar) {
  await SpecialPowers.pushPrefEnv({
    set: [
      [EXPANDED_PREF, true],
      [SINGLE_TOOLBAR_PREF, startWithSingleToolbar],
    ],
  });
  const command = document.getElementById("cmd_zenToggleSidebar");

  command.doCommand();
  ok(!Services.prefs.getBoolPref(EXPANDED_PREF), "the sidebar collapses");
  ok(
    !Services.prefs.getBoolPref(SINGLE_TOOLBAR_PREF),
    "the collapsed sidebar uses the top toolbar"
  );

  command.doCommand();
  ok(Services.prefs.getBoolPref(EXPANDED_PREF), "the sidebar expands again");
  is(
    Services.prefs.getBoolPref(SINGLE_TOOLBAR_PREF),
    startWithSingleToolbar,
    "expanding the sidebar restores the layout chosen before collapsing it"
  );

  await SpecialPowers.popPrefEnv();
  Services.prefs.clearUserPref("zen.view.use-single-toolbar.before-collapse");
}

add_task(async function test_single_toolbar_layout_survives_toggle() {
  await collapseAndExpand(true);
});

add_task(async function test_multiple_toolbars_layout_survives_toggle() {
  await collapseAndExpand(false);
});
