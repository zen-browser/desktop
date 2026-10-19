/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const CLIENT_AUTH_URI = "chrome://pippki/content/clientauthask.xhtml";
const CLIENT_AUTH_HOSTNAME =
  "certificate-authentication.long-hostname.example.com";

add_task(async function test_client_auth_dialog_sizing() {
  const { PromptUtils } = ChromeUtils.importESModule(
    "resource://gre/modules/PromptUtils.sys.mjs"
  );
  // This is a self-signed test certificate; no private key is needed or imported.
  const response = await fetch(
    getRootDirectory(gTestPath) + "client_auth_dialog.pem"
  );
  const pem = await response.text();
  const cert = Cc["@mozilla.org/security/x509certdb;1"]
    .getService(Ci.nsIX509CertDB)
    .constructX509FromBase64(
      pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "")
    );

  for (const windowModal of [false, true]) {
    const retVals = { cert: null, rememberDuration: 2 };
    const args = PromptUtils.objectToPropBag({
      hostname: CLIENT_AUTH_HOSTNAME,
      certArray: [cert],
      retVals,
    });
    const loaded = TestUtils.topicObserved("cert-dialog-loaded");
    let subDialog;
    let closedPromise;
    if (windowModal) {
      closedPromise = gDialogBox.open(CLIENT_AUTH_URI, args);
      subDialog = gDialogBox.dialog;
    } else {
      const dialogBox = gBrowser.getTabDialogBox(gBrowser.selectedBrowser);
      ({ closedPromise } = dialogBox.open(CLIENT_AUTH_URI, {}, args));
      subDialog = dialogBox.getTabDialogManager()._topDialog;
    }

    try {
      await loaded;
      await subDialog._dialogReady;
      const doc = subDialog._frame.contentDocument;
      const win = doc.defaultView;
      const dialog = doc.getElementById("certAuthAsk");

      // Flush any pending translations after the initial sizing. Before the
      // fix, the hostname is filled in too late and grows beyond the frame.
      await doc.l10n.translateRoots();
      ok(
        doc
          .getElementById("clientAuthSiteIdentification")
          .textContent.includes(CLIENT_AUTH_HOSTNAME),
        "The complete hostname is displayed"
      );
      const heading = doc.getElementById("clientAuthSiteIdentification");
      ok(
        heading.getBoundingClientRect().height >
          parseFloat(win.getComputedStyle(heading).fontSize) * 1.5,
        "The hostname exercises a wrapping heading"
      );
      const frameRect = subDialog._frame.getBoundingClientRect();
      for (const name of ["accept", "cancel"]) {
        const button = dialog.getButton(name);
        const rect = button.getBoundingClientRect();
        ok(rect.width > 0 && rect.height > 0, `${name} has a visible size`);
        ok(
          rect.top >= 0 && rect.bottom <= win.innerHeight,
          `${name} fits vertically in the ${windowModal ? "window" : "tab"} dialog`
        );
        ok(
          rect.left >= 0 && rect.right <= win.innerWidth,
          `${name} fits horizontally in the dialog`
        );
        ok(
          frameRect.top + rect.top >= 0 &&
            frameRect.top + rect.bottom <= window.innerHeight,
          `${name} fits vertically in the browser window`
        );
        ok(
          frameRect.left + rect.left >= 0 &&
            frameRect.left + rect.right <= window.innerWidth,
          `${name} fits horizontally in the browser window`
        );
        ok(!button.disabled, `${name} is enabled`);
      }

      const rememberDuration = windowModal ? 1 : 0;
      doc.getElementById("rememberSetting").value = rememberDuration;
      dialog.getButton(windowModal ? "accept" : "cancel").click();
      await closedPromise;
      is(
        retVals.cert,
        windowModal ? cert : null,
        "The certificate choice is returned"
      );
      is(
        retVals.rememberDuration,
        rememberDuration,
        "The remember setting is returned"
      );
    } finally {
      if (subDialog._openedURL) {
        subDialog.close();
      }
      await closedPromise;
    }
  }
});
