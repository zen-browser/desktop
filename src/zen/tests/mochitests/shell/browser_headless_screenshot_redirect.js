"use strict";

add_task(async function () {
  // Test when the requested URL redirects
  await testFileCreationPositive(
    [
      "-url",
      "http://mochi.test:8888/browser/browser/components/shell/test/headless_redirect.html",
      "-screenshot",
      screenshotPath,
    ],
    screenshotPath
  );
});
