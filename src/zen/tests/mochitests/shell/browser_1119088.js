// Where we save the desktop background to (~/Pictures).
const NS_OSX_PICTURE_DOCUMENTS_DIR = "Pct";

// Paths used to run the CLI command (python script) that is used to
// 1) check the desktop background image matches what we set it to via
//    nsIShellService::setDesktopBackground() and
// 2) revert the desktop background image to the OS default

let kPythonPath = "/usr/bin/python";
if (AppConstants.isPlatformAndVersionAtLeast("macosx", 23.0)) {
  kPythonPath = "/usr/local/bin/python3";
}

const kDesktopCheckerScriptPath =
  "browser/browser/components/shell/test/mac_desktop_image.py";
const kDefaultBackgroundImage_10_14 =
  "/Library/Desktop Pictures/Solid Colors/Teal.png";
const kDefaultBackgroundImage_10_15 =
  "/System/Library/Desktop Pictures/Solid Colors/Teal.png";

ChromeUtils.defineESModuleGetters(this, {
  FileUtils: "resource://gre/modules/FileUtils.sys.mjs",
});

function getPythonExecutableFile() {
  let python = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  info(`Using python at location ${kPythonPath}`);
  python.initWithPath(kPythonPath);
  return python;
}

function createProcess() {
  return Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
}

// Use a CLI command to set the desktop background to |imagePath|. Returns the
// exit code of the CLI command which reflects whether or not the background
// image was successfully set. Returns 0 on success.
function setDesktopBackgroundCLI(imagePath) {
  let setBackgroundProcess = createProcess();
  setBackgroundProcess.init(getPythonExecutableFile());
  let args = [
    kDesktopCheckerScriptPath,
    "--verbose",
    "--set-background-image",
    imagePath,
  ];
  setBackgroundProcess.run(true, args, args.length);
  return setBackgroundProcess.exitValue;
}

// Check the desktop background is |imagePath| using a CLI command.
// Returns the exit code of the CLI command which reflects whether or not
// the provided image path matches the path of the current desktop background
// image. A return value of 0 indicates success/match.
function checkDesktopBackgroundCLI(imagePath) {
  let checkBackgroundProcess = createProcess();
  checkBackgroundProcess.init(getPythonExecutableFile());
  let args = [
    kDesktopCheckerScriptPath,
    "--verbose",
    "--check-background-image",
    imagePath,
  ];
  checkBackgroundProcess.run(true, args, args.length);
  return checkBackgroundProcess.exitValue;
}

// Use the python script to set/check the desktop background is |imagePath|
function setAndCheckDesktopBackgroundCLI(imagePath) {
  Assert.ok(FileUtils.File(imagePath).exists(), `${imagePath} exists`);

  let setExitCode = setDesktopBackgroundCLI(imagePath);
  Assert.equal(setExitCode, 0, `Setting background via CLI to ${imagePath}`);

  let checkExitCode = checkDesktopBackgroundCLI(imagePath);
  Assert.equal(checkExitCode, 0, `Checking background via CLI is ${imagePath}`);
}

// Restore the automation default background image. i.e., the default used
// in the automated test environment, not the OS default.
function restoreDefaultBackground() {
  let defaultBackgroundPath;
  if (AppConstants.isPlatformAndVersionAtLeast("macosx", 19)) {
    defaultBackgroundPath = kDefaultBackgroundImage_10_15;
  } else {
    defaultBackgroundPath = kDefaultBackgroundImage_10_14;
  }
  setAndCheckDesktopBackgroundCLI(defaultBackgroundPath);
}

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["test.wait300msAfterTabSwitch", true]],
  });
});

/**
 * Tests "Set As Desktop Background" platform implementation on macOS.
 *
 * Sets the desktop background image to the browser logo from the about:logo
 * page and verifies it was set successfully. Setting the desktop background
 * (which uses the nsIShellService::setDesktopBackground() interface method)
 * downloads the image to ~/Pictures using a unique file name and sets the
 * desktop background to the downloaded file leaving the download in place.
 * After setDesktopBackground() is called, the test uses a python script to
 * validate that the current desktop background is in fact set to the
 * downloaded logo.
 */
add_task(async function () {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: "about:logo",
    },
    async () => {
      let dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(
        Ci.nsIDirectoryServiceProvider
      );
      let uuidGenerator = Services.uuid;
      let shellSvc = Cc["@mozilla.org/browser/shell-service;1"].getService(
        Ci.nsIShellService
      );

      // Ensure we are starting with the default background. Log a
      // failure if we can not set the background to the default, but
      // ignore the case where the background is not already set as that
      // that may be due to a previous test failure.
      restoreDefaultBackground();

      // Generate a UUID (with non-alphanumberic characters removed) to build
      // up a filename for the desktop background. Use a UUID to distinguish
      // between runs so we won't be confused by images that were not properly
      // cleaned up after previous runs.
      let uuid = uuidGenerator.generateUUID().toString().replace(/\W/g, "");

      // Set the background image path to be $HOME/Pictures/<UUID>.png.
      // nsIShellService.setDesktopBackground() downloads the image to this
      // path and then sets it as the desktop background image, leaving the
      // image in place.
      let backgroundImage = dirSvc.getFile(NS_OSX_PICTURE_DOCUMENTS_DIR, {});
      backgroundImage.append(uuid + ".png");
      if (backgroundImage.exists()) {
        backgroundImage.remove(false);
      }

      // For simplicity, we're going to reach in and access the image on the
      // page directly, which means the page shouldn't be running in a remote
      // browser. Thankfully, about:logo runs in the parent process for now.
      Assert.ok(
        !gBrowser.selectedBrowser.isRemoteBrowser,
        "image can be accessed synchronously from the parent process"
      );
      let image = gBrowser.selectedBrowser.contentDocument.images[0];

      info(`Setting/saving desktop background to ${backgroundImage.path}`);

      // Saves the file in ~/Pictures
      shellSvc.setDesktopBackground(image, 0, backgroundImage.leafName);

      await BrowserTestUtils.waitForCondition(() => backgroundImage.exists());
      info(`${backgroundImage.path} downloaded`);
      Assert.ok(
        FileUtils.File(backgroundImage.path).exists(),
        `${backgroundImage.path} exists`
      );

      // Check that the desktop background image is the image we set above.
      let exitCode = checkDesktopBackgroundCLI(backgroundImage.path);
      Assert.equal(exitCode, 0, `background should be ${backgroundImage.path}`);

      // Restore the background image to the Mac default.
      restoreDefaultBackground();

      // We no longer need the downloaded image.
      backgroundImage.remove(false);
    }
  );
});
