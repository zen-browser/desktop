/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const COPY_URL_TEST_URL = "https://example.com/astra/copy?q=full#fragment";

add_task(async function test_copy_url_button_command_attribute_and_single_activation() {
  await BrowserTestUtils.withNewTab(COPY_URL_TEST_URL, async () => {
    const button = document.getElementById("zen-copy-url-button");
    ok(button, "Copy URL button should exist");
    ok(
      button.closest("#page-action-buttons"),
      "Copy URL button must be inside #page-action-buttons"
    );
    Assert.equal(
      button.getAttribute("command"),
      "cmd_zenCopyCurrentURL",
      "Button must use command=cmd_zenCopyCurrentURL"
    );
    ok(
      !button.hasAttribute("disabled"),
      "Copy URL button should be enabled on https"
    );

    // No Copy URL-specific manual activation listeners on the button.
    Assert.equal(
      button.getAttribute("oncommand"),
      null,
      "Button must not use inline oncommand"
    );

    const command = document.getElementById("cmd_zenCopyCurrentURL");
    ok(command, "cmd_zenCopyCurrentURL must exist");
    ok(
      command.closest("#zenCommandSet"),
      "cmd_zenCopyCurrentURL must live under #zenCommandSet"
    );

    let actionCalls = 0;
    const original = gZenCommonActions.copyCurrentURLToClipboard;
    registerCleanupFunction(() => {
      gZenCommonActions.copyCurrentURLToClipboard = original;
    });
    gZenCommonActions.copyCurrentURLToClipboard = function (...args) {
      actionCalls += 1;
      return original.apply(this, args);
    };

    await SimpleTest.promiseClipboardChange(COPY_URL_TEST_URL, () => {
      EventUtils.synthesizeMouseAtCenter(button, {}, window);
    });

    Assert.equal(
      actionCalls,
      1,
      "One physical click must enter copyCurrentURLToClipboard exactly once"
    );
  });
});

add_task(async function test_copy_url_command_doCommand() {
  await BrowserTestUtils.withNewTab(COPY_URL_TEST_URL, async () => {
    const command = document.getElementById("cmd_zenCopyCurrentURL");
    await SimpleTest.promiseClipboardChange(COPY_URL_TEST_URL, () => {
      command.doCommand();
    });
  });
});

add_task(async function test_copy_url_as_markdown_command() {
  await BrowserTestUtils.withNewTab(COPY_URL_TEST_URL, async () => {
    const title = gBrowser.selectedTab.label;
    const expected = `[${title}](${COPY_URL_TEST_URL})`;
    const command = document.getElementById("cmd_zenCopyCurrentURLMarkdown");
    ok(command, "cmd_zenCopyCurrentURLMarkdown must exist");

    await SimpleTest.promiseClipboardChange(expected, () => {
      command.doCommand();
    });
  });
});
