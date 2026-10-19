"use strict";

add_task(async function () {
  // Test cross origin iframes work.
  await testGreen(
    "http://mochi.test:8888/browser/browser/components/shell/test/headless_cross_origin.html",
    screenshotPath
  );
});
