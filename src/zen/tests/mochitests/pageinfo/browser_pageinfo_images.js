/* Check proper image url retrieval from all kinds of elements/styles */

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "https://example.com"
);

add_task(async function test_all_images_mentioned() {
  await BrowserTestUtils.withNewTab(
    TEST_PATH + "all_images.html",
    async function () {
      let pageInfo = BrowserCommands.pageInfo(
        gBrowser.selectedBrowser.currentURI.spec,
        "mediaTab"
      );
      await BrowserTestUtils.waitForEvent(pageInfo, "page-info-init");

      let imageTree = pageInfo.document.getElementById("imagetree");
      let imageRowsNum = imageTree.view.rowCount;

      ok(imageTree, "Image tree is null (media tab is broken)");

      Assert.equal(
        imageRowsNum,
        7,
        "Number of images listed: " + imageRowsNum + ", should be 7"
      );

      // Check that select all works
      imageTree.focus();
      ok(
        !pageInfo.document.getElementById("cmd_copy").hasAttribute("disabled"),
        "copy is enabled"
      );
      ok(
        !pageInfo.document
          .getElementById("cmd_selectAll")
          .hasAttribute("disabled"),
        "select all is enabled"
      );
      pageInfo.goDoCommand("cmd_selectAll");
      is(imageTree.view.selection.count, 7, "all rows selected");

      pageInfo.close();
    }
  );
});

add_task(async function test_view_image_info() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.menu.showViewImageInfo", true]],
  });

  await BrowserTestUtils.withNewTab(
    TEST_PATH + "all_images.html",

    async function (browser) {
      let contextMenu = document.getElementById("contentAreaContextMenu");
      let viewImageInfo = document.getElementById("context-viewimageinfo");

      let imageInfo = await SpecialPowers.spawn(browser, [], () => {
        let testImg = content.document.querySelector("img");
        return {
          src: testImg.src,
        };
      });

      await BrowserTestUtils.synthesizeMouseAtCenter(
        "img",
        { type: "contextmenu", button: 2 },
        browser
      );

      await BrowserTestUtils.waitForEvent(contextMenu, "popupshown");

      let promiseMediaLoad = BrowserTestUtils.domWindowOpened().then(win =>
        BrowserTestUtils.waitForEvent(win, "page-info-mediapreview-load")
      );

      contextMenu.activateItem(viewImageInfo);

      let pageInfo = (await promiseMediaLoad).target;
      let mediaBrowser = pageInfo.document.getElementById("mediaBrowser");

      let previewImageInfo = await SpecialPowers.spawn(mediaBrowser, [], () => {
        let img = content.document.querySelector("img");
        return {
          src: img.src,
        };
      });

      Assert.equal(
        previewImageInfo.src,
        imageInfo.src,
        "selected image is correct"
      );

      await BrowserTestUtils.closeWindow(pageInfo);
    }
  );
});

add_task(async function test_image_size() {
  await BrowserTestUtils.withNewTab(
    TEST_PATH + "all_images.html",
    async function () {
      let pageInfo = BrowserCommands.pageInfo(
        gBrowser.selectedBrowser.currentURI.spec,
        "mediaTab"
      );
      await BrowserTestUtils.waitForEvent(
        pageInfo,
        "page-info-mediapreview-load"
      );

      let imageSize = pageInfo.document.getElementById("imagesizetext");

      Assert.notEqual("media-unknown-not-cached", imageSize.value);

      pageInfo.close();
    }
  );
});
