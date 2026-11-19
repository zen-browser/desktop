/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const PAGE_URL = `${getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "https://example.com"
)}file_empty.html`;

const SHOWN_TOPIC = "web-notification-shown";
const CLOSED_TOPIC = "web-notification-closed";

// The system backend does not deliver alertshow/alertfinished on every
// platform, and cannot be driven from a test. The XUL backend is a real
// consumer of the same listener contract, so capture is exercised through it.
add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["alerts.useSystemBackend", false]],
  });
});

function captureNext(topic) {
  return new Promise(resolve => {
    Services.obs.addObserver(function observer(subject, observedTopic, data) {
      Services.obs.removeObserver(observer, observedTopic);
      resolve({ subject, data });
    }, topic);
  });
}

async function withNotificationPage(task) {
  await BrowserTestUtils.withNewTab(PAGE_URL, async browser => {
    await SpecialPowers.spawn(browser, [], async () => {
      await SpecialPowers.pushPermissions([
        {
          type: "desktop-notification",
          allow: SpecialPowers.Services.perms.ALLOW_ACTION,
          context: content.document,
        },
      ]);
    });
    await task(browser);
  });
}

function showNotification(browser, title, options = {}) {
  return SpecialPowers.spawn(browser, [title, options], async (t, opts) => {
    const notification = new content.Notification(t, opts);
    const { promise, resolve, reject } = Promise.withResolvers();
    notification.onshow = () => resolve();
    notification.onerror = () => reject(new Error("onerror"));
    content.wrappedJSObject.notification = notification;
    return promise;
  });
}

add_task(async function show_is_captured() {
  await withNotificationPage(async browser => {
    const shown = captureNext(SHOWN_TOPIC);
    await showNotification(browser, "hello", { body: "world", tag: "t1" });

    const alert = (await shown).subject.QueryInterface(Ci.nsIAlertNotification);
    is(alert.title, "hello", "Alert carries the title");
    is(alert.text, "world", "Alert carries the body");
    is(
      alert.principal.origin,
      "https://example.com",
      "Alert carries the origin principal"
    );

    await SpecialPowers.spawn(browser, [], () =>
      content.wrappedJSObject.notification.close()
    );
  });
});

add_task(async function close_is_captured() {
  await withNotificationPage(async browser => {
    const shown = captureNext(SHOWN_TOPIC);
    await showNotification(browser, "bye", { tag: "t2" });
    const name = (await shown).subject.QueryInterface(
      Ci.nsIAlertNotification
    ).name;

    const closed = captureNext(CLOSED_TOPIC);
    await SpecialPowers.spawn(browser, [], () =>
      content.wrappedJSObject.notification.close()
    );

    is(
      (await closed).subject.QueryInterface(Ci.nsIAlertNotification).name,
      name,
      "Close reports the same notification"
    );
  });
});

add_task(async function kill_switch_suppresses_capture() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.alerts.capture.enabled", false]],
  });

  let fired = false;
  const observer = () => {
    fired = true;
  };
  Services.obs.addObserver(observer, SHOWN_TOPIC);

  await withNotificationPage(async browser => {
    await showNotification(browser, "quiet", { tag: "t3" });
    ok(!fired, "No capture topic fired while the kill switch is off");
    await SpecialPowers.spawn(browser, [], () =>
      content.wrappedJSObject.notification.close()
    );
  });

  Services.obs.removeObserver(observer, SHOWN_TOPIC);
  await SpecialPowers.popPrefEnv();
});
