/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test checks that any images we load on startup are actually used,
 * so we don't waste IO and cycles loading images the user doesn't see.
 * It has a list of known problematic images that we aim to reduce to
 * empty.
 */

/* A list of images that are loaded at startup but not shown.
 * List items support the following attributes:
 *  - file: The location of the loaded image file.
 *  - hidpi: An alternative hidpi file location for retina screens, if one exists.
 *           May be the magic string <not loaded> in strange cases where
 *           only the low-resolution image is loaded but not shown.
 *  - platforms: An array of the platforms where the issue is occurring.
 *               Possible values are linux, win, macosx.
 *  - intermittentNotLoaded: an array of platforms where this image is
 *                           intermittently not loaded, e.g. because it is
 *                           loaded during the time we stop recording.
 *  - intermittentShown: An array of platforms where this image is
 *                       intermittently shown, even though the list implies
 *                       it might not be shown.
 *
 * PLEASE do not add items to this list.
 *
 * PLEASE DO remove items from this list.
 */
const knownUnshownImages = [
  {
    file: "chrome://global/skin/icons/arrow-left.svg",
    platforms: ["linux", "win", "macosx"],
  },

  {
    file: "chrome://browser/skin/toolbar-drag-indicator.svg",
    platforms: ["linux", "win", "macosx"],
  },

  {
    file: "chrome://global/skin/icons/chevron.svg",
    platforms: ["win", "linux", "macosx"],
    intermittentShown: ["win", "linux"],
  },

  {
    file: "chrome://global/skin/icons/highlights.svg",
    platforms: ["win", "linux", "macosx"],
    intermittentShown: ["win", "linux"],
  },
];

add_task(async function () {
  if (!AppConstants.DEBUG) {
    ok(false, "You need to run this test on a debug build.");
  }

  let startupRecorder =
    Cc["@mozilla.org/test/startuprecorder;1"].getService().wrappedJSObject;
  await startupRecorder.done;

  let data = Cu.cloneInto(startupRecorder.data.images, {});
  let knownImagesForPlatform = knownUnshownImages.filter(el => {
    return el.platforms.includes(AppConstants.platform);
  });

  {
    let results = await PerfTestHelpers.throttledMapPromises(
      knownImagesForPlatform,
      async image => ({
        uri: image.file,
        exists: await PerfTestHelpers.checkURIExists(image.file),
      })
    );
    for (let { uri, exists } of results) {
      ok(exists, `Unshown image entry ${uri} must exist`);
    }
  }

  let loadedImages = data["image-loading"];
  let shownImages = data["image-drawing"];

  for (let loaded of loadedImages.values()) {
    let knownImage = knownImagesForPlatform.find(el => {
      if (window.devicePixelRatio >= 2 && el.hidpi && el.hidpi == loaded) {
        return true;
      }
      return el.file == loaded;
    });
    if (knownImage) {
      if (
        !knownImage.intermittentShown ||
        !knownImage.intermittentShown.includes(AppConstants.platform)
      ) {
        todo(
          shownImages.has(loaded),
          `Image ${loaded} should not have been shown.`
        );
      }
      continue;
    }
    ok(
      shownImages.has(loaded),
      `Loaded image ${loaded} should have been shown.`
    );
  }

  // Check for known images that are no longer used.
  for (let item of knownImagesForPlatform) {
    if (
      !item.intermittentNotLoaded ||
      !item.intermittentNotLoaded.includes(AppConstants.platform)
    ) {
      if (window.devicePixelRatio >= 2 && item.hidpi) {
        if (item.hidpi != "<not loaded>") {
          ok(
            loadedImages.has(item.hidpi),
            `Image ${item.hidpi} should have been loaded.`
          );
        }
      } else {
        ok(
          loadedImages.has(item.file),
          `Image ${item.file} should have been loaded.`
        );
      }
    }
  }
});
