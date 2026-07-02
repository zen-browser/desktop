/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_getSelectionPath_basic() {
  const doc = document.implementation.createHTMLDocument("TestDoc");

  const container = doc.createElement("div");
  container.id = "container";
  const child1 = doc.createElement("p");
  child1.className = "one";
  child1.textContent = "Text 1";
  const child2 = doc.createElement("span");
  child2.className = "two";
  child2.textContent = "Text 2";

  container.appendChild(child1);
  container.appendChild(child2);
  doc.body.appendChild(container);

  const component = new SelectorComponent(doc, null, [], () => {});

  for (let i = 0; i <= 7; i++) {
    const path = component.getSelectionPath(doc, i, child2);
    ok(
      path,
      `getSelectionPath should return a path for relatedValueIndex=${i}`
    );

    const selectedElements = doc.querySelectorAll(path);

    if (i === 0)
      ok(
        selectedElements.length === 1,
        "For relatedValueIndex=1 there should be exactly one queried element"
      );

    ok(
      selectedElements.length >= 1,
      "CSS path should select at least one element"
    );
  }
});
