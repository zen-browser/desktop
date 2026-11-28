/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_containers() {
  const { ContextualIdentityService } = ChromeUtils.importESModule(
    "moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs"
  );
  await SpecialPowers.pushPrefEnv({
    set: [["privacy.userContext.enabled", true]],
  });
  const created = ContextualIdentityService.create(
    "Zen Settings Test",
    "fingerprint",
    "blue"
  );
  registerCleanupFunction(() =>
    ContextualIdentityService.remove(created.userContextId)
  );
  const ids = () =>
    ContextualIdentityService.getPublicIdentities().map(i => i.userContextId);

  const win = await openSettingsWindow(() => ZenSettings.open("containers"));
  const doc = win.document;
  const list = doc.getElementById("zen-settings-containers-list");
  const shownIds = () => [...list.children].map(r => Number(r.dataset.id));
  Assert.deepEqual(shownIds(), ids(), "Every container has a row, in order");

  const row = () => list.querySelector(`[data-id="${created.userContextId}"]`);
  const nameOf = el => el.querySelector(".zen-settings-row-text").textContent;
  is(nameOf(row()), "Zen Settings Test", "A container is shown by name");
  is(ids().at(-1), created.userContextId, "A new container is the last one");

  row().focus();
  EventUtils.synthesizeKey("KEY_ArrowUp", { altKey: true }, win);
  is(
    ids().at(-2),
    created.userContextId,
    "Alt+Up moves the container up by one"
  );
  Assert.deepEqual(shownIds(), ids(), "The list follows the new order");
  is(doc.activeElement, row(), "The moved container keeps the focus");
  EventUtils.synthesizeKey("KEY_ArrowDown", { altKey: true }, win);
  is(ids().at(-1), created.userContextId, "Alt+Down moves it back down");

  ContextualIdentityService.update(
    created.userContextId,
    "Zen Settings Renamed",
    "fingerprint",
    "red"
  );
  is(nameOf(row()), "Zen Settings Renamed", "The list follows a rename");

  const kDialogURL =
    "chrome://browser/content/preferences/dialogs/containers.xhtml";
  const stack = doc.getElementById("zen-settings-dialog-stack");
  const dialogFrame = () => stack.querySelector("browser.dialogFrame");
  const withContainerDialog = async (trigger, callback) => {
    trigger.click();
    const name = await TestUtils.waitForCondition(() => {
      const dialogDoc = dialogFrame()?.contentDocument;
      return dialogDoc?.documentURI == kDialogURL
        ? dialogDoc.querySelector('moz-input-text[name="name"]')
        : null;
    }, "The container form is rendered");
    await name.updateComplete;
    ok(!stack.hidden, "The dialog is shown inside the settings window");
    await callback(dialogFrame().contentWindow, name);
    await TestUtils.waitForCondition(
      () => stack.hidden,
      "The dialog goes away when it is done"
    );
  };
  const typeName = async (name, value) => {
    const { Event } = name.ownerDocument.defaultView;
    name.inputEl.value = value;
    name.inputEl.dispatchEvent(
      new Event("input", { bubbles: true, composed: true })
    );
    await name.updateComplete;
  };

  await withContainerDialog(
    row().querySelector(".zen-settings-icon-button"),
    async (dialogWin, name) => {
      const dialog = dialogWin.document.querySelector("dialog");
      is(name.value, "Zen Settings Renamed", "Editing starts from the name");
      await typeName(name, "Zen Settings Edited");
      ok(!dialog.getButton("accept").disabled, "A named container is valid");
      dialog.acceptDialog();
    }
  );
  is(
    ContextualIdentityService.getPublicIdentityFromId(created.userContextId)
      .name,
    "Zen Settings Edited",
    "Accepting the dialog saves the container"
  );
  is(nameOf(row()), "Zen Settings Edited", "The list shows the edit");

  const countBefore = ids().length;
  await withContainerDialog(
    doc.querySelector('[data-action="containers-add"]'),
    (dialogWin, name) => {
      const dialog = dialogWin.document.querySelector("dialog");
      is(name.value, "", "A new container starts without a name");
      ok(dialog.getButton("accept").disabled, "And can't be saved yet");
      dialog.cancelDialog();
    }
  );
  is(ids().length, countBefore, "Cancelling doesn't create a container");

  await withContainerDialog(
    doc.querySelector('[data-action="containers-add"]'),
    async (dialogWin, name) => {
      await typeName(name, "Zen Settings Added");
      dialogWin.document.querySelector("dialog").acceptDialog();
    }
  );
  is(ids().length, countBefore + 1, "Accepting a new container creates it");
  const added = ContextualIdentityService.getPublicIdentities().at(-1);
  is(added.name, "Zen Settings Added", "With the name that was typed");
  is(nameOf(list.lastElementChild), "Zen Settings Added", "And it is listed");
  ContextualIdentityService.remove(added.userContextId);

  row().querySelector(".zen-settings-row-remove").click();
  await TestUtils.waitForCondition(
    () => !ids().includes(created.userContextId),
    "Removing a container without tabs removes it right away"
  );
  ok(!row(), "Its row is gone");

  Services.prefs.setBoolPref("privacy.userContext.enabled", false);
  ok(
    doc.querySelector('.zen-settings-category[data-pane="containers"]').hidden,
    "The pane isn't offered when containers are turned off"
  );
  ok(isPaneShown(win, "general"), "And the window leaves the pane");

  await BrowserTestUtils.closeWindow(win);
  await SpecialPowers.popPrefEnv();
});
