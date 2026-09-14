const URL1 = "data:text/html;charset=utf-8,<body><p>Hello1</p></body>";
const URL2 = "data:text/html;charset=utf-8,<body><p>Hello2</p></body>";

async function getBFCacheComboValue(label) {
  await Services.fog.testFlushAllChildren();
  return Glean.bfcache.combo[label].testGetValue();
}

add_task(async () => {
  await Services.fog.testFlushAllChildren();
  Services.fog.testResetFOG();

  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, URL1);

  BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, URL2);
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);

  await TestUtils.waitForCondition(
    async () => (await getBFCacheComboValue("BFCache_Success")) !== null,
    "Waiting for bfcache.combo 'BFCache_Success' to be recorded"
  );

  is(await getBFCacheComboValue("BFCache_Success"), 1, "1 bfcache success");

  gBrowser.removeTab(tab);
});
