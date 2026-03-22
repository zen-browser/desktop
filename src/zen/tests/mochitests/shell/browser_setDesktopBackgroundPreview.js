/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Check whether the preview image for setDesktopBackground is rendered
 * correctly, without stretching
 */

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["test.wait300msAfterTabSwitch", true]],
  });
});

add_task(async function () {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: "about:logo",
    },
    async () => {
      const dialogLoad = BrowserTestUtils.domWindowOpened(null, async win => {
        await BrowserTestUtils.waitForEvent(win, "load");
        Assert.equal(
          win.document.documentElement.getAttribute("windowtype"),
          "Shell:SetDesktopBackground",
          "Opened correct window"
        );
        return true;
      });

      const image = content.document.images[0];
      EventUtils.synthesizeMouseAtCenter(image, { type: "contextmenu" });

      const menu = document.getElementById("contentAreaContextMenu");
      await BrowserTestUtils.waitForPopupEvent(menu, "shown");
      const menuClosed = BrowserTestUtils.waitForPopupEvent(menu, "hidden");

      const menuItem = document.getElementById("context-setDesktopBackground");
      try {
        menu.activateItem(menuItem);
      } catch (ex) {
        ok(
          menuItem.hidden,
          "should only fail to activate when menu item is hidden"
        );
        ok(
          !ShellService.canSetDesktopBackground,
          "Should only hide when not able to set the desktop background"
        );
        is(
          AppConstants.platform,
          "linux",
          "Should always be able to set desktop background on non-linux platforms"
        );
        todo(false, "Skipping test on this configuration");

        menu.hidePopup();
        await menuClosed;
        return;
      }

      await menuClosed;

      const win = await dialogLoad;

      /* setDesktopBackground.js does a setTimeout to wait for correct
       dimensions. If we don't wait here we could read the preview dimensions
       before they're changed to match the screen */
      await TestUtils.waitForTick();

      const canvas = win.document.getElementById("screen");
      const screenRatio = screen.width / screen.height;
      const previewRatio = canvas.clientWidth / canvas.clientHeight;

      info(`Screen dimensions are ${screen.width}x${screen.height}`);
      info(`Screen's raw ratio is ${screenRatio}`);
      info(
        `Preview dimensions are ${canvas.clientWidth}x${canvas.clientHeight}`
      );
      info(`Preview's raw ratio is ${previewRatio}`);

      Assert.ok(
        previewRatio < screenRatio + 0.01 && previewRatio > screenRatio - 0.01,
        "Preview's aspect ratio is within ±.01 of screen's"
      );

      win.close();

      await menuClosed;
    }
  );
});
