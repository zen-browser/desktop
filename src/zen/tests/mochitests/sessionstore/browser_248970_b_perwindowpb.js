/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test (B) for Bug 248970 */
  waitForExplicitFinish();

  let windowsToClose = [];
  let file = Services.dirsvc.get("TmpD", Ci.nsIFile);
  let filePath = file.path;
  let fieldList = {
    "//input[@name='input']": Date.now().toString(16),
    "//input[@name='spaced 1']": Math.random().toString(),
    "//input[3]": "three",
    "//input[@type='checkbox']": true,
    "//input[@name='uncheck']": false,
    "//input[@type='radio'][1]": false,
    "//input[@type='radio'][2]": true,
    "//input[@type='radio'][3]": false,
    "//select": 2,
    "//select[@multiple]": [1, 3],
    "//textarea[1]": "",
    "//textarea[2]": "Some text... " + Math.random(),
    "//textarea[3]": "Some more text\n" + new Date(),
    "//input[@type='file']": filePath,
  };

  registerCleanupFunction(async function () {
    for (let win of windowsToClose) {
      await BrowserTestUtils.closeWindow(win);
    }
  });

  function checkNoThrow(aLambda) {
    try {
      return aLambda() || true;
    } catch (ex) {}
    return false;
  }

  function getElementByXPath(aTab, aQuery) {
    let doc = aTab.linkedBrowser.contentDocument;
    let xptype = doc.defaultView.XPathResult.FIRST_ORDERED_NODE_TYPE;
    return doc.evaluate(aQuery, doc, null, xptype, null).singleNodeValue;
  }

  function setFormValue(aTab, aQuery, aValue) {
    let node = getElementByXPath(aTab, aQuery);
    if (typeof aValue == "string") {
      node.value = aValue;
    } else if (typeof aValue == "boolean") {
      node.checked = aValue;
    } else if (typeof aValue == "number") {
      node.selectedIndex = aValue;
    } else {
      Array.prototype.forEach.call(
        node.options,
        (aOpt, aIx) => (aOpt.selected = aValue.indexOf(aIx) > -1)
      );
    }
  }

  function compareFormValue(aTab, aQuery, aValue) {
    let node = getElementByXPath(aTab, aQuery);
    if (!node) {
      return false;
    }
    if (ChromeUtils.getClassName(node) === "HTMLInputElement") {
      return (
        aValue ==
        (node.type == "checkbox" || node.type == "radio"
          ? node.checked
          : node.value)
      );
    }
    if (ChromeUtils.getClassName(node) === "HTMLTextAreaElement") {
      return aValue == node.value;
    }
    if (!node.multiple) {
      return aValue == node.selectedIndex;
    }
    return Array.prototype.every.call(
      node.options,
      (aOpt, aIx) => aValue.indexOf(aIx) > -1 == aOpt.selected
    );
  }

  /**
   * Test (B) : Session data restoration between windows
   */

  let rootDir = getRootDirectory(gTestPath);
  const testURL = rootDir + "browser_248970_b_sample.html";
  const testURL2 =
    "http://mochi.test:8888/browser/" +
    "browser/components/sessionstore/test/browser_248970_b_sample.html";

  whenNewWindowLoaded({ private: false }, function (aWin) {
    windowsToClose.push(aWin);

    // get closed tab count
    let count = ss.getClosedTabCountForWindow(aWin);
    let max_tabs_undo = Services.prefs.getIntPref(
      "browser.sessionstore.max_tabs_undo"
    );
    ok(
      0 <= count && count <= max_tabs_undo,
      "getClosedTabCountForWindow should return zero or at most max_tabs_undo"
    );

    // setup a state for tab (A) so we can check later that is restored
    let value = "Value " + Math.random();
    let state = { entries: [{ url: testURL }], extData: { key: value } };

    // public session, add new tab: (A)
    let tab_A = BrowserTestUtils.addTab(aWin.gBrowser, testURL);
    ss.setTabState(tab_A, JSON.stringify(state));
    promiseBrowserLoaded(tab_A.linkedBrowser).then(() => {
      // make sure that the next closed tab will increase getClosedTabCountForWindow
      Services.prefs.setIntPref(
        "browser.sessionstore.max_tabs_undo",
        max_tabs_undo + 1
      );

      // populate tab_A with form data
      for (let i in fieldList) {
        setFormValue(tab_A, i, fieldList[i]);
      }

      // public session, close tab: (A)
      aWin.gBrowser.removeTab(tab_A);

      // verify that closedTabCount increased
      Assert.greater(
        ss.getClosedTabCountForWindow(aWin),
        count,
        "getClosedTabCountForWindow has increased after closing a tab"
      );

      // verify tab: (A), in undo list
      let tab_A_restored = checkNoThrow(() => ss.undoCloseTab(aWin, 0));
      ok(tab_A_restored, "a tab is in undo list");
      promiseTabRestored(tab_A_restored).then(() => {
        is(
          testURL,
          tab_A_restored.linkedBrowser.currentURI.spec,
          "it's the same tab that we expect"
        );
        aWin.gBrowser.removeTab(tab_A_restored);

        whenNewWindowLoaded({ private: true }, function (win) {
          windowsToClose.push(win);

          // setup a state for tab (B) so we can check that its duplicated
          // properly
          let key1 = "key1";
          let value1 = "Value " + Math.random();
          let state1 = {
            entries: [{ url: testURL2 }],
            extData: { key1: value1 },
          };

          let tab_B = BrowserTestUtils.addTab(win.gBrowser, testURL2);
          promiseTabState(tab_B, state1).then(() => {
            // populate tab: (B) with different form data
            for (let item in fieldList) {
              setFormValue(tab_B, item, fieldList[item]);
            }

            // duplicate tab: (B)
            let tab_C = win.gBrowser.duplicateTab(tab_B);
            promiseTabRestored(tab_C).then(() => {
              // verify the correctness of the duplicated tab
              is(
                ss.getCustomTabValue(tab_C, key1),
                value1,
                "tab successfully duplicated - correct state"
              );

              for (let item in fieldList) {
                ok(
                  compareFormValue(tab_C, item, fieldList[item]),
                  'The value for "' + item + '" was correctly duplicated'
                );
              }

              // private browsing session, close tab: (C) and (B)
              win.gBrowser.removeTab(tab_C);
              win.gBrowser.removeTab(tab_B);

              finish();
            });
          });
        });
      });
    });
  });
}
