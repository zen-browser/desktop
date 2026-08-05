/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// A 1x1 transparent PNG, standing in for whatever the user imported.
const CUSTOM_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const BUNDLED_ICON = "chrome://browser/skin/zen-icons/selectable/star.svg";

function getIndicator(workspace) {
  return gZenWorkspaces.workspaceElement(workspace.uuid).indicator;
}

function getIndicatorIcon(workspace) {
  return getIndicator(workspace).querySelector(
    ".zen-current-workspace-indicator-icon"
  );
}

add_task(async function test_isImageIcon_classification() {
  Assert.ok(
    gZenEmojiPicker.isImageIcon(CUSTOM_ICON),
    "A custom image data URL is an image icon."
  );
  Assert.ok(
    gZenEmojiPicker.isImageIcon(BUNDLED_ICON),
    "A bundled SVG is an image icon."
  );
  Assert.ok(
    !gZenEmojiPicker.isImageIcon("🦊"),
    "An emoji is not an image icon."
  );
  Assert.ok(!gZenEmojiPicker.isImageIcon(""), "An empty icon is not an image.");
  Assert.ok(
    !gZenEmojiPicker.isImageIcon(undefined),
    "A missing icon is not an image."
  );
});

add_task(async function test_custom_icon_renders_as_image() {
  const workspace = gZenWorkspaces.getActiveWorkspace();
  const previousIcon = workspace.icon;

  workspace.icon = CUSTOM_ICON;
  gZenWorkspaces.updateWorkspaceIndicator(workspace, getIndicator(workspace));

  const indicatorIcon = getIndicatorIcon(workspace);
  const image = indicatorIcon.querySelector("img");
  Assert.ok(image, "The custom image is rendered as an image element.");
  Assert.strictEqual(image.src, CUSTOM_ICON, "The image points at the icon.");
  Assert.strictEqual(
    indicatorIcon.textContent,
    "",
    "No text is left behind next to the image."
  );
  Assert.ok(
    !indicatorIcon.hasAttribute("no-icon"),
    "The indicator is not marked as icon-less."
  );

  workspace.icon = previousIcon;
  gZenWorkspaces.updateWorkspaceIndicator(workspace, getIndicator(workspace));
});

add_task(async function test_emoji_icon_still_renders_as_text() {
  const workspace = gZenWorkspaces.getActiveWorkspace();
  const previousIcon = workspace.icon;

  workspace.icon = "🦊";
  gZenWorkspaces.updateWorkspaceIndicator(workspace, getIndicator(workspace));

  const indicatorIcon = getIndicatorIcon(workspace);
  Assert.strictEqual(
    indicatorIcon.textContent,
    "🦊",
    "The indicator still renders emojis as text."
  );
  Assert.strictEqual(
    indicatorIcon.querySelector("img"),
    null,
    "An emoji does not produce an image element."
  );

  workspace.icon = previousIcon;
  gZenWorkspaces.updateWorkspaceIndicator(workspace, getIndicator(workspace));
});

add_task(async function test_custom_icon_in_the_spaces_strip() {
  const workspace = gZenWorkspaces.getActiveWorkspace();
  const previousIcon = workspace.icon;

  // Two spaces are needed for the icon strip to be shown at all.
  await gZenWorkspaces.createAndSaveWorkspace("Custom Icon Space");
  const created = gZenWorkspaces
    .getWorkspaces()
    .find(space => space.name === "Custom Icon Space");

  created.icon = CUSTOM_ICON;
  await gZenWorkspaces.saveWorkspace(created);

  const icons = document.querySelector("zen-workspace-icons");
  const selector = `toolbarbutton[zen-workspace-id="${created.uuid}"]`;
  await BrowserTestUtils.waitForCondition(
    () => icons.querySelector(`${selector} img.zen-workspace-icon`),
    "The new space shows up in the icon strip with its custom image."
  );

  const button = icons.querySelector(selector);
  const image = button.querySelector("img.zen-workspace-icon");
  Assert.strictEqual(image.src, CUSTOM_ICON, "The image points at the icon.");
  Assert.strictEqual(
    button.querySelector("label.zen-workspace-icon"),
    null,
    "No text label is added alongside the image."
  );

  await gZenWorkspaces.removeWorkspace(created.uuid);
  workspace.icon = previousIcon;
});
