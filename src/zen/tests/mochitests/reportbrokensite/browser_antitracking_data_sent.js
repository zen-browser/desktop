/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* Tests to ensure that the right data is sent for
 * private windows and when ETP blocks content.
 */

/* import-globals-from send.js */
/* import-globals-from send_more_info.js */

"use strict";

Services.scriptloader.loadSubScript(
  getRootDirectory(gTestPath) + "send_more_info.js",
  this
);

add_common_setup();

add_task(setupStrictETP);

function getEtpCategory() {
  return Services.prefs.getStringPref(
    "browser.contentblocking.category",
    "standard"
  );
}

add_task(async function testSendButton() {
  ensureReportBrokenSitePreffedOn();
  ensureReasonOptional();

  const win = await BrowserTestUtils.openNewBrowserWindow({ private: true });
  const blockedPromise = waitForContentBlockingEvent(3, win);
  const tab = await openTab(REPORTABLE_PAGE_URL3, win);
  await blockedPromise;

  await testSend(tab, AppMenu(win), {
    breakageCategory: "adblocker",
    description: "another test description",
    antitracking: {
      blockList: "strict",
      blockedOrigins: null,
      isPrivateBrowsing: true,
      hasTrackingContentBlocked: true,
      hasMixedActiveContentBlocked: true,
      hasMixedDisplayContentBlocked: true,
      btpHasPurgedSite: false,
      etpCategory: getEtpCategory(),
    },
    frameworks: {
      fastclick: true,
      marfeel: true,
      mobify: true,
    },
  });

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function testSendingMoreInfo() {
  ensureReportBrokenSitePreffedOn();
  ensureSendMoreInfoEnabled();

  const win = await BrowserTestUtils.openNewBrowserWindow({ private: true });
  const blockedPromise = waitForContentBlockingEvent(3, win);
  const tab = await openTab(REPORTABLE_PAGE_URL3, win);
  await blockedPromise;

  await testSendMoreInfo(tab, AppMenu(win), {
    antitracking: {
      blockList: "strict",
      blockedOrigins: ["https://trackertest.org"],
      isPrivateBrowsing: true,
      hasTrackingContentBlocked: true,
      hasMixedActiveContentBlocked: true,
      hasMixedDisplayContentBlocked: true,
      btpHasPurgedSite: false,
      etpCategory: getEtpCategory(),
    },
    frameworks: { fastclick: true, mobify: true, marfeel: true },
    consoleLog: [
      {
        level: "error",
        log(actual) {
          // "Blocked loading mixed display content http://example.com/tests/image/test/mochitest/blue.png"
          return (
            Array.isArray(actual) &&
            actual.length == 1 &&
            actual[0].includes("blue.png")
          );
        },
        pos: "0:1",
        uri: REPORTABLE_PAGE_URL3,
      },
      {
        level: "error",
        log(actual) {
          // "Blocked loading mixed active content http://tracking.example.org/browser/browser/base/content/test/protectionsUI/benignPage.html",
          return (
            Array.isArray(actual) &&
            actual.length == 1 &&
            actual[0].includes("benignPage.html")
          );
        },
        pos: "0:1",
        uri: REPORTABLE_PAGE_URL3,
      },
      {
        level: "warn",
        log(actual) {
          // "The resource at https://trackertest.org/ was blocked because content blocking is enabled.",
          return (
            Array.isArray(actual) &&
            actual.length == 1 &&
            actual[0].includes("trackertest.org")
          );
        },
        pos: "0:1",
        uri: REPORTABLE_PAGE_URL3,
      },
    ],
  });

  await BrowserTestUtils.closeWindow(win);
});
