/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_ROOT_CHROME = getRootDirectory(gTestPath);
const TEST_DIALOG_PATH = TEST_ROOT_CHROME + "subdialog.xhtml";

const TEST_DATA_URI = "data:text/html,<body onload='alert(1)'>";
const TEST_EXTENSION_DATA = {
  background() {
    // eslint-disable-next-line no-undef
    browser.test.sendMessage("url", browser.runtime.getURL("alert.html"));
  },
  manifest: {
    name: "Test Extension",
  },
  files: {
    "alert.html": `<!DOCTYPE HTML>
<html>
  <head>
    <meta charset="utf-8">
    <title>TabDialogBox Content Modal Test page</title>
    <script src="./alert.js"></script>
  </head>
  <body>
    <h1>TabDialogBox Content Modal</h1>
  </body>
</html>`,
    "alert.js": `window.addEventListener("load", () => alert("Hi"));`,
  },
};
// eslint-disable-next-line sdl/no-insecure-url
const TEST_ORIGIN = "http://example.com";
const TEST_PAGE =
  TEST_ROOT_CHROME.replace("chrome://mochitests/content", TEST_ORIGIN) +
  "test_page.html";

var commonDialogsBundle = Services.strings.createBundle(
  "chrome://global/locale/commonDialogs.properties"
);

/**
 * Test that a manager for content prompts is added to tab dialog box.
 */
add_task(async function test_tabdialog_content_prompts() {
  await BrowserTestUtils.withNewTab(
    // eslint-disable-next-line sdl/no-insecure-url
    "http://example.com",
    async function (browser) {
      info("Open a tab prompt.");
      let dialogBox = gBrowser.getTabDialogBox(browser);
      dialogBox.open(TEST_DIALOG_PATH);

      info("Check the content prompt dialog is only created when needed.");
      let contentPromptDialog = document.querySelector(
        ".content-prompt-dialog"
      );
      ok(!contentPromptDialog, "Content prompt dialog should not be created.");

      info("Open a content prompt");
      dialogBox.open(TEST_DIALOG_PATH, {
        modalType: Ci.nsIPrompt.MODAL_TYPE_CONTENT,
      });

      contentPromptDialog = document.querySelector(".content-prompt-dialog");
      ok(contentPromptDialog, "Content prompt dialog should be created.");
      let contentPromptManager = dialogBox.getContentDialogManager();

      is(
        contentPromptManager._dialogs.length,
        1,
        "Content prompt manager should have 1 dialog box."
      );
    }
  );
});

/**
 * Test origin text for a null principal.
 */
add_task(async function test_tabdialog_null_principal_title() {
  let dialogShown = BrowserTestUtils.waitForEvent(
    gBrowser,
    "DOMWillOpenModalDialog"
  );

  await BrowserTestUtils.withNewTab(TEST_DATA_URI, async function (browser) {
    info("Waiting for dialog to open.");
    await dialogShown;
    await checkOriginText(browser);
  });
});

/**
 * Test origin text for an extension page.
 */
add_task(async function test_tabdialog_extension_title() {
  let extension = ExtensionTestUtils.loadExtension(TEST_EXTENSION_DATA);

  await extension.startup();
  let url = await extension.awaitMessage("url");
  let dialogShown = BrowserTestUtils.waitForEvent(
    gBrowser,
    "DOMWillOpenModalDialog"
  );

  await BrowserTestUtils.withNewTab(url, async function (browser) {
    info("Waiting for dialog to open.");
    await dialogShown;
    await checkOriginText(browser, "Test Extension");
  });

  await extension.unload();
});

/**
 * Test origin text for a regular page.
 */
add_task(async function test_tabdialog_page_title() {
  let dialogShown = BrowserTestUtils.waitForEvent(
    gBrowser,
    "DOMWillOpenModalDialog"
  );

  await BrowserTestUtils.withNewTab(TEST_PAGE, async function (browser) {
    info("Waiting for dialog to open.");
    await dialogShown;
    await checkOriginText(browser, TEST_ORIGIN);
  });
});

/**
 * Test that a content prompt uses content's preferred color scheme, even when
 * the browser theme's differs.
 */
add_task(async function test_tabdialog_color_scheme() {
  for (let contentIsDark of [true, false]) {
    await SpecialPowers.pushPrefEnv({
      set: [
        ["ui.systemUsesDarkTheme", contentIsDark ? 0 : 1],
        [
          "layout.css.prefers-color-scheme.content-override",
          contentIsDark ? 0 : 1,
        ],
      ],
    });

    // LookAndFeel updates are applied on a refresh driver tick.
    let chromeMql = matchMedia("(prefers-color-scheme: dark)");
    if (chromeMql.matches == contentIsDark) {
      await new Promise(resolve =>
        chromeMql.addEventListener("change", resolve, { once: true })
      );
    }

    let dialogShown = BrowserTestUtils.waitForEvent(
      gBrowser,
      "DOMWillOpenModalDialog"
    );

    await BrowserTestUtils.withNewTab(TEST_DATA_URI, async function (browser) {
      info("Waiting for dialog to open.");
      await dialogShown;

      let dialogBox = gBrowser.getTabDialogBox(browser);
      let dialog = dialogBox.getContentDialogManager()._dialogs[0];
      await dialog._dialogReady;

      is(
        chromeMql.matches,
        !contentIsDark,
        "Chrome uses the other color scheme."
      );
      is(
        dialog._frame.contentWindow.matchMedia("(prefers-color-scheme: dark)")
          .matches,
        contentIsDark,
        "Content prompt uses content's preferred color scheme."
      );
    });

    await SpecialPowers.popPrefEnv();
  }
});

/**
 * Test helper for checking the origin header of a dialog.
 *
 * @param {object} browser
 *        The browser the dialog was opened from.
 * @param {string | null}  origin
 *        The page origin that should be displayed in the header, if any.
 */
async function checkOriginText(browser, origin = null) {
  info("Check the title is visible.");
  let dialogBox = gBrowser.getTabDialogBox(browser);
  let contentPromptManager = dialogBox.getContentDialogManager();
  let dialog = contentPromptManager._dialogs[0];

  info("Waiting for dialog frame to be ready.");
  await dialog._dialogReady;

  let dialogDoc = dialog._frame.contentWindow.document;
  let titleSelector = "#titleText";
  let infoTitle = dialogDoc.querySelector(titleSelector);
  ok(BrowserTestUtils.isVisible(infoTitle), "Title text is visible");

  info("Check the displayed origin text is correct.");
  if (origin) {
    let host = origin;
    try {
      host = new URL(origin).host;
    } catch (ex) {
      /* will fail for the extension case. */
    }
    is(infoTitle.textContent, host, "Origin should be in header.");
  } else {
    is(
      infoTitle.dataset.l10nId,
      "common-dialog-title-null",
      "Null principal string should be in header."
    );
  }
}
