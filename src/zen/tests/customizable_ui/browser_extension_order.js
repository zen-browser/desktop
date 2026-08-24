/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_WIDGET_IDS = [
  "zen-test-extension-one",
  "zen-test-extension-two",
  "zen-test-extension-three"
];

function createExtensionWidget(id) {
  CustomizableUI.createWidget({
    id,
    type: "custom",
    defaultArea: CustomizableUI.AREA_NAVBAR,
    onBuild(doc) {
      const button = doc.createXULElement("toolbarbutton");
      button.id = id;
      button.classList.add("toolbarbutton-1", "chromeclass-toolbar-additional");
      button.setAttribute("data-extensionid", `${id}@example.com`);
      return button;
    }
  });
}

function getDocumentOrder(ids) {
  return ids
    .map(id => document.getElementById(id))
    .sort((first, second) =>
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1
    )
    .map(button => button.id);
}

add_task(async function test_extension_order_in_single_toolbar() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.view.sidebar-expanded", true],
      ["zen.view.use-single-toolbar", false],
      ["zen.view.overflow-webext-toolbar", true]
    ]
  });

  for (const id of TEST_WIDGET_IDS) {
    createExtensionWidget(id);
  }

  try {
    Assert.deepEqual(
      CustomizableUI.getWidgetIdsInArea(CustomizableUI.AREA_NAVBAR).filter(id =>
        TEST_WIDGET_IDS.includes(id)
      ),
      TEST_WIDGET_IDS,
      "test extensions start in their customizable toolbar order"
    );

    Services.prefs.setBoolPref("zen.view.use-single-toolbar", true);

    await TestUtils.waitForCondition(
      () =>
        TEST_WIDGET_IDS.every(id => {
          const button = document.getElementById(id);
          return (
            button &&
            button.parentElement?.id !== "nav-bar-customization-target"
          );
        }),
      "test extensions move into the single toolbar"
    );

    Assert.deepEqual(
      getDocumentOrder(TEST_WIDGET_IDS),
      TEST_WIDGET_IDS,
      "single toolbar preserves the pinned extension order"
    );
  } finally {
    for (const id of TEST_WIDGET_IDS) {
      CustomizableUI.destroyWidget(id);
    }
    await SpecialPowers.popPrefEnv();
  }
});
