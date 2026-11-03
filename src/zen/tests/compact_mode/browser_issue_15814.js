/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_window_buttons_hover_without_sidebar_hover() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.view.compact.show-sidebar-and-toolbar-on-hover", false]],
  });

  const windowButtons = gZenVerticalTabsManager.actualWindowButtons;
  const sidebar = gZenCompactModeManager.sidebar;

  gZenCompactModeManager._setElementExpandAttribute(windowButtons, true);
  is(
    windowButtons.getAttribute("zen-has-hover"),
    "true",
    "Window buttons should get the hover attribute even when the sidebar and toolbar don't show on hover"
  );

  gZenCompactModeManager._setElementExpandAttribute(sidebar, true);
  ok(
    !sidebar.hasAttribute("zen-has-hover"),
    "Sidebar should not get the hover attribute when the pref is disabled"
  );

  gZenCompactModeManager._setElementExpandAttribute(windowButtons, false);
  gZenCompactModeManager._setElementExpandAttribute(sidebar, false);
  ok(
    !windowButtons.hasAttribute("zen-has-hover"),
    "Window buttons hover attribute should be removed"
  );

  await SpecialPowers.popPrefEnv();
});
