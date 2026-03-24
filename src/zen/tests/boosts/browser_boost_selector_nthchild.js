/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_getSelectionPath_nthchild() {
  const doc = document.implementation.createHTMLDocument("TestDoc");
  const childCount = 10;

  const container = doc.createElement("div");
  container.id = "container";

  for (let i = 0; i < childCount; i++) {
    const child = doc.createElement("p");
    child.className = "child";
    child.textContent = `Child ${i}`;
    container.appendChild(child);
  }

  doc.body.appendChild(container);

  const component = new SelectorComponent(doc, null, [], () => {});

  for (let i = 0; i < container.children.length; i++) {
    const currentNode = container.children[i];
    // Get exact element
    const path = component.getSelectionPath(doc, 0, currentNode);
    ok(path, "Path should be generated");

    const selectedElements = doc.querySelectorAll(path);

    ok(
      Array.from(selectedElements).includes(currentNode),
      "Selector must include the selected node"
    );

    Assert.equal(
      selectedElements.length,
      1,
      "Selector should uniquely identify the element"
    );
  }
});
