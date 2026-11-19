/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PREF = "zen.keyboard.shortcuts.override-page-shortcuts";
const TOAST_ID = "zen-shortcut-blocked-toast";
const KEY_ID = "zen-test-blocked-key";

let commandCount = 0;

function pageThatBlocks(eventType) {
  const script = `
    let blocked = 0;
    addEventListener("${eventType}", event => {
      if (event.key.toUpperCase() == "${UNUSED_KEY}" && event.shiftKey) {
        event.preventDefault();
        document.title = "blocked " + ++blocked;
      }
    });
  `;
  return (
    "data:text/html," +
    encodeURIComponent(`<title>blocked 0</title><script>${script}</script>`)
  );
}

function blockedToast() {
  return [...document.getElementById("zen-toast-container").children].find(
    toast => toast._messageId == TOAST_ID
  );
}

function removeToasts() {
  for (const toast of [
    ...document.getElementById("zen-toast-container").children,
  ]) {
    toast.remove();
  }
}

async function pressInPage(browser, expectedBlocked) {
  await SimpleTest.promiseFocus(browser);
  EventUtils.synthesizeKey(UNUSED_KEY, UNUSED_OPTIONS);
  await TestUtils.waitForCondition(
    () => browser.contentTitle == `blocked ${expectedBlocked}`,
    "The page blocked the press"
  );
}

add_setup(async function () {
  const keyset = document.createXULElement("keyset");
  keyset.id = "zen-test-blocked-keyset";
  const key = document.createXULElement("key");
  key.id = KEY_ID;
  key.setAttribute("key", UNUSED_KEY);
  key.setAttribute("modifiers", UNUSED_MODIFIERS);
  key.addEventListener("command", () => commandCount++);
  keyset.appendChild(key);
  document.body.append(keyset);
  registerCleanupFunction(() => {
    keyset.remove();
    removeToasts();
    Services.prefs.clearUserPref(PREF);
    ZenKeyboardShortcuts.setConflict(KEY_ID, "ask");
  });
});

/**
 * @param {string} value What the test key does when a page uses its keys.
 */
async function setConflict(value) {
  const key = document.getElementById(KEY_ID);
  ZenKeyboardShortcuts.setConflict(KEY_ID, value);
  is(
    key.getAttribute("zen-website-conflict") || "ask",
    value,
    `The key is set to ${value}`
  );
}

async function testRepeatRunsCommand(eventType) {
  commandCount = 0;
  removeToasts();
  await BrowserTestUtils.withNewTab(
    pageThatBlocks(eventType),
    async browser => {
      let notified = BrowserTestUtils.waitForEvent(
        window,
        "ZenShortcutBlocked"
      );
      await pressInPage(browser, 1);
      const event = await notified;
      is(event.target.id, KEY_ID, "The blocked key is told");
      await TestUtils.waitForCondition(blockedToast, "A toast says so");
      is(commandCount, 0, "The first press leaves the shortcut to the page");

      notified = BrowserTestUtils.waitForEvent(window, "ZenShortcutBlocked");
      await pressInPage(browser, 2);
      await notified;
      is(commandCount, 1, "The second press runs the shortcut");
      await TestUtils.waitForCondition(
        () => !blockedToast(),
        "The toast stops asking once the shortcut has run",
        100,
        10
      );

      notified = BrowserTestUtils.waitForEvent(window, "ZenShortcutBlocked");
      await pressInPage(browser, 3);
      await notified;
      is(commandCount, 1, "A third press starts over");
    }
  );
}

add_task(async function test_page_blocking_keydown() {
  await testRepeatRunsCommand("keydown");
});

add_task(async function test_page_blocking_keypress() {
  await testRepeatRunsCommand("keypress");
});

add_task(async function test_pref_off() {
  commandCount = 0;
  removeToasts();
  Services.prefs.setBoolPref(PREF, false);
  let notifiedCount = 0;
  const onBlocked = () => notifiedCount++;
  window.addEventListener("ZenShortcutBlocked", onBlocked);
  await BrowserTestUtils.withNewTab(
    pageThatBlocks("keydown"),
    async browser => {
      await pressInPage(browser, 1);
      await pressInPage(browser, 2);
    }
  );
  window.removeEventListener("ZenShortcutBlocked", onBlocked);
  Services.prefs.clearUserPref(PREF);
  is(notifiedCount, 0, "Nothing is told with the pref off");
  ok(!blockedToast(), "No toast is shown");
  is(commandCount, 0, "The page keeps the shortcut");
});

add_task(async function test_prefer_website() {
  commandCount = 0;
  removeToasts();
  await setConflict("website");
  let notifiedCount = 0;
  const onBlocked = () => notifiedCount++;
  window.addEventListener("ZenShortcutBlocked", onBlocked);
  await BrowserTestUtils.withNewTab(
    pageThatBlocks("keydown"),
    async browser => {
      await pressInPage(browser, 1);
      await pressInPage(browser, 2);
    }
  );
  window.removeEventListener("ZenShortcutBlocked", onBlocked);
  await setConflict("ask");
  is(notifiedCount, 0, "Nothing is told when the website is preferred");
  ok(!blockedToast(), "No toast is shown");
  is(commandCount, 0, "The page keeps the shortcut");
});

add_task(async function test_prefer_zen() {
  commandCount = 0;
  removeToasts();
  await setConflict("zen");
  let notifiedCount = 0;
  const onBlocked = () => notifiedCount++;
  window.addEventListener("ZenShortcutBlocked", onBlocked);
  await BrowserTestUtils.withNewTab(
    pageThatBlocks("keydown"),
    async browser => {
      await SimpleTest.promiseFocus(browser);
      EventUtils.synthesizeKey(UNUSED_KEY, UNUSED_OPTIONS);
      await TestUtils.waitForCondition(
        () => commandCount == 1,
        "The first press runs the shortcut"
      );
      const pageSaw = await SpecialPowers.spawn(browser, [], async () => {
        await new Promise(resolve => content.setTimeout(resolve, 100));
        return content.document.title;
      });
      is(pageSaw, "blocked 0", "The page never gets the key");
    }
  );
  window.removeEventListener("ZenShortcutBlocked", onBlocked);
  await setConflict("ask");
  is(notifiedCount, 0, "Nothing is asked when Zen is preferred");
  ok(!blockedToast(), "No toast is shown");
});

add_task(async function test_page_not_blocking() {
  commandCount = 0;
  removeToasts();
  await BrowserTestUtils.withNewTab("data:text/html,<body>", async browser => {
    await SimpleTest.promiseFocus(browser);
    EventUtils.synthesizeKey(UNUSED_KEY, UNUSED_OPTIONS);
    await TestUtils.waitForCondition(
      () => commandCount == 1,
      "The shortcut runs right away"
    );
  });
  ok(!blockedToast(), "No toast is shown");
});
