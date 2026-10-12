/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const URL = ROOT + "browser_formdata_xpath_sample.html";

/**
 * Bug 346337 - Generic form data restoration tests.
 */
add_setup(function () {
  // make sure we don't save form data at all (except for tab duplication)
  Services.prefs.setIntPref("browser.sessionstore.privacy_level", 2);

  registerCleanupFunction(() => {
    Services.prefs.clearUserPref("browser.sessionstore.privacy_level");
  });
});

const FILE1 = createFilePath("346337_test1.file");
const FILE2 = createFilePath("346337_test2.file");

const FIELDS = {
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
  "//input[@type='file'][1]": [FILE1],
  "//input[@type='file'][2]": [FILE1, FILE2],
};

add_task(async function test_form_data_restoration() {
  // Load page with some input fields.
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Fill in some values.
  for (let xpath of Object.keys(FIELDS)) {
    await setFormValue(browser, xpath);
  }

  // Duplicate the tab.
  let tab2 = gBrowser.duplicateTab(tab);
  let browser2 = tab2.linkedBrowser;
  await promiseTabRestored(tab2);

  // Check that all form values have been duplicated.
  for (let xpath of Object.keys(FIELDS)) {
    let expected = JSON.stringify(FIELDS[xpath]);
    let actual = JSON.stringify(await getFormValue(browser2, xpath));
    is(
      actual,
      expected,
      'The value for "' + xpath + '" was correctly restored'
    );
  }

  // Remove all tabs.
  await promiseRemoveTabAndSessionState(tab2);
  await promiseRemoveTabAndSessionState(tab);

  // Restore one of the tabs again.
  tab = ss.undoCloseTab(window, 0);
  browser = tab.linkedBrowser;
  await promiseTabRestored(tab);

  // Check that none of the form values have been restored due to the privacy
  // level settings.
  for (let xpath of Object.keys(FIELDS)) {
    let expected = FIELDS[xpath];
    if (expected) {
      let actual = await getFormValue(browser, xpath, expected);
      isnot(
        actual,
        expected,
        'The value for "' + xpath + '" was correctly discarded'
      );
    }
  }

  // Cleanup.
  BrowserTestUtils.removeTab(tab);
});

function getPropertyOfXPath(browserContext, path, propName) {
  return SpecialPowers.spawn(
    browserContext,
    [path, propName],
    (pathChild, propNameChild) => {
      let doc = content.document;
      let xptype = doc.defaultView.XPathResult.FIRST_ORDERED_NODE_TYPE;
      let node = doc.evaluate(
        pathChild,
        doc,
        null,
        xptype,
        null
      ).singleNodeValue;
      return node[propNameChild];
    }
  );
}

function setPropertyOfXPath(browserContext, path, propName, newValue) {
  return SpecialPowers.spawn(
    browserContext,
    [path, propName, newValue],
    (pathChild, propNameChild, newValueChild) => {
      let doc = content.document;
      let xptype = doc.defaultView.XPathResult.FIRST_ORDERED_NODE_TYPE;
      let node = doc.evaluate(
        pathChild,
        doc,
        null,
        xptype,
        null
      ).singleNodeValue;
      node[propNameChild] = newValueChild;

      let event = node.ownerDocument.createEvent("UIEvents");
      event.initUIEvent("input", true, true, node.documentGlobal, 0);
      node.dispatchEvent(event);
    }
  );
}

function execUsingXPath(browserContext, path, fnName, arg) {
  return SpecialPowers.spawn(
    browserContext,
    [path, fnName, arg],
    (pathChild, fnNameChild, argChild) => {
      let doc = content.document;
      let xptype = doc.defaultView.XPathResult.FIRST_ORDERED_NODE_TYPE;
      let node = doc.evaluate(
        pathChild,
        doc,
        null,
        xptype,
        null
      ).singleNodeValue;

      switch (fnNameChild) {
        case "getMultipleSelected":
          return Array.from(node.options, (opt, idx) => idx).filter(
            idx => node.options[idx].selected
          );
        case "setMultipleSelected":
          Array.prototype.forEach.call(
            node.options,
            (opt, idx) => (opt.selected = argChild.indexOf(idx) > -1)
          );
          break;
        case "getFileNameArray":
          return node.mozGetFileNameArray();
        case "setFileNameArray":
          node.mozSetFileNameArray(argChild, argChild.length);
          break;
      }

      let event = node.ownerDocument.createEvent("UIEvents");
      event.initUIEvent("input", true, true, node.documentGlobal, 0);
      node.dispatchEvent(event);
      return undefined;
    }
  );
}

function createFilePath(leaf) {
  let file = Services.dirsvc.get("TmpD", Ci.nsIFile);
  file.append(leaf);
  return file.path;
}

function isArrayOfNumbers(value) {
  return Array.isArray(value) && value.every(n => typeof n === "number");
}

function isArrayOfStrings(value) {
  return Array.isArray(value) && value.every(n => typeof n === "string");
}

function getFormValue(browser, xpath) {
  let value = FIELDS[xpath];

  if (typeof value == "string") {
    return getPropertyOfXPath(browser, xpath, "value");
  }

  if (typeof value == "boolean") {
    return getPropertyOfXPath(browser, xpath, "checked");
  }

  if (typeof value == "number") {
    return getPropertyOfXPath(browser, xpath, "selectedIndex");
  }

  if (isArrayOfNumbers(value)) {
    return execUsingXPath(browser, xpath, "getMultipleSelected");
  }

  if (isArrayOfStrings(value)) {
    return execUsingXPath(browser, xpath, "getFileNameArray");
  }

  throw new Error("unknown input type");
}

function setFormValue(browser, xpath) {
  let value = FIELDS[xpath];

  if (typeof value == "string") {
    return setPropertyOfXPath(browser, xpath, "value", value);
  }

  if (typeof value == "boolean") {
    return setPropertyOfXPath(browser, xpath, "checked", value);
  }

  if (typeof value == "number") {
    return setPropertyOfXPath(browser, xpath, "selectedIndex", value);
  }

  if (isArrayOfNumbers(value)) {
    return execUsingXPath(browser, xpath, "setMultipleSelected", value);
  }

  if (isArrayOfStrings(value)) {
    return execUsingXPath(browser, xpath, "setFileNameArray", value);
  }

  throw new Error("unknown input type");
}
