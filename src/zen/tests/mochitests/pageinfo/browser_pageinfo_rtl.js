async function testPageInfo() {
  await BrowserTestUtils.withNewTab("https://example.com", async function () {
    let pageInfo = BrowserCommands.pageInfo();
    await BrowserTestUtils.waitForEvent(pageInfo, "page-info-init");
    is(
      getComputedStyle(pageInfo.document.documentElement).direction,
      "rtl",
      "Should be RTL"
    );
    ok(true, "Didn't assert or crash");
    pageInfo.close();
  });
}

add_task(async function test_page_info_rtl() {
  await SpecialPowers.pushPrefEnv({ set: [["intl.l10n.pseudo", "bidi"]] });

  for (let useOverlayScrollbars of [0, 1]) {
    info("Testing with overlay scrollbars: " + useOverlayScrollbars);
    await SpecialPowers.pushPrefEnv({
      set: [["ui.useOverlayScrollbars", useOverlayScrollbars]],
    });
    await testPageInfo();
  }
});
