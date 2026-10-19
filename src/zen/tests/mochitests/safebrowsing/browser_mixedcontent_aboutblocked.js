/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const SECURE_CONTAINER_URL =
  "https://example.com/browser/browser/components/safebrowsing/content/test/empty_file.html";

add_task(async function testNormalBrowsing() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.safebrowsing.only_top_level", false]],
  });

  await BrowserTestUtils.withNewTab(
    SECURE_CONTAINER_URL,
    async function (browser) {
      // Before we load the phish url, we have to make sure the hard-coded
      // black list has been added to the database.
      await new Promise(resolve => waitForDBInit(resolve));

      let promise = new Promise(resolve => {
        // Register listener before loading phish URL.
        let removeFunc = BrowserTestUtils.addContentEventListener(
          browser,
          "AboutBlockedLoaded",
          () => {
            removeFunc();
            resolve();
          },
          { wantUntrusted: true }
        );
      });

      await SpecialPowers.spawn(
        browser,
        [PHISH_URL],
        async function (aPhishUrl) {
          // Create an iframe which is going to load a phish url.
          let iframe = content.document.createElement("iframe");
          iframe.src = aPhishUrl;
          content.document.body.appendChild(iframe);
        }
      );

      await promise;
      ok(true, "about:blocked is successfully loaded!");
    }
  );
});
