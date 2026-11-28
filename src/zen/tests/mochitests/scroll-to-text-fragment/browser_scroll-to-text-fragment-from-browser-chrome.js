/**
 * This test ensures that a page navigated to via the URL bar, containing a text fragment,
 * scrolls correctly to the specified text fragment. The test simulates user actions by
 * entering a URL in the URL bar and pressing Enter to navigate to a cross-origin URL.
 *
 * The steps are as follows:
 * 1. Open a new tab with "about:blank".
 * 2. Programmatically set the URL bar to a cross-origin URL containing a text fragment.
 * 3. Simulate a click in the URL bar to focus it.
 * 4. Simulate pressing the Enter key to navigate to the new URL.
 * 5. Wait for the cross-origin page to load completely.
 * 6. Verify that the page has scrolled to the specified text fragment.
 *
 * See Bug 1904773.
 */
add_task(async function test_scroll_to_text_fragment() {
  // Initial URL to open the tab with (about:blank)
  let initialUrl = "about:blank";

  // Define the cross-origin URL with the text fragment
  let crossOriginUrl = `https://example.org/browser/browser/base/content/test/browser-scroll-to-text-fragment/scroll-to-text-fragment-from-browser-chrome-target.html#:~:text=This%20is%20the%20text%20fragment%20to%20scroll%20to.`;

  await BrowserTestUtils.withNewTab(
    { gBrowser, url: initialUrl },
    async function (browser) {
      // Select the URL bar and set the new URL
      gURLBar.focus();
      gURLBar.value = crossOriginUrl;

      // Synthesize a click in the URL bar to place the cursor in it
      info("Synthesize a click in the URL bar...");
      await BrowserTestUtils.synthesizeMouseAtCenter(
        gURLBar.inputField,
        {},
        browser
      );

      // Synthesize pressing the Enter key to navigate to the cross-origin URL
      info("Synthesize pressing the Enter key...");
      EventUtils.synthesizeKey("VK_RETURN", {});

      // Wait for the cross-origin page to load completely
      info("Waiting for cross-origin page to load...");
      await BrowserTestUtils.browserLoaded(browser, false);
      info("Cross-origin page loaded.");

      // Verify that the page has scrolled
      let scrolled = await SpecialPowers.spawn(browser, [], () => {
        return content.window.scrollY > 0;
      });

      ok(scrolled, "Page has scrolled down from the top.");
    }
  );
});
