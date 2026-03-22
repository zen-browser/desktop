/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

/*
 * This test validates that an OTF font installed in a directory not
 * accessible to content processes is rendered correctly by checking that
 * content displayed never uses the OS fallback font "LastResort". When
 * a content process renders a page with the fallback font, that is an
 * indication the content process failed to read or load the computed font.
 * The test uses a version of the Fira Sans font and depends on the font
 * not being already installed and enabled.
 */

const kPageURL =
  "http://example.com/browser/security/sandbox/test/bug1393259.html";

// Parameters for running the python script that registers/unregisters fonts.
let kPythonPath = "/usr/bin/python";
if (AppConstants.isPlatformAndVersionAtLeast("macosx", 23.0)) {
  kPythonPath = "/usr/local/bin/python3";
}
const kFontInstallerPath = "browser/security/sandbox/test/mac_register_font.py";
const kUninstallFlag = "-u";
const kVerboseFlag = "-v";

// Where to find the font in the test environment.
const kRepoFontPath = "browser/security/sandbox/test/FiraSans-Regular.otf";

// Font name strings to check for.
const kLastResortFontName = "LastResort";
const kTestFontName = "Fira Sans";

// Home-relative path to install a private font. Where a private font is
// a font at a location not readable by content processes.
const kPrivateFontSubPath = "/FiraSans-Regular.otf";

add_task(async function () {
  await new Promise(resolve => waitForFocus(resolve, window));

  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: kPageURL,
    },
    async function (aBrowser) {
      function runProcess(aCmd, aArgs, blocking = true) {
        let cmdFile = Cc["@mozilla.org/file/local;1"].createInstance(
          Ci.nsIFile
        );
        cmdFile.initWithPath(aCmd);

        let process = Cc["@mozilla.org/process/util;1"].createInstance(
          Ci.nsIProcess
        );
        process.init(cmdFile);
        process.run(blocking, aArgs, aArgs.length);
        return process.exitValue;
      }

      // Register the font at path |fontPath| and wait
      // for the browser to detect the change.
      async function registerFont(fontPath) {
        let fontRegistered = getFontNotificationPromise();
        let exitCode = runProcess(kPythonPath, [
          kFontInstallerPath,
          kVerboseFlag,
          fontPath,
        ]);
        Assert.equal(exitCode, 0, "registering font" + fontPath);
        if (exitCode == 0) {
          // Wait for the font registration to be detected by the browser.
          await fontRegistered;
        }
      }

      // Unregister the font at path |fontPath|. If |waitForUnreg| is true,
      // don't wait for the browser to detect the change and don't use
      // the verbose arg for the unregister command.
      async function unregisterFont(fontPath, waitForUnreg = true) {
        let args = [kFontInstallerPath, kUninstallFlag];
        let fontUnregistered;

        if (waitForUnreg) {
          args.push(kVerboseFlag);
          fontUnregistered = getFontNotificationPromise();
        }

        let exitCode = runProcess(kPythonPath, args.concat(fontPath));
        if (waitForUnreg) {
          Assert.equal(exitCode, 0, "unregistering font" + fontPath);
          if (exitCode == 0) {
            await fontUnregistered;
          }
        }
      }

      // Returns a promise that resolves when font info is changed.
      let getFontNotificationPromise = () =>
        new Promise(resolve => {
          const kTopic = "font-info-updated";
          function observe() {
            Services.obs.removeObserver(observe, kTopic);
            resolve();
          }

          Services.obs.addObserver(observe, kTopic);
        });

      let homeDir = Services.dirsvc.get("Home", Ci.nsIFile);
      let privateFontPath = homeDir.path + kPrivateFontSubPath;

      registerCleanupFunction(function () {
        unregisterFont(privateFontPath, /* waitForUnreg = */ false);
        runProcess("/bin/rm", [privateFontPath], /* blocking = */ false);
      });

      // Copy the font file to the private path.
      runProcess("/bin/cp", [kRepoFontPath, privateFontPath]);

      // Cleanup previous aborted tests.
      unregisterFont(privateFontPath, /* waitForUnreg = */ false);

      // Get the original width, using the fallback monospaced font
      let origWidth = await SpecialPowers.spawn(
        aBrowser,
        [],
        async function () {
          let window = content.window.wrappedJSObject;
          let contentDiv = window.document.getElementById("content");
          return contentDiv.offsetWidth;
        }
      );

      // Activate the font we want to test at a non-standard path.
      await registerFont(privateFontPath);

      // Assign the new font to the content.
      await SpecialPowers.spawn(aBrowser, [], async function () {
        let window = content.window.wrappedJSObject;
        let contentDiv = window.document.getElementById("content");
        contentDiv.style.fontFamily = "'Fira Sans', monospace";
      });

      // Wait until the width has changed, indicating the content process
      // has recognized the newly-activated font.
      while (true) {
        let width = await SpecialPowers.spawn(aBrowser, [], async function () {
          let window = content.window.wrappedJSObject;
          let contentDiv = window.document.getElementById("content");
          return contentDiv.offsetWidth;
        });
        if (width != origWidth) {
          break;
        }
        // If the content wasn't ready yet, wait a little before re-checking.
        // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
        await new Promise(c => setTimeout(c, 100));
      }

      // Get a list of fonts now being used to display the web content.
      let fontList = await SpecialPowers.spawn(aBrowser, [], async function () {
        let window = content.window.wrappedJSObject;
        let range = window.document.createRange();
        let contentDiv = window.document.getElementById("content");
        range.selectNode(contentDiv);
        let fonts = InspectorUtils.getUsedFontFaces(range);

        let fontList = [];
        for (let i = 0; i < fonts.length; i++) {
          fontList.push({ name: fonts[i].name });
        }
        return fontList;
      });

      let lastResortFontUsed = false;
      let testFontUsed = false;

      for (let font of fontList) {
        // Did we fall back to the "LastResort" font?
        if (!lastResortFontUsed && font.name.includes(kLastResortFontName)) {
          lastResortFontUsed = true;
          continue;
        }
        // Did we render using our test font as expected?
        if (!testFontUsed && font.name.includes(kTestFontName)) {
          testFontUsed = true;
          continue;
        }
      }

      Assert.ok(
        !lastResortFontUsed,
        `The ${kLastResortFontName} fallback font was not used`
      );

      Assert.ok(testFontUsed, `The test font "${kTestFontName}" was used`);

      await unregisterFont(privateFontPath);
    }
  );
});
