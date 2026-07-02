"use strict";

add_task(async function () {
  const cwdScreenshotPath = PathUtils.join(
    Services.dirsvc.get("CurWorkD", Ci.nsIFile).path,
    "screenshot.png"
  );
  // Test other variations of the "window-size" argument.
  await testWindowSizePositive(800, 600);
  await testWindowSizePositive(1234);
  await testFileCreationNegative(
    [
      "-url",
      "http://mochi.test:8888/browser/browser/components/shell/test/headless.html",
      "-screenshot",
      "-window-size",
      "hello",
    ],
    cwdScreenshotPath
  );
  await testFileCreationNegative(
    [
      "-url",
      "http://mochi.test:8888/browser/browser/components/shell/test/headless.html",
      "-screenshot",
      "-window-size",
      "800,",
    ],
    cwdScreenshotPath
  );
});
