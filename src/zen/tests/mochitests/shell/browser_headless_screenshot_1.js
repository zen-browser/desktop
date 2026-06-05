"use strict";

add_task(async function () {
  // Test all four basic variations of the "screenshot" argument
  // when a file path is specified.
  await testFileCreationPositive(
    [
      "-url",
      "http://mochi.test:8888/browser/browser/components/shell/test/headless.html",
      "-screenshot",
      screenshotPath,
    ],
    screenshotPath
  );
  await testFileCreationPositive(
    [
      "-url",
      "http://mochi.test:8888/browser/browser/components/shell/test/headless.html",
      `-screenshot=${screenshotPath}`,
    ],
    screenshotPath
  );
  await testFileCreationPositive(
    [
      "-url",
      "http://mochi.test:8888/browser/browser/components/shell/test/headless.html",
      "--screenshot",
      screenshotPath,
    ],
    screenshotPath
  );
  await testFileCreationPositive(
    [
      "-url",
      "http://mochi.test:8888/browser/browser/components/shell/test/headless.html",
      `--screenshot=${screenshotPath}`,
    ],
    screenshotPath
  );

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

  // Test with additional command options
  await testFileCreationPositive(
    [
      "-url",
      "http://mochi.test:8888/browser/browser/components/shell/test/headless.html",
      "-screenshot",
      screenshotPath,
      "-attach-console",
    ],
    screenshotPath
  );
  await testFileCreationPositive(
    [
      "-url",
      "http://mochi.test:8888/browser/browser/components/shell/test/headless.html",
      "-attach-console",
      "-screenshot",
      screenshotPath,
      "-headless",
    ],
    screenshotPath
  );
});
