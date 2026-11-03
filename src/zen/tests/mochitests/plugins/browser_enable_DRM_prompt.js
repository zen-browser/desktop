const TEST_URL =
  getRootDirectory(gTestPath).replace(
    "chrome://mochitests/content",
    "https://example.com"
  ) + "empty_file.html";

/*
 * Register cleanup function to reset prefs after other tasks have run.
 */

add_task(async function () {
  // Note: SpecialPowers.pushPrefEnv has problems with the "Enable DRM"
  // button on the notification box toggling the prefs. So manually
  // set/unset the prefs the UI we're testing toggles.
  let emeWasEnabled = Services.prefs.getBoolPref("media.eme.enabled", false);
  let cdmWasEnabled = Services.prefs.getBoolPref(
    "media.gmp-widevinecdm.enabled",
    false
  );

  // Restore the preferences to their pre-test state on test finish.
  registerCleanupFunction(function () {
    // Unlock incase lock test threw and didn't unlock.
    Services.prefs.unlockPref("media.eme.enabled");
    Services.prefs.setBoolPref("media.eme.enabled", emeWasEnabled);
    Services.prefs.setBoolPref("media.gmp-widevinecdm.enabled", cdmWasEnabled);
  });
});

/*
 * Bug 1366167 - Tests that the "Enable DRM" prompt shows if EME is requested while EME is disabled.
 */

add_task(async function test_drm_prompt_shows_for_toplevel() {
  await BrowserTestUtils.withNewTab(TEST_URL, async function (browser) {
    // Turn off EME and Widevine CDM.
    Services.prefs.setBoolPref("media.eme.enabled", false);
    Services.prefs.setBoolPref("media.gmp-widevinecdm.enabled", false);
    let notificationShownPromise = BrowserTestUtils.waitForNotificationBar(
      gBrowser,
      browser,
      "drmContentDisabled"
    );

    // Have content request access to Widevine, UI should drop down to
    // prompt user to enable DRM.
    let result = await SpecialPowers.spawn(browser, [], async function () {
      try {
        let config = [
          {
            initDataTypes: ["webm"],
            videoCapabilities: [{ contentType: 'video/webm; codecs="vp9"' }],
          },
        ];
        await content.navigator.requestMediaKeySystemAccess(
          "com.widevine.alpha",
          config
        );
      } catch (ex) {
        return { rejected: true };
      }
      return { rejected: false };
    });
    is(
      result.rejected,
      true,
      "EME request should be denied because EME disabled."
    );

    // Verify the UI prompt showed.
    let box = gBrowser.getNotificationBox(browser);
    await notificationShownPromise;
    let notification = box.currentNotification;
    await notification.updateComplete;

    ok(notification, "Notification should be visible");
    is(
      notification.getAttribute("value"),
      "drmContentDisabled",
      "Should be showing the right notification"
    );

    // Verify the "Enable DRM" button is there.
    let buttons = notification.buttonContainer.querySelectorAll(
      ".notification-button"
    );
    is(buttons.length, 1, "Should have one button.");

    // Prepare a Promise that should resolve when the "Enable DRM" button's
    // page reload completes.
    let refreshPromise = BrowserTestUtils.browserLoaded(browser);
    buttons[0].click();

    // Wait for the reload to complete.
    await refreshPromise;

    // Verify clicking the "Enable DRM" button enabled DRM.
    let enabled = Services.prefs.getBoolPref("media.eme.enabled", true);
    is(
      enabled,
      true,
      "EME should be enabled after click on 'Enable DRM' button"
    );
  });
});

add_task(async function test_eme_locked() {
  await BrowserTestUtils.withNewTab(TEST_URL, async function (browser) {
    // Turn off EME and Widevine CDM.
    Services.prefs.setBoolPref("media.eme.enabled", false);
    Services.prefs.lockPref("media.eme.enabled");

    // Have content request access to Widevine, UI should drop down to
    // prompt user to enable DRM.
    let result = await SpecialPowers.spawn(browser, [], async function () {
      try {
        let config = [
          {
            initDataTypes: ["webm"],
            videoCapabilities: [{ contentType: 'video/webm; codecs="vp9"' }],
          },
        ];
        await content.navigator.requestMediaKeySystemAccess(
          "com.widevine.alpha",
          config
        );
      } catch (ex) {
        return { rejected: true };
      }
      return { rejected: false };
    });
    is(
      result.rejected,
      true,
      "EME request should be denied because EME disabled."
    );

    // Verify the UI prompt did not show.
    let box = gBrowser.getNotificationBox(browser);
    let notification = box.currentNotification;

    is(
      notification,
      null,
      "Notification should not be displayed since pref is locked"
    );

    // Unlock the pref for any tests that follow.
    Services.prefs.unlockPref("media.eme.enabled");
  });
});

/*
 * Bug 1642465 - Ensure cross origin frames requesting access prompt in the same way as same origin.
 */

add_task(async function test_drm_prompt_shows_for_cross_origin_iframe() {
  await BrowserTestUtils.withNewTab(TEST_URL, async function (browser) {
    // Turn off EME and Widevine CDM.
    Services.prefs.setBoolPref("media.eme.enabled", false);
    Services.prefs.setBoolPref("media.gmp-widevinecdm.enabled", false);
    let notificationShownPromise = BrowserTestUtils.waitForNotificationBar(
      gBrowser,
      browser,
      "drmContentDisabled"
    );

    // Have content request access to Widevine, UI should drop down to
    // prompt user to enable DRM.
    const CROSS_ORIGIN_URL = TEST_URL.replace("example.com", "example.org");
    let result = await SpecialPowers.spawn(
      browser,
      [CROSS_ORIGIN_URL],
      async function (crossOriginUrl) {
        let frame = content.document.createElement("iframe");
        frame.src = crossOriginUrl;
        await new Promise(resolve => {
          frame.addEventListener("load", () => {
            resolve();
          });
          content.document.body.appendChild(frame);
        });

        return content.SpecialPowers.spawn(frame, [], async function () {
          try {
            let config = [
              {
                initDataTypes: ["webm"],
                videoCapabilities: [
                  { contentType: 'video/webm; codecs="vp9"' },
                ],
              },
            ];
            await content.navigator.requestMediaKeySystemAccess(
              "com.widevine.alpha",
              config
            );
          } catch (ex) {
            return { rejected: true };
          }
          return { rejected: false };
        });
      }
    );
    is(
      result.rejected,
      true,
      "EME request should be denied because EME disabled."
    );

    // Verify the UI prompt showed.
    let box = gBrowser.getNotificationBox(browser);
    await notificationShownPromise;
    let notification = box.currentNotification;
    await notification.updateComplete;

    ok(notification, "Notification should be visible");
    is(
      notification.getAttribute("value"),
      "drmContentDisabled",
      "Should be showing the right notification"
    );

    // Verify the "Enable DRM" button is there.
    let buttons = notification.buttonContainer.querySelectorAll(
      ".notification-button"
    );
    is(buttons.length, 1, "Should have one button.");

    // Prepare a Promise that should resolve when the "Enable DRM" button's
    // page reload completes.
    let refreshPromise = BrowserTestUtils.browserLoaded(browser);
    buttons[0].click();

    // Wait for the reload to complete.
    await refreshPromise;

    // Verify clicking the "Enable DRM" button enabled DRM.
    let enabled = Services.prefs.getBoolPref("media.eme.enabled", true);
    is(
      enabled,
      true,
      "EME should be enabled after click on 'Enable DRM' button"
    );
  });
});

add_task(async function test_drm_prompt_only_shows_one_notification() {
  await BrowserTestUtils.withNewTab(TEST_URL, async function (browser) {
    // Turn off EME and Widevine CDM.
    Services.prefs.setBoolPref("media.eme.enabled", false);
    Services.prefs.setBoolPref("media.gmp-widevinecdm.enabled", false);
    let notificationShownPromise = BrowserTestUtils.waitForNotificationBar(
      gBrowser,
      browser,
      "drmContentDisabled"
    );

    // Send three EME requests to ensure only one instance of the
    // "Enable DRM" notification appears in the chrome
    for (let i = 0; i < 3; i++) {
      await SpecialPowers.spawn(browser, [], async function () {
        try {
          let config = [
            {
              initDataTypes: ["webm"],
              videoCapabilities: [{ contentType: 'video/webm; codecs="vp9"' }],
            },
          ];
          await content.navigator.requestMediaKeySystemAccess(
            "com.widevine.alpha",
            config
          );
        } catch (ex) {
          return { rejected: true };
        }
        return { rejected: false };
      });
    }

    // Verify the UI prompt showed.
    let box = gBrowser.getNotificationBox(browser);
    await notificationShownPromise;
    let notification = box.currentNotification;

    ok(notification, "Notification should be visible");
    is(
      notification.getAttribute("value"),
      "drmContentDisabled",
      "Should be showing the right notification"
    );
    is(
      box.allNotifications.length,
      1,
      "There should only be one notification shown"
    );
  });
});
