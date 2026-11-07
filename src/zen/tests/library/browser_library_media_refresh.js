/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_media_refreshes_without_reconnecting() {
  ChromeUtils.importESModule(
    "moz-src:///zen/library/sections/ZenLibraryMediaSection.mjs",
    { global: "current" }
  );
  const root = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "zen-library-media-refresh"
  );
  const bytes = new Uint8Array([137, 80, 78, 71]);
  await IOUtils.write(PathUtils.join(root, "before.png"), bytes);
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.library.media.enabled", true],
      ["zen.library.media.folders", root],
    ],
  });
  const section = document.createElement("zen-library-media-section");
  document.documentElement.appendChild(section);
  try {
    await TestUtils.waitForCondition(
      () => !section.loading && section.items.length === 1,
      "the initial scan sees the first file"
    );
    await IOUtils.write(PathUtils.join(root, "after-reopen.png"), bytes);
    section.onLibraryOpening?.();
    await TestUtils.waitForCondition(
      () => !section.loading && section.items.length === 2,
      "reopening the library discovers a new file"
    );

    await IOUtils.write(PathUtils.join(root, "after-revisit.png"), bytes);
    section.onShown();
    await TestUtils.waitForCondition(
      () => !section.loading && section.items.length === 3,
      "revisiting the Media tab discovers another new file"
    );
    Assert.deepEqual(
      section.items.map(item => item.name).sort(),
      ["after-reopen.png", "after-revisit.png", "before.png"]
    );
    Assert.ok(section.isConnected, "refreshing does not need a new section");
  } finally {
    section.remove();
    await SpecialPowers.popPrefEnv();
    await IOUtils.remove(root, { recursive: true });
  }
});
