"use strict";
add_task(async function () {
  const cwdScreenshotPath = PathUtils.join(
    Services.dirsvc.get("CurWorkD", Ci.nsIFile).path,
    "screenshot.png"
  );

  // Test variations of the "screenshot" argument when a file path
  // isn't specified.
  await testFileCreationPositive(
    [
      "-screenshot",
      "http://mochi.test:8888/browser/browser/components/shell/test/headless.html",
    ],
    cwdScreenshotPath
  );
  await testFileCreationPositive(
    [
      "http://mochi.test:8888/browser/browser/components/shell/test/headless.html",
      "-screenshot",
    ],
    cwdScreenshotPath
  );
  await testFileCreationPositive(
    [
      "--screenshot",
      "http://mochi.test:8888/browser/browser/components/shell/test/headless.html",
    ],
    cwdScreenshotPath
  );
  await testFileCreationPositive(
    [
      "http://mochi.test:8888/browser/browser/components/shell/test/headless.html",
      "--screenshot",
    ],
    cwdScreenshotPath
  );

  // Test with additional command options
  await testFileCreationPositive(
    [
      "--screenshot",
      "http://mochi.test:8888/browser/browser/components/shell/test/headless.html",
      "-attach-console",
    ],
    cwdScreenshotPath
  );
});
