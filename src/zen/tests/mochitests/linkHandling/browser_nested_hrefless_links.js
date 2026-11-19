/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

add_task(async function test_inner_no_href_handling() {
  await BrowserTestUtils.withNewTab(
    "https://example.com/blank_404",
    async function (browser) {
      await SpecialPowers.spawn(browser, [], async function () {
        let outer = content.document.createElement("a");
        outer.href = "https://example.com/outer";

        const inner = content.document.createElement("a");
        inner.href = "https://example.com/inner";

        const button = content.document.createElement("a"); // deliberately NO href
        button.setAttribute("role", "button");

        const label = content.document.createElement("span");
        label.id = "clickme";
        label.textContent = "View page";

        button.appendChild(label);
        inner.appendChild(button);
        outer.appendChild(inner);
        content.document.body.appendChild(outer);
      });
      let newTabPromise = BrowserTestUtils.waitForNewTab(gBrowser, null, true);
      await BrowserTestUtils.synthesizeMouseAtCenter(
        "#clickme",
        { accelKey: true },
        browser
      );
      let newTab = await newTabPromise;
      is(
        newTab.linkedBrowser.currentURI.spec,
        "https://example.com/inner",
        "Should have opened the inner link in a new tab"
      );
      gBrowser.removeTab(newTab);
    }
  );
});
