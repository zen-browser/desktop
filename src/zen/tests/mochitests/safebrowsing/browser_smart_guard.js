/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_smart_guard_disabled_by_default() {
  Services.prefs.clearUserPref("zen.smart.enabled");
  Services.prefs.clearUserPref("zen.smart.notify.enabled");
  Services.prefs.clearUserPref("zen.smart.downloads.enabled");
  Services.prefs.clearUserPref("zen.smart.screen.enabled");
  Services.prefs.clearUserPref("zen.smart.clipboard.enabled");

  ok(window.gZenSmartGuard, "SMART guard controller should be initialized.");
  ok(!window.gZenSmartGuard.enabled, "SMART guard should be disabled by default.");

  window.gZenSmartGuard.guardedCopyToClipboard("plain text", "test-disabled");
  const state = window.gZenSmartGuard.getLatestState();
  Assert.equal(
    state.suspiciousScore,
    0,
    "No suspicious score should be tracked while SMART is disabled."
  );

  const panel = window.gZenSiteDataPanel.unifiedPanel;
  const shown = BrowserTestUtils.waitForEvent(panel, "popupshown");
  panel.openPopup(window.gZenSiteDataPanel.anchor, "after_start", 0, 0, false, false);
  await shown;

  const smartRow = document.getElementById("zen-site-data-smartguard");
  ok(smartRow.hidden, "SMART row should remain hidden while feature is off.");

  const hidden = BrowserTestUtils.waitForEvent(panel, "popuphidden");
  panel.hidePopup();
  await hidden;
});

add_task(async function test_smart_guard_clipboard_signal_and_panel_status() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.smart.enabled", true],
      ["zen.smart.notify.enabled", false],
      ["zen.smart.downloads.enabled", true],
      ["zen.smart.screen.enabled", true],
      ["zen.smart.clipboard.enabled", true],
    ],
  });

  const selectedTab = gBrowser.selectedTab;
  const previousSharingState = selectedTab._sharingState;
  selectedTab._sharingState = {
    ...(previousSharingState || {}),
    webRTC: {
      ...(previousSharingState?.webRTC || {}),
      screen: true,
      microphone: true,
    },
  };
  registerCleanupFunction(() => {
    selectedTab._sharingState = previousSharingState;
  });

  window.gZenSmartGuard.refreshScreenAssessment();
  window.gZenSmartGuard.guardedCopyToClipboard(
    "test_sensitive_token_1234567890abcdefghijklmnopqrstuvwxyz",
    "test-enabled"
  );
  const status = window.gZenSmartGuard.getPanelStatus();
  ok(
    status.level === "high" || status.level === "medium",
    "SMART status should report warning/high risk after suspicious signals."
  );
  ok(status.reason.length > 0, "SMART status should include a reason string.");

  const panel = window.gZenSiteDataPanel.unifiedPanel;
  const shown = BrowserTestUtils.waitForEvent(panel, "popupshown");
  panel.openPopup(window.gZenSiteDataPanel.anchor, "after_start", 0, 0, false, false);
  await shown;

  const smartRow = document.getElementById("zen-site-data-smartguard");
  const stateLabel = document.getElementById("zen-site-data-smartguard-state");
  const reasonLabel = document.getElementById("zen-site-data-smartguard-reason");
  ok(!smartRow.hidden, "SMART row should be visible when feature is enabled.");
  ok(
    ["zen-smart-status-high", "zen-smart-status-medium", "zen-smart-status-low"].includes(
      stateLabel.getAttribute("data-l10n-id")
    ),
    "SMART row should expose a non-safe state label."
  );
  ok(reasonLabel.textContent.length > 0, "SMART row should show a reason.");

  const hidden = BrowserTestUtils.waitForEvent(panel, "popuphidden");
  panel.hidePopup();
  await hidden;

  await SpecialPowers.popPrefEnv();
});
