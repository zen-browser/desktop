/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// This tests that session restore component does restore the right <select> option.
// Session store should not rely only on previous user's selectedIndex, it should
// check its value as well.

function test() {
  /** Tests selected options */
  requestLongerTimeout(2);
  waitForExplicitFinish();

  let testTabCount = 0;
  let formData = [
    // default case
    {},

    // new format
    // index doesn't match value (testing an option in between (two))
    { id: { select_id: { selectedIndex: 0, value: "val2" } } },
    // index doesn't match value (testing an invalid value)
    { id: { select_id: { selectedIndex: 4, value: "val8" } } },
    // index doesn't match value (testing an invalid index)
    { id: { select_id: { selectedIndex: 8, value: "val5" } } },
    // index and value match position zero
    { id: { select_id: { selectedIndex: 0, value: "val0" } }, xpath: {} },
    // index doesn't match value (testing the last option (seven))
    {
      id: {},
      xpath: {
        "/xhtml:html/xhtml:body/xhtml:select[@name='select_name']": {
          selectedIndex: 1,
          value: "val7",
        },
      },
    },
    // index and value match the default option "selectedIndex":3,"value":"val3"
    {
      xpath: {
        "/xhtml:html/xhtml:body/xhtml:select[@name='select_name']": {
          selectedIndex: 3,
          value: "val3",
        },
      },
    },
    // index matches default option however it doesn't match value
    { id: { select_id: { selectedIndex: 3, value: "val4" } } },
  ];

  let expectedValues = [
    null, // default value
    "val2",
    null, // default value (invalid value)
    "val5", // value is still valid (even it has an invalid index)
    "val0",
    "val7",
    null,
    "val4",
  ];
  let callback = function () {
    testTabCount--;
    if (testTabCount == 0) {
      finish();
    }
  };

  for (let i = 0; i < formData.length; i++) {
    testTabCount++;
    testTabRestoreData(formData[i], expectedValues[i], callback);
  }
}

function testTabRestoreData(aFormData, aExpectedValue, aCallback) {
  let testURL = getRootDirectory(gTestPath) + "browser_662743_sample.html";
  let tab = BrowserTestUtils.addTab(gBrowser, testURL);

  aFormData.url = testURL;
  let tabState = {
    entries: [{ url: testURL, triggeringPrincipal_base64 }],
    formdata: aFormData,
  };

  promiseBrowserLoaded(tab.linkedBrowser).then(() => {
    promiseTabState(tab, tabState)
      .then(() => {
        // Flush to make sure we have the latest form data.
        return TabStateFlusher.flush(tab.linkedBrowser);
      })
      .then(() => {
        let doc = tab.linkedBrowser.contentDocument;
        let select = doc.getElementById("select_id");
        let value = select.options[select.selectedIndex].value;
        let restoredTabState = JSON.parse(ss.getTabState(tab));

        // If aExpectedValue=null we don't expect any form data to be collected.
        if (!aExpectedValue) {
          ok(
            !restoredTabState.hasOwnProperty("formdata"),
            "no formdata collected"
          );
          gBrowser.removeTab(tab);
          aCallback();
          return;
        }

        // test select options values
        is(
          value,
          aExpectedValue,
          "Select Option by selectedIndex &/or value has been restored correctly"
        );

        let restoredFormData = restoredTabState.formdata;
        let selectIdFormData = restoredFormData.id.select_id;
        value = restoredFormData.id.select_id.value;

        // test format
        ok(
          "id" in restoredFormData || "xpath" in restoredFormData,
          "FormData format is valid"
        );
        // test format
        ok(
          "selectedIndex" in selectIdFormData && "value" in selectIdFormData,
          "select format is valid"
        );
        // test set collection values
        is(value, aExpectedValue, "Collection has been saved correctly");

        // clean up
        gBrowser.removeTab(tab);

        aCallback();
      });
  });
}
