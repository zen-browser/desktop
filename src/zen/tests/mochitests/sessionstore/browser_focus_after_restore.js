/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

add_task(async function test() {
  gURLBar.focus();
  is(
    document.activeElement,
    gURLBar.inputField,
    "urlbar is focused before restoring"
  );

  await promiseBrowserState({
    windows: [
      {
        tabs: [
          {
            entries: [
              {
                url: "http://example.org/",
                triggeringPrincipal_base64,
              },
            ],
          },
        ],
        selected: 1,
      },
    ],
  });
  is(
    document.activeElement,
    gBrowser.selectedBrowser,
    "content area is focused after restoring"
  );
});
