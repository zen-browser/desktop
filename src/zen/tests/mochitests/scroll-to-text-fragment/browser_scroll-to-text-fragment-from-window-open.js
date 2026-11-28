"use strict";

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      // Enable popup blocker
      ["dom.disable_open_during_load", true],
    ],
  });
});

/** Test for Bug 1901139 */

add_task(async function () {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: `http://mochi.test:8888/browser/browser/base/content/test/browser-scroll-to-text-fragment/dummy_page.html`,
    },
    async function (browser) {
      const url =
        "https://example.org/browser/browser/base/content/test/browser-scroll-to-text-fragment/scroll-to-text-fragment-from-browser-chrome-target.html#:~:text=This%20is%20the%20text%20fragment%20to%20scroll%20to";
      await SpecialPowers.spawn(browser, [url], aUrl => {
        let container = content.document.createElement("div");
        container.innerHTML = `<button id='button' onclick='window.open("${aUrl}", "_blank", "noopener");'>Click here</button>`;
        content.document.documentElement.appendChild(container);
      });

      let newTabPromise = BrowserTestUtils.waitForNewTab(gBrowser, null, true);
      info("Trigger click event and wait for new tab opened.");
      BrowserTestUtils.synthesizeMouseAtCenter("#button", {}, browser);
      let newTab = await newTabPromise;

      info("New tab is opened.");
      ok(
        await SpecialPowers.spawn(newTab.linkedBrowser, [], () => {
          let element = content.document.getElementById("target");
          let rect = element.getBoundingClientRect();
          return (
            rect.top >= 0 &&
            rect.top <= content.window.innerHeight &&
            rect.left >= 0 &&
            rect.left <= content.window.innerWidth
          );
        }),
        "check if new tab scrolled to right position"
      );

      info("Close opened new tab.");
      let tabClosedPromise = BrowserTestUtils.waitForTabClosing(newTab);
      await BrowserTestUtils.removeTab(newTab);
      await tabClosedPromise;
    }
  );
});
