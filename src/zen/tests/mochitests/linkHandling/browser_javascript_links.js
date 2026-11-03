/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content/",
  "https://example.com/"
);
const IFRAME_PATH = TEST_PATH + "file_javascript_links_subframe.html";

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.link.alternative_click.block_javascript", true],
      ["browser.tabs.opentabfor.middleclick", true],
      ["middlemouse.paste", false],
      ["middlemouse.contentLoadURL", false],
      ["general.autoScroll", false],
    ],
  });
});

add_task(async function () {
  await BrowserTestUtils.withNewTab(
    `data:text/html,<a href="javascript:alert(1);">click me`,
    async browser => {
      await BrowserTestUtils.synthesizeMouseAtCenter(
        "a",
        { button: 0, ctrlKey: true, metaKey: true },
        browser
      );
      is(
        gBrowser.tabs.length,
        2,
        "Accel+click on javascript: link shouldn't open a new tab"
      );

      await BrowserTestUtils.synthesizeMouseAtCenter(
        "a",
        { button: 1 },
        browser
      );
      is(
        gBrowser.tabs.length,
        2,
        "Middle click on javascript: link shouldn't open a new tab"
      );

      await BrowserTestUtils.synthesizeMouseAtCenter(
        "a",
        { button: 0, shiftKey: true },
        browser
      );
      // This is fragile and might miss the new window, but the test will fail
      // anyway when finishing with an extra window left behind.
      // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
      await new Promise(resolve => setTimeout(resolve, 200));
      is(
        BrowserWindowTracker.windowCount,
        1,
        "Shift+click on javascript: link shouldn't open a new window"
      );
    }
  );
});

add_task(async function iframe_link() {
  await BrowserTestUtils.withNewTab(
    `data:text/html,<iframe src="${IFRAME_PATH}"></iframe>`,
    async browser => {
      // ctrl/cmd-click the link in the subframe.
      await BrowserTestUtils.synthesizeMouseAtCenter(
        "a",
        { ctrlKey: true, metaKey: true },
        browser.browsingContext.children[0]
      );

      // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
      await new Promise(resolve => setTimeout(resolve, 200));
      is(
        gBrowser.tabs.length,
        2,
        "Click on javascript: link in iframe shouldn't open a new tab"
      );
    }
  );
});
