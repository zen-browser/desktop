/* Check presence of the "Ignore this warning" button */

function checkWarningState() {
  return SpecialPowers.spawn(gBrowser.selectedBrowser, [], () => {
    return !!content.document.getElementById("ignore_warning_link");
  });
}

add_task(async function testMalware() {
  await new Promise(resolve => waitForDBInit(resolve));

  await BrowserTestUtils.openNewForegroundTab(gBrowser, "about:blank");

  const url = "http://www.itisatrap.org/firefox/its-an-attack.html";
  BrowserTestUtils.startLoadingURIString(gBrowser.selectedBrowser, url);
  await BrowserTestUtils.browserLoaded(
    gBrowser.selectedBrowser,
    false,
    url,
    true
  );

  let buttonPresent = await checkWarningState();
  ok(buttonPresent, "Ignore warning link should be present for malware");
});

add_task(async function testUnwanted() {
  Services.prefs.setBoolPref("browser.safebrowsing.allowOverride", false);

  // Now launch the unwanted software test
  const url = "http://www.itisatrap.org/firefox/unwanted.html";
  BrowserTestUtils.startLoadingURIString(gBrowser.selectedBrowser, url);
  await BrowserTestUtils.browserLoaded(
    gBrowser.selectedBrowser,
    false,
    url,
    true
  );

  // Confirm that "Ignore this warning" is visible - bug 422410
  let buttonPresent = await checkWarningState();
  ok(
    !buttonPresent,
    "Ignore warning link should be missing for unwanted software"
  );
});

add_task(async function testPhishing() {
  Services.prefs.setBoolPref("browser.safebrowsing.allowOverride", true);

  // Now launch the phishing test
  const url = "http://www.itisatrap.org/firefox/its-a-trap.html";
  BrowserTestUtils.startLoadingURIString(gBrowser.selectedBrowser, url);
  await BrowserTestUtils.browserLoaded(
    gBrowser.selectedBrowser,
    false,
    url,
    true
  );

  let buttonPresent = await checkWarningState();
  ok(buttonPresent, "Ignore warning link should be present for phishing");

  gBrowser.removeCurrentTab();
});
