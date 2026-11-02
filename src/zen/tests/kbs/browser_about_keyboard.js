/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_zen_keys_are_listed() {
  const l10n = new Localization(["browser/preferences/zen-preferences.ftl"]);
  const [layoutTitle, toggleLabel, tabsTitle, copyURLLabel] =
    await l10n.formatValues([
      { id: "zenCKSOption-group-zen-layout" },
      { id: "zen-compact-mode-shortcut-toggle" },
      { id: "zenCKSOption-group-zen-tabs" },
      { id: "zen-text-action-copy-url-shortcut" },
    ]);
  const expected = {
    layoutTitle,
    toggleLabel,
    tabsTitle,
    copyURLLabel,
    copyURLShortcut: ShortcutUtils.prettifyShortcut(
      document.getElementById("zen-copy-url")
    ),
    spacesTitle: document.getElementById("zen-spaces-menubar").label,
    toggleShortcut: ShortcutUtils.prettifyShortcut(
      document.getElementById("zen-compact-mode-toggle")
    ),
  };

  await BrowserTestUtils.withNewTab("about:keyboard", async browser => {
    await SpecialPowers.spawn(browser, [expected], async args => {
      const doc = content.document;
      if (!doc.getElementById("table").firstElementChild) {
        await ContentTaskUtils.waitForEvent(
          content,
          "CustomKeysUpdate",
          false,
          null,
          true
        );
      }

      const headings = [...doc.querySelectorAll("moz-card.category")].map(
        card => card.wrappedJSObject.heading
      );
      ok(headings.includes(args.layoutTitle), "Layout shortcuts are listed");
      ok(headings.includes(args.tabsTitle), "Tab shortcuts are listed");
      ok(headings.includes(args.spacesTitle), "Spaces menu is listed");
      Assert.deepEqual(
        headings.slice(0, 2),
        [args.spacesTitle, args.tabsTitle],
        "Zen's groups come first"
      );

      const toggle = doc.querySelector(
        '.key[data-id="zen-compact-mode-toggle"]'
      );
      ok(toggle, "Compact mode toggle is listed");
      is(toggle.dataset.label, args.toggleLabel, "Label is localized");
      is(
        toggle.closest("moz-card").wrappedJSObject.heading,
        args.layoutTitle,
        "Toggle sits in the layout category"
      );
      is(
        toggle.querySelector(".currentShortcut").wrappedJSObject.value,
        args.toggleShortcut,
        "Current shortcut is shown"
      );

      const switchKey = doc.querySelector(
        '.key[data-id="zen-workspace-switch-3"]'
      );
      ok(switchKey, "Space switch is listed");
      is(
        switchKey.closest("moz-card").wrappedJSObject.heading,
        args.spacesTitle,
        "Space switch joins the Spaces menu category"
      );
      ok(
        doc.querySelector('.key[data-id="zen-workspace-forward"]'),
        "Menu-referenced Zen key is picked up by Firefox"
      );
      ok(
        doc.querySelector('.key[data-id="zen-new-unsynced-window"]'),
        "New blank window is listed from the File menu"
      );

      const copyURL = doc.querySelector('.key[data-id="zen-copy-url"]');
      ok(copyURL, "Copy current URL is listed");
      is(copyURL.dataset.label, args.copyURLLabel, "Label is localized");
      is(
        copyURL.closest("moz-card").wrappedJSObject.heading,
        args.tabsTitle,
        "Copy current URL sits in the tabs category"
      );
      is(
        copyURL.querySelector(".currentShortcut").wrappedJSObject.value,
        args.copyURLShortcut,
        "Its current shortcut is shown"
      );
      ok(
        doc.querySelector('.key[data-id="zen-copy-url-markdown"]'),
        "Copy current URL as Markdown is listed too"
      );

      ok(
        !doc.querySelector('.key[data-id="key_addTabSplitView"]'),
        "Removed Firefox key is not listed"
      );
      const openFile = doc.querySelector('.key[data-id="openFileKb"]');
      ok(openFile, "Open file is listed");
      ok(
        !openFile.classList.contains("assigned"),
        "Open file is unassigned by default"
      );
      ok(
        !openFile.classList.contains("customized"),
        "Open file is not marked as customized"
      );
    });
  });
});

add_task(async function test_tab_keys_are_grouped() {
  const l10n = new Localization(["browser/preferences/zen-preferences.ftl"]);
  const [tabsTitle] = await l10n.formatValues([
    { id: "zenCKSOption-group-zen-tabs" },
  ]);

  await BrowserTestUtils.withNewTab("about:keyboard", async browser => {
    await SpecialPowers.spawn(browser, [tabsTitle], async title => {
      const doc = content.document;
      if (!doc.getElementById("table").firstElementChild) {
        await ContentTaskUtils.waitForEvent(
          content,
          "CustomKeysUpdate",
          false,
          null,
          true
        );
      }

      const cardOf = id =>
        doc.querySelector(`.key[data-id="${id}"]`)?.closest("moz-card");
      const tabsCard = cardOf("zen-tab-switcher-cycle");
      ok(tabsCard, "Cycling through tabs is listed");
      is(tabsCard.wrappedJSObject.heading, title, "in the Tabs category");
      for (const id of [
        "zen-tab-switcher-next",
        "zen-tab-switcher-previous",
        "key_selectTab1",
        "key_selectTab8",
        "key_selectLastTab",
      ]) {
        is(cardOf(id), tabsCard, `${id} is in the Tabs category`);
      }

      is(
        cardOf("goBackKb").getAttribute("data-l10n-id"),
        "customkeys-category-navigation-2",
        "Back stays in Navigation"
      );
    });
  });
});
