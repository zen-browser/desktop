"use strict";

/**
 * Ensures that <input>s that are/were type=password are not saved.
 */

addCoopTask("file_formdata_password.html", test_hasBeenTypePassword, HTTPSROOT);

addNonCoopTask(
  "file_formdata_password.html",
  test_hasBeenTypePassword,
  HTTPROOT
);
addNonCoopTask(
  "file_formdata_password.html",
  test_hasBeenTypePassword,
  HTTPSROOT
);

async function test_hasBeenTypePassword(aURL) {
  let tab = BrowserTestUtils.addTab(gBrowser, aURL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  await SpecialPowers.spawn(browser, [], async function fillFields() {
    let doc = content.document;

    doc.getElementById("TextValue").setUserInput("abc");

    doc.getElementById("TextValuePassword").setUserInput("def");
    doc.getElementById("TextValuePassword").type = "password";

    doc.getElementById("TextPasswordValue").type = "password";
    doc.getElementById("TextPasswordValue").setUserInput("ghi");

    doc.getElementById("PasswordValueText").setUserInput("jkl");
    doc.getElementById("PasswordValueText").type = "text";

    doc.getElementById("PasswordTextValue").type = "text";
    doc.getElementById("PasswordTextValue").setUserInput("mno");

    doc.getElementById("PasswordValue").setUserInput("pqr");
  });

  // Remove the tab.
  await promiseRemoveTabAndSessionState(tab);

  let [
    {
      state: { formdata },
    },
  ] = ss.getClosedTabDataForWindow(window);
  let expected = [
    ["TextValue", "abc"],
    ["TextValuePassword", undefined],
    ["TextPasswordValue", undefined],
    ["PasswordValueText", undefined],
    ["PasswordTextValue", undefined],
    ["PasswordValue", undefined],
  ];

  for (let [id, expectedValue] of expected) {
    is(
      formdata.id[id],
      expectedValue,
      `Value should be ${expectedValue} for ${id}`
    );
  }
}
