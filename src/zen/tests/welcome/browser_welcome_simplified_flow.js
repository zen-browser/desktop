/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Focused regression coverage for the simplified Astra welcome flow:
 * Intro → Features → Privacy → Search → Import → Finish
 * (no Workspaces or Theme onboarding pages / side effects).
 */

function snapshotWorkspaces() {
  if (typeof gZenWorkspaces === "undefined" || !gZenWorkspaces.getWorkspaces) {
    return { available: false, uuids: [], names: [], count: 0 };
  }
  const workspaces = gZenWorkspaces.getWorkspaces();
  return {
    available: true,
    count: workspaces.length,
    uuids: workspaces.map(workspace => workspace.uuid).sort(),
    names: workspaces.map(workspace => workspace.name).sort(),
  };
}

function getThemeSchemePref() {
  return Services.prefs.getIntPref("zen.view.window.scheme", 2);
}

function assertNoRemovedWelcomePages() {
  const content = document.getElementById("zen-welcome-page-content");
  ok(content, "Welcome page content should exist");
  ok(
    !content.querySelector(".zen-welcome-workspace-item"),
    "Workspaces onboarding cards must not appear"
  );
  ok(
    !content.querySelector(".zen-welcome-theme-swatch"),
    "Theme onboarding swatches must not appear"
  );
  ok(
    !document.getElementById("zen-welcome-workspace-colors-anchor"),
    "Embedded theme-picker anchor must not appear"
  );
  Assert.equal(
    document.querySelectorAll(
      '[data-l10n-id="zen-welcome-workspaces-title"], [data-l10n-id="zen-welcome-theme-title"]'
    ).length,
    0,
    "Removed Workspaces/Theme page titles must not appear"
  );
}

add_task(async function test_welcome_simplified_flow_no_side_effects() {
  await waitForFocus();

  const startButton = await waitForWelcomeElement(
    () => document.getElementById("zen-welcome-start-button"),
    "Intro start button should appear"
  );
  ok(
    document.getElementById("zen-welcome-start"),
    "Intro screen should be visible"
  );
  ok(
    document.documentElement.hasAttribute("zen-welcome-stage"),
    "Welcome stage attribute should be set on Intro"
  );

  const workspacesBefore = snapshotWorkspaces();
  const themeBefore = getThemeSchemePref();

  await EventUtils.synthesizeMouseAtCenter(startButton, {});
  await waitForWelcomeSidebarTitle(
    "zen-welcome-features-title",
    "Features page should follow Intro"
  );
  ok(
    document.querySelector(".zen-welcome-feature-grid"),
    "Features page should render the feature grid"
  );
  assertWelcomeStepProgress(1, 4);
  assertNoRemovedWelcomePages();

  await clickWelcomePrimaryButton("zen-generic-next");
  await waitForWelcomeSidebarTitle(
    "zen-welcome-privacy-title",
    "Privacy page should follow Features"
  );
  ok(
    document.querySelector(".zen-welcome-privacy-list"),
    "Privacy page should render the privacy checklist"
  );
  assertWelcomeStepProgress(2, 4);
  assertNoRemovedWelcomePages();

  await clickWelcomePrimaryButton("zen-generic-next");
  await waitForWelcomeSidebarTitle(
    "zen-welcome-search-title",
    "Search Engine page should follow Privacy"
  );
  ok(
    document
      .getElementById("zen-welcome-page-content")
      ?.hasAttribute("select-engine"),
    "Search Engine page should present engine selection"
  );
  assertWelcomeStepProgress(3, 4);
  assertNoRemovedWelcomePages();

  await clickWelcomePrimaryButton("zen-generic-next");
  await waitForWelcomeSidebarTitle(
    "zen-welcome-import-title",
    "Import / Default Browser must follow Search Engine directly"
  );
  ok(
    document.querySelector(".zen-welcome-toggle-list"),
    "Import page should render import/default toggles"
  );
  Assert.equal(
    document.querySelectorAll(
      '[data-l10n-id="zen-import-chrome"], [data-l10n-id="zen-import-default"]'
    ).length,
    2,
    "Import page should expose import and default-browser toggles"
  );
  assertWelcomeStepProgress(4, 4);
  assertNoRemovedWelcomePages();

  // Leave import/default toggles off (defaults) and advance to Finish.
  await clickWelcomePrimaryButton("zen-welcome-skip");
  await waitForWelcomeElement(
    () => document.getElementById("zen-welcome-finish"),
    "Finish screen should remain reachable after Import"
  );
  ok(
    document.getElementById("zen-welcome-finish-btn") ||
      document.querySelector(
        '#zen-welcome-finish button[data-l10n-id="zen-welcome-finish-btn"]'
      ),
    "Finish screen should offer Start Browsing"
  );
  Assert.equal(
    document.querySelectorAll(
      '[data-l10n-id="zen-welcome-workspaces-title"], [data-l10n-id="zen-welcome-theme-title"], .zen-welcome-workspace-item, .zen-welcome-theme-swatch'
    ).length,
    0,
    "Finish path must never surface Workspaces or Theme onboarding UI"
  );

  const workspacesAfter = snapshotWorkspaces();
  const themeAfter = getThemeSchemePref();

  if (workspacesBefore.available && workspacesAfter.available) {
    Assert.deepEqual(
      workspacesAfter.uuids,
      workspacesBefore.uuids,
      "Onboarding must not create or remove workspaces"
    );
    Assert.deepEqual(
      workspacesAfter.names,
      workspacesBefore.names,
      "Onboarding must not rename existing workspaces"
    );
    Assert.equal(
      workspacesAfter.count,
      workspacesBefore.count,
      "Workspace count must be unchanged after simplified onboarding"
    );
  } else {
    info("gZenWorkspaces unavailable; skipped workspace state assertions");
  }

  Assert.equal(
    themeAfter,
    themeBefore,
    "Onboarding must not change zen.view.window.scheme"
  );

  info(
    "Simplified welcome flow verified: Intro + four numbered steps + Finish"
  );
});
