/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { scanScreenshots, screenshotFile } = ChromeUtils.importESModule(
  "chrome://browser/content/zen-components/ZenScreenshotFiles.mjs",
  { global: "current" },
);

async function screenshotTestFolder() {
  const folder = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "zen-screenshots-test",
  );
  registerCleanupFunction(() => IOUtils.remove(folder, { recursive: true }));
  const directory = await IOUtils.getDirectory(folder);
  directory.normalize();
  return directory.path;
}

async function writeScreenshot(folder, name, age = 5000) {
  const path = PathUtils.join(folder, name);
  await IOUtils.writeUTF8(path, "test fixture; never decoded or launched");
  await IOUtils.setModificationTime(path, Date.now() - age);
  return path;
}

add_task(async function test_filter_sort_limit_and_removal() {
  const folder = await screenshotTestFolder();
  for (let index = 0; index < 12; index++) {
    await writeScreenshot(
      folder,
      `Screenshot ${index}.png`,
      5000 + index * 1000,
    );
  }
  await writeScreenshot(folder, "not-an-image.html");
  await writeScreenshot(folder, "image.png.exe");
  await writeScreenshot(folder, ".hidden.png");
  await writeScreenshot(folder, "active.png", 0);
  await IOUtils.writeUTF8(PathUtils.join(folder, "empty.png"), "");
  await IOUtils.makeDirectory(PathUtils.join(folder, "subdirectory.png"));
  await writeScreenshot(
    PathUtils.join(folder, "subdirectory.png"),
    "nested.png",
  );

  const files = await scanScreenshots(folder);
  Assert.equal(
    files.length,
    10,
    "Only the ten newest eligible files are shown",
  );
  Assert.equal(
    PathUtils.filename(files[0].path),
    "Screenshot 0.png",
    "Newest first",
  );
  Assert.equal(
    PathUtils.filename(files[9].path),
    "Screenshot 9.png",
    "Old files stay out of the panel",
  );
  await IOUtils.remove(files[0].path);
  Assert.throws(
    () => screenshotFile(folder, files[0].path),
    /./,
    "Deleted files cannot be dragged",
  );
  Assert.equal(
    (await scanScreenshots(folder))[0].path,
    files[1].path,
    "Deleted rows disappear",
  );
});

add_task(async function test_outside_paths_and_changed_files() {
  const folder = await screenshotTestFolder();
  const outside = await screenshotTestFolder();
  const outsidePath = await writeScreenshot(outside, "outside.png");
  Assert.throws(
    () => screenshotFile(folder, outsidePath),
    /./,
    "Sibling folders are out of scope",
  );
  const path = await writeScreenshot(folder, "safe.PNG");
  Assert.equal(
    screenshotFile(folder, path).path,
    path,
    "Mixed case image extension is accepted",
  );
  await IOUtils.setModificationTime(path, Date.now());
  Assert.throws(
    () => screenshotFile(folder, path),
    /./,
    "A file being rewritten cannot be dragged",
  );
  await IOUtils.remove(path);
  await IOUtils.makeDirectory(path);
  Assert.throws(
    () => screenshotFile(folder, path),
    /./,
    "Replacing an image with a directory is rejected",
  );
});

add_task(async function test_unavailable_and_cancelled_scan() {
  const folder = await screenshotTestFolder();
  await writeScreenshot(folder, "Screenshot.png");
  Assert.deepEqual(
    await scanScreenshots(folder, () => false),
    [],
    "Cancelled scans yield no files",
  );
  await Assert.rejects(
    scanScreenshots(PathUtils.join(folder, "missing")),
    /./,
    "Missing folders fail closed",
  );
  await Assert.rejects(
    scanScreenshots(PathUtils.join(folder, "Screenshot.png")),
    /./,
    "A regular file is not a watch folder",
  );
});
