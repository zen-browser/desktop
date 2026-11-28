ChromeUtils.defineESModuleGetters(this, {
  FileTestUtils: "resource://testing-common/FileTestUtils.sys.mjs",
  ShellService: "moz-src:///browser/components/shell/ShellService.sys.mjs",
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

const DG_BACKGROUND = "/desktop/gnome/background";
const DG_IMAGE_KEY = DG_BACKGROUND + "/picture_filename";
const DG_OPTION_KEY = DG_BACKGROUND + "/picture_options";
const DG_DRAW_BG_KEY = DG_BACKGROUND + "/draw_background";

const GS_BG_SCHEMA = "org.gnome.desktop.background";
const GS_IMAGE_KEY = "picture-uri";
const GS_OPTION_KEY = "picture-options";
const GS_DRAW_BG_KEY = "draw-background";

add_task(async function () {
  let sandbox = sinon.createSandbox();
  sandbox
    .stub(ShellService, "_getDesktopBackgroundFile")
    .resolves(FileTestUtils.getTempFile("wallpaper.png"));
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: getRootDirectory(gTestPath) + "large.png",
    },
    async () => {
      let wpFile = await ShellService._getDesktopBackgroundFile();

      // For simplicity, we're going to reach in and access the image on the
      // page directly, which means the page shouldn't be running in a remote
      // browser. Thankfully, chrome:// runs in the parent process for now.
      Assert.ok(
        !gBrowser.selectedBrowser.isRemoteBrowser,
        "image can be accessed synchronously from the parent process"
      );

      var image = content.document.images[0];

      let checkWallpaper, restoreSettings;
      try {
        const prevImage = ShellService.getGSettingsString(
          GS_BG_SCHEMA,
          GS_IMAGE_KEY
        );
        const prevOption = ShellService.getGSettingsString(
          GS_BG_SCHEMA,
          GS_OPTION_KEY
        );

        checkWallpaper = async function (position, expectedGSettingsPosition) {
          await ShellService.setDesktopBackground(
            image,
            image.naturalWidth,
            image.naturalHeight,
            position
          );
          ok(wpFile.exists(), "Wallpaper was written to disk");
          wpFile.remove(false);
          is(
            ShellService.getGSettingsString(GS_BG_SCHEMA, GS_IMAGE_KEY),
            encodeURI("file://" + wpFile.path),
            "Wallpaper file GSettings key is correct"
          );
          is(
            ShellService.getGSettingsString(GS_BG_SCHEMA, GS_OPTION_KEY),
            expectedGSettingsPosition,
            "Wallpaper position GSettings key is correct"
          );
        };

        restoreSettings = function () {
          ShellService.setGSettingsString(
            GS_BG_SCHEMA,
            GS_IMAGE_KEY,
            prevImage
          );
          ShellService.setGSettingsString(
            GS_BG_SCHEMA,
            GS_OPTION_KEY,
            prevOption
          );
        };
      } catch (e) {}

      await checkWallpaper(Ci.nsIShellService.BACKGROUND_TILE, "wallpaper");
      await checkWallpaper(Ci.nsIShellService.BACKGROUND_STRETCH, "stretched");
      await checkWallpaper(Ci.nsIShellService.BACKGROUND_CENTER, "centered");
      await checkWallpaper(Ci.nsIShellService.BACKGROUND_FILL, "zoom");
      await checkWallpaper(Ci.nsIShellService.BACKGROUND_FIT, "scaled");
      await checkWallpaper(Ci.nsIShellService.BACKGROUND_SPAN, "spanned");

      restoreSettings();
    }
  );

  sandbox.restore();
});
