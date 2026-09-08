"use strict";

const URL =
  "http://mochi.test:8888/browser/browser/components/" +
  "sessionstore/test/browser_formdata_sample.html";

requestLongerTimeout(3);

/**
 * This test ensures that credit card numbers in form data will not be
 * collected, while numbers that don't look like credit card numbers will
 * still be collected.
 */
add_task(async function () {
  const validCCNumbers = [
    // 15 digits
    "930771457288760",
    "474915027480942",
    "924894781317325",
    "714816113937185",
    "790466087343106",
    "474320195408363",
    "219211148122351",
    "633038472250799",
    "354236732906484",
    "095347810189325",
    // 16 digits
    "3091269135815020",
    "5471839082338112",
    "0580828863575793",
    "5015290610002932",
    "9465714503078607",
    "4302068493801686",
    "2721398408985465",
    "6160334316984331",
    "8643619970075142",
    "0218246069710785",
  ];

  const invalidCCNumbers = [
    // 15 digits
    "526931005800649",
    "724952425140686",
    "379761391174135",
    "030551436468583",
    "947377014076746",
    "254848023655752",
    "226871580283345",
    "708025346034339",
    "917585839076788",
    "918632588027666",
    // 16 digits
    "9946177098017064",
    "4081194386488872",
    "3095975979578034",
    "3662215692222536",
    "6723210018630429",
    "4411962856225025",
    "8276996369036686",
    "4449796938248871",
    "3350852696538147",
    "5011802870046957",
  ];

  // Creates a tab, loads a page with a form field, sets the value of the
  // field, and then removes the tab to trigger data collection.
  async function createAndRemoveTab(formValue) {
    // Create a new tab.
    let tab = BrowserTestUtils.addTab(gBrowser, URL);
    let browser = tab.linkedBrowser;
    await promiseBrowserLoaded(browser);

    // Set form value.
    await setInputValue(browser, formValue);

    // Remove the tab.
    await promiseRemoveTabAndSessionState(tab);
  }

  // Test that valid CC numbers are not collected.
  for (let number of validCCNumbers) {
    await createAndRemoveTab(number);
    let [{ state }] = ss.getClosedTabDataForWindow(window);
    ok(!("formdata" in state), "valid CC numbers are not collected");
  }

  // Test that non-CC numbers are still collected.
  for (let number of invalidCCNumbers) {
    await createAndRemoveTab(number);
    let [
      {
        state: { formdata },
      },
    ] = ss.getClosedTabDataForWindow(window);
    is(
      formdata.id.txt,
      number,
      "numbers that are not valid CC numbers are still collected"
    );
  }
});

function setInputValue(browser, formValue) {
  return SpecialPowers.spawn(browser, [formValue], async function (newValue) {
    content.document.getElementById("txt").setUserInput(newValue);
  });
}
