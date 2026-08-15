/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_getSelectionPath_invalidNode() {
  const doc = document.implementation.createHTMLDocument("TestInvalid");
  const component = new SelectorComponent(doc, null, [], () => {});

  // Null element
  Assert.equal(
    component.getSelectionPath(doc, 0, null),
    null,
    "Null element should return null"
  );

  // Body element
  Assert.equal(
    component.getSelectionPath(doc, 0, doc.body),
    null,
    "Body element should return null"
  );

  // Html element
  Assert.equal(
    component.getSelectionPath(doc, 0, doc.documentElement),
    null,
    "HTML element should return null"
  );
});
