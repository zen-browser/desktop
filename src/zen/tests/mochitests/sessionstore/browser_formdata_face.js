/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test ensures that collecting form data for form-associated custom
 * elements works as expected.
 */
add_task(async function test_face_restore() {
  const URL = `data:text/html;charset=utf-8,<!DOCTYPE html>
    <h1>mozilla</h1>
    <script>
      restoredStates = {};
      customElements.define("c-e", class extends HTMLElement {
        static formAssociated = true;
        constructor() {
          super();
          this.internals = this.attachInternals();
        }
        formStateRestoreCallback(state, reason) {
          if (reason == "restore") {
            restoredStates[this.id] = state;
          }
        }
      });
    </script>
    <form>
      <c-e id="test1"></c-e>
      <c-e id="test2"></c-e>
      <c-e id="test3"></c-e>
      <c-e id="test4"></c-e>
      <c-e id="test5"></c-e>
      <c-e id="test6"></c-e>
    </form>`;

  // Load a tab with a FACE.
  let tab = (gBrowser.selectedTab = BrowserTestUtils.addTab(gBrowser, URL));
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Set the FACE state and value.
  await SpecialPowers.spawn(browser, ["c-e"], selector => {
    function formDataWith(...entries) {
      const formData = new content.FormData();
      for (let [key, value] of entries) {
        formData.append(key, value);
      }
      return formData;
    }
    const states = [
      "test state",
      new content.File(["state"], "state.txt"),
      formDataWith(["1", "state"], ["2", new content.Blob(["state_blob"])]),
      null,
      undefined,
      null,
    ];
    const values = [
      "test value",
      new content.File(["value"], "value.txt"),
      formDataWith(["1", "value"], ["2", new content.Blob(["value_blob"])]),
      "null state",
      "both value and state",
      null,
    ];

    [...content.document.querySelectorAll(selector)].forEach((node, i) => {
      node.internals.setFormValue(values[i], states[i]);
    });
  });

  // Close and restore the tab.
  await promiseRemoveTabAndSessionState(tab);

  {
    let [
      {
        state: { formdata },
      },
    ] = ss.getClosedTabDataForWindow(window);

    is(formdata.id.test1.value, "test value", "String value should be stored");
    is(formdata.id.test1.state, "test state", "String state should be stored");

    let storedFile = formdata.id.test2.value;
    is(storedFile.name, "value.txt", "File value name should be stored");
    is(await storedFile.text(), "value", "File value text should be stored");
    storedFile = formdata.id.test2.state;
    is(storedFile.name, "state.txt", "File state name should be stored");
    is(await storedFile.text(), "state", "File state text should be stored");

    let storedFormData = formdata.id.test3.value;
    is(
      storedFormData.get("1"),
      "value",
      "FormData value string should be stored"
    );
    is(
      await storedFormData.get("2").text(),
      "value_blob",
      "Form value blob should be stored"
    );
    storedFormData = formdata.id.test3.state;
    is(
      storedFormData.get("1"),
      "state",
      "FormData state string should be stored"
    );
    is(
      await storedFormData.get("2").text(),
      "state_blob",
      "Form state blob should be stored"
    );

    is(formdata.id.test4.state, null, "Null state stored");
    is(formdata.id.test4.value, "null state", "Value with null state stored");

    is(
      formdata.id.test5.value,
      "both value and state",
      "Undefined state should be set to value"
    );
    is(
      formdata.id.test5.state,
      "both value and state",
      "Undefined state should be set to value"
    );

    ok(
      !("test6" in formdata.id),
      "Completely null values should not be stored"
    );
  }

  tab = ss.undoCloseTab(window, 0);
  browser = tab.linkedBrowser;
  await promiseTabRestored(tab);

  // Check that the FACE state was restored.
  await SpecialPowers.spawn(browser, ["restoredStates"], async prop => {
    let restoredStates = content.wrappedJSObject[prop];
    is(restoredStates.test1, "test state", "String should be stored");

    let storedFile = restoredStates.test2;
    is(storedFile.name, "state.txt", "File name should be stored");
    is(await storedFile.text(), "state", "File text should be stored");

    const storedFormData = restoredStates.test3;
    is(storedFormData.get("1"), "state", "Form data string should be stored");
    is(
      await storedFormData.get("2").text(),
      "state_blob",
      "Form data blob should be stored"
    );

    ok(!("test4" in restoredStates), "Null values don't get restored");

    is(
      restoredStates.test5,
      "both value and state",
      "Undefined state should be set to value"
    );
  });

  // Cleanup.
  gBrowser.removeTab(tab);
});
