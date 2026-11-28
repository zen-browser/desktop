// Paths used to run the CLI command (python script) that is used to
// 1) check the desktop background image matches what we set it to via
//    ShellService::setDesktopBackground() and
// 2) revert the desktop background image to the OS default

let kPythonPath = "/usr/bin/python";
if (AppConstants.isPlatformAndVersionAtLeast("macosx", 23.0)) {
  kPythonPath = "/usr/local/bin/python3";
}

const kDesktopCheckerScriptPath =
  "browser/browser/components/shell/test/mac_desktop_image.py";
const kDefaultBackgroundImage =
  "/System/Library/Desktop Pictures/Solid Colors/Teal.png";

ChromeUtils.defineESModuleGetters(this, {
  FileUtils: "resource://gre/modules/FileUtils.sys.mjs",
  FileTestUtils: "resource://testing-common/FileTestUtils.sys.mjs",
  ShellService: "moz-src:///browser/components/shell/ShellService.sys.mjs",
  sinon: "resource://testing-common/Sinon.sys.mjs",
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
  defaultBackgroundPath = kDefaultBackgroundImage;
  setAndCheckDesktopBackgroundCLI(defaultBackgroundPath);
}

/**
 * Tests "Set As Desktop Background" platform implementation on macOS.
 *
 * Sets the desktop background image to the large.png image and verifies it was
 * set successfully. Setting the desktop background (which uses the
 * nsIShellService::setDesktopBackground() interface method) downloads the
 * image to ~/Pictures using a unique file name and sets the desktop background
 * to the downloaded file leaving the download in place. After
 * setDesktopBackground() is called, the test uses a python script to validate
 * that the current desktop background is in fact set to the downloaded image.
 */
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
      // Ensure we are starting with the default background. Log a
      // failure if we can not set the background to the default, but
      // ignore the case where the background is not already set as that
      // that may be due to a previous test failure.
      restoreDefaultBackground();

      // nsIShellService.setDesktopBackground() downloads the image to this
      // path and then sets it as the desktop background image, leaving the
      // image in place.
      let backgroundImage = await ShellService._getDesktopBackgroundFile();
      if (backgroundImage.exists()) {
        backgroundImage.remove(false);
      }

      // For simplicity, we're going to reach in and access the image on the
      // page directly, which means the page shouldn't be running in a remote
      // browser. Thankfully, chrome:// runs in the parent process for now.
      Assert.ok(
        !gBrowser.selectedBrowser.isRemoteBrowser,
        "image can be accessed synchronously from the parent process"
      );
      let image = gBrowser.selectedBrowser.contentDocument.images[0];

      info(`Setting/saving desktop background to ${backgroundImage.path}`);
      await ShellService.setDesktopBackground(
        image,
        image.naturalWidth,
        image.naturalHeight,
        0
      );

      info(`${backgroundImage.path} downloaded`);
      Assert.ok(backgroundImage.exists(), `${backgroundImage.path} exists`);

      // Check that the desktop background image is the image we set above.
      let exitCode = checkDesktopBackgroundCLI(backgroundImage.path);
      Assert.equal(exitCode, 0, `background should be ${backgroundImage.path}`);

      // Restore the background image to the Mac default.
      restoreDefaultBackground();
    }
  );

  sandbox.restore();
});
