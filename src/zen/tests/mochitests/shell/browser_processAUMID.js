/* Any copyright is dedicated to the Public Domain.
 * https://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Bug 1950734 tracks how calling PinCurrentAppToTaskbarWin11
 * on MSIX may cause the process AUMID to be unnecessarily changed.
 * This test verifies that the behaviour will no longer happen
 */

ChromeUtils.defineESModuleGetters(this, {
  ShellService: "moz-src:///browser/components/shell/ShellService.sys.mjs",
});

add_task(async function test_processAUMID() {
  let processAUMID = ShellService.checkCurrentProcessAUMIDForTesting();

  // This function will trigger the relevant code paths that
  // incorrectly changes the process AUMID on MSIX, prior to
  // Bug 1950734 being fixed
  await ShellService.checkPinCurrentAppToTaskbarAsync(false);

  is(
    processAUMID,
    ShellService.checkCurrentProcessAUMIDForTesting(),
    "The process AUMID should not be changed"
  );
});
