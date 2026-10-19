/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Covers code paths the basic/invalid/nthchild tests don't:
//  - getIdentification() running ids/classes through CSS.escape()
//  - the ancestor-disambiguation while-loop in traverse(), which only runs
//    when the exact path still matches more than one element.

add_task(async function test_getSelectionPath_escapesSpecialChars() {
  const doc = document.implementation.createHTMLDocument("TestEscape");

  const container = doc.createElement("div");
  // Characters that are invalid in a CSS selector unless escaped.
  container.id = "with.dot:and#hash";
  const target = doc.createElement("span");
  target.className = "foo:bar baz.qux";
  target.textContent = "target";
  container.appendChild(target);
  doc.body.appendChild(container);

  const component = new SelectorComponent(doc, null, [], () => {});

  const path = component.getSelectionPath(doc, 0, target);
  ok(path, "A path should be generated for an element with special chars");

  // The unescaped raw strings must not leak into the selector verbatim.
  ok(
    !path.includes("with.dot:and#hash"),
    "Raw unescaped id must not appear in the selector"
  );

  // The generated selector must be valid and resolve back to the target.
  let matched;
  try {
    matched = doc.querySelectorAll(path);
  } catch (e) {
    ok(false, `Generated selector should be parseable, got: ${e}`);
    return;
  }
  ok(
    Array.from(matched).includes(target),
    "Escaped selector must still match the original element"
  );
  Assert.equal(
    matched.length,
    1,
    "Selector should uniquely identify the element"
  );
});

add_task(async function test_getSelectionPath_disambiguatesAncestors() {
  const doc = document.implementation.createHTMLDocument("TestAncestors");

  // Two structurally identical subtrees. The leaf elements carry no id/class,
  // so disambiguation must climb ancestors until the path is unique. The two
  // wrappers differ only by id, forcing the ancestor-walk loop in traverse().
  const makeBranch = wrapperId => {
    const wrapper = doc.createElement("section");
    wrapper.id = wrapperId;
    const mid = doc.createElement("div");
    const leaf = doc.createElement("span");
    leaf.textContent = "leaf";
    mid.appendChild(leaf);
    wrapper.appendChild(mid);
    doc.body.appendChild(wrapper);
    return leaf;
  };

  const leafA = makeBranch("branch-a");
  const leafB = makeBranch("branch-b");

  const component = new SelectorComponent(doc, null, [], () => {});

  for (const [leaf, label] of [
    [leafA, "branch-a"],
    [leafB, "branch-b"],
  ]) {
    const path = component.getSelectionPath(doc, 0, leaf);
    ok(path, `Path generated for the leaf under ${label}`);

    const matched = doc.querySelectorAll(path);
    Assert.equal(
      matched.length,
      1,
      `Selector for the ${label} leaf must be unique despite an identical sibling subtree`
    );
    ok(
      matched[0] === leaf,
      `Selector must resolve to the correct ${label} leaf, not the other branch`
    );
  }
});
