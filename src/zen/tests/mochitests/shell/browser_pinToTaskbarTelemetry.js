/* Any copyright is dedicated to the Public Domain.
 * https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  ShellService: "moz-src:///browser/components/shell/ShellService.sys.mjs",
});

const kStubPref = "browser.shell.taskbar.test.pinWinRtStubResult";

add_setup(function () {
  Services.fog.initializeFOG();

  registerCleanupFunction(() => {
    Services.prefs.clearUserPref(kStubPref);
  });
});

// Success outcomes: the WinRT stub returns Ok with no fallback, so the promise
// resolves to the matching PinResult.
add_task(async function successCases() {
  const cases = [
    ["success_pinned", Ci.nsIWindowsShellService.PINNED],
    ["success_rejected", Ci.nsIWindowsShellService.REJECTED],
    ["success_fire_and_forget", Ci.nsIWindowsShellService.UNKNOWN],
  ];

  for (let [stubValue, expected] of cases) {
    Services.prefs.setCharPref(kStubPref, stubValue);

    Assert.equal(undefined, Glean.taskbar.pinWinrt.testGetValue());

    let result = await ShellService.pinCurrentAppToTaskbar(false);
    Assert.equal(result, expected, `resolved PinResult for ${stubValue}`);

    let events = Glean.taskbar.pinWinrt.testGetValue();
    Assert.equal(events.length, 1, `one pin_winrt event for ${stubValue}`);
    Assert.equal(
      events[0].extra.result,
      stubValue,
      "result extra matches pref"
    );

    Services.fog.testResetFOG();
  }
});

// Error outcomes: telemetry is recorded before the COM fallback runs. The
// fallback's resolve/reject is environment-dependent, so only assert telemetry.
add_task(async function errorCases() {
  const errors = [
    "error_get_aumid",
    "error_set_aumid",
    "error_get_taskbar_manager",
    "error_schedule_request_pin",
    "error_request_pin",
  ];

  for (let stubValue of errors) {
    Services.prefs.setCharPref(kStubPref, stubValue);

    Assert.equal(undefined, Glean.taskbar.pinWinrt.testGetValue());

    try {
      await ShellService.pinCurrentAppToTaskbar(false);
    } catch (e) {
      // The COM fallback may reject; the pin_winrt telemetry is already recorded.
    }

    let events = Glean.taskbar.pinWinrt.testGetValue();
    Assert.equal(events.length, 1, `one pin_winrt event for ${stubValue}`);
    Assert.equal(
      events[0].extra.result,
      stubValue,
      "result extra matches pref"
    );

    Services.fog.testResetFOG();
  }
});
