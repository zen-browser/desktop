const URL1 = "data:text/html;charset=utf-8,<body><p>Hello1</p></body>";
const URL2 = "data:text/html;charset=utf-8,<body><p>Hello2</p></body>";

async function getBFCacheComboTelemetry(probeInParent) {
  let bfcacheCombo;
  await TestUtils.waitForCondition(() => {
    let histograms;
    if (probeInParent) {
      histograms = Services.telemetry.getSnapshotForHistograms(
        "main",
        false /* clear */
      ).parent;
    } else {
      histograms = Services.telemetry.getSnapshotForHistograms(
        "main",
        false /* clear */
      ).content;
    }
    bfcacheCombo = histograms.BFCACHE_COMBO;
    return bfcacheCombo;
  });
  return bfcacheCombo;
}

async function test_bfcache_telemetry(probeInParent) {
  Services.telemetry.getHistogramById("BFCACHE_COMBO").clear();

  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, URL1);

  BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, URL2);
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);

  let bfcacheCombo = await getBFCacheComboTelemetry(probeInParent);

  is(bfcacheCombo.values[0], 1, "1 bfcache success");

  gBrowser.removeTab(tab);
}

add_task(async () => {
  await test_bfcache_telemetry(
    Services.prefs.getBoolPref("fission.bfcacheInParent")
  );
});
