/* Any copyright is dedicated to the Public Domain.
 * https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  FileTestUtils: "resource://testing-common/FileTestUtils.sys.mjs",
  ShellService: "moz-src:///browser/components/shell/ShellService.sys.mjs",
  XPCOMUtils: "resource://gre/modules/XPCOMUtils.sys.mjs",
});

XPCOMUtils.defineLazyServiceGetters(this, {
  imgTools: ["@mozilla.org/image/tools;1", Ci.imgITools],
});

let gPngImage;
let gSvgImage;

add_setup(async function loadImages() {
  let pngFile = do_get_file("favicon-normal16.png");
  gPngImage = imgTools.decodeImageFromArrayBuffer(
    (await IOUtils.read(pngFile.path)).buffer,
    "image/png"
  );

  let svgFile = do_get_file("icon.svg");
  let svgUri = Services.io.newFileURI(svgFile);
  let svgChannel = Services.io.newChannelFromURI(
    svgUri,
    null,
    Services.scriptSecurityManager.getSystemPrincipal(),
    null,
    Ci.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_SEC_CONTEXT_IS_NULL,
    Ci.nsIContentPolicy.TYPE_IMAGE
  );
  gSvgImage = await ChromeUtils.fetchDecodedImage(svgUri, svgChannel);
});

/**
 * Ensures that the file is an ICO file with the correct dimensions.
 *
 * Currently, this doesn't actually check the file's image data, since that's
 * (a) difficult to do from JavaScript for raster files (especially given the
 * scaling) and (b) not easy in general for vector files without just rewriting
 * createWindowsIcon inline.
 *
 * @param {nsIFile} file - The file containing the image.
 */
async function verifyOutput(file) {
  let image = imgTools.decodeImageFromArrayBuffer(
    (await IOUtils.read(file.path)).buffer,
    "image/vnd.microsoft.icon"
  );

  ok(image, "Image decoded successfully from its native format");
  Assert.equal(image.width, 256, "Image is 256 pixels wide");
  Assert.equal(image.height, 256, "Image is 256 pixels tall");
}

add_task(async function test_iconDimensions_raster() {
  let tempFile = FileTestUtils.getTempFile();
  await ShellService.createWindowsIcon(tempFile, gPngImage);
  await verifyOutput(tempFile);
  await IOUtils.remove(tempFile.path);
});

add_task(async function test_iconDimensions_vector() {
  let tempFile = FileTestUtils.getTempFile();
  await ShellService.createWindowsIcon(tempFile, gSvgImage);
  await verifyOutput(tempFile);
  await IOUtils.remove(tempFile.path);
});
