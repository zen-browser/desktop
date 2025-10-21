const DG_BACKGROUND = "/desktop/gnome/background";
const DG_IMAGE_KEY = DG_BACKGROUND + "/picture_filename";
const DG_OPTION_KEY = DG_BACKGROUND + "/picture_options";
const DG_DRAW_BG_KEY = DG_BACKGROUND + "/draw_background";

const GS_BG_SCHEMA = "org.gnome.desktop.background";
const GS_IMAGE_KEY = "picture-uri";
const GS_OPTION_KEY = "picture-options";
const GS_DRAW_BG_KEY = "draw-background";

add_task(async function () {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: "about:logo",
    },
    () => {
      var brandName = Services.strings
        .createBundle("chrome://branding/locale/brand.properties")
        .GetStringFromName("brandShortName");

      var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(
        Ci.nsIDirectoryServiceProvider
      );
      var homeDir = dirSvc.getFile("Home", {});

      var wpFile = homeDir.clone();
      wpFile.append(brandName + "_wallpaper.png");

      // Backup the existing wallpaper so that this test doesn't change the user's
      // settings.
      var wpFileBackup = homeDir.clone();
      wpFileBackup.append(brandName + "_wallpaper.png.backup");

      if (wpFileBackup.exists()) {
        wpFileBackup.remove(false);
      }

      if (wpFile.exists()) {
        wpFile.copyTo(null, wpFileBackup.leafName);
      }

      var shell = Cc["@mozilla.org/browser/shell-service;1"]
        .getService(Ci.nsIShellService)
        .QueryInterface(Ci.nsIGNOMEShellService);

      // For simplicity, we're going to reach in and access the image on the
      // page directly, which means the page shouldn't be running in a remote
      // browser. Thankfully, about:logo runs in the parent process for now.
      Assert.ok(
        !gBrowser.selectedBrowser.isRemoteBrowser,
        "image can be accessed synchronously from the parent process"
      );

      var image = content.document.images[0];

      let checkWallpaper, restoreSettings;
      try {
        const prevImage = shell.getGSettingsString(GS_BG_SCHEMA, GS_IMAGE_KEY);
        const prevOption = shell.getGSettingsString(
          GS_BG_SCHEMA,
          GS_OPTION_KEY
        );

        checkWallpaper = function (position, expectedGSettingsPosition) {
          shell.setDesktopBackground(image, position, "");
          ok(wpFile.exists(), "Wallpaper was written to disk");
          is(
            shell.getGSettingsString(GS_BG_SCHEMA, GS_IMAGE_KEY),
            encodeURI("file://" + wpFile.path),
            "Wallpaper file GSettings key is correct"
          );
          is(
            shell.getGSettingsString(GS_BG_SCHEMA, GS_OPTION_KEY),
            expectedGSettingsPosition,
            "Wallpaper position GSettings key is correct"
          );
        };

        restoreSettings = function () {
          shell.setGSettingsString(GS_BG_SCHEMA, GS_IMAGE_KEY, prevImage);
          shell.setGSettingsString(GS_BG_SCHEMA, GS_OPTION_KEY, prevOption);
        };
      } catch (e) {}

      checkWallpaper(Ci.nsIShellService.BACKGROUND_TILE, "wallpaper");
      checkWallpaper(Ci.nsIShellService.BACKGROUND_STRETCH, "stretched");
      checkWallpaper(Ci.nsIShellService.BACKGROUND_CENTER, "centered");
      checkWallpaper(Ci.nsIShellService.BACKGROUND_FILL, "zoom");
      checkWallpaper(Ci.nsIShellService.BACKGROUND_FIT, "scaled");
      checkWallpaper(Ci.nsIShellService.BACKGROUND_SPAN, "spanned");

      restoreSettings();

      // Restore files
      if (wpFileBackup.exists()) {
        wpFileBackup.moveTo(null, wpFile.leafName);
      }
    }
  );
});
