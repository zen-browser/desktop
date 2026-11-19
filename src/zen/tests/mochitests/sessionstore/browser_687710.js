/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Test that sessionrestore handles cycles in the shentry graph properly.
//
// These cycles shouldn't be there in the first place, but they cause hangs
// when they mysteriously appear (bug 687710).  Docshell code assumes this
// graph is a tree and tires to walk to the root.  But if there's a cycle,
// there is no root, and we loop forever.

var stateBackup = ss.getBrowserState();

var state = {
  windows: [
    {
      tabs: [
        {
          entries: [
            {
              docIdentifier: 1,
              url: "http://example.com",
              triggeringPrincipal_base64,
              children: [
                {
                  docIdentifier: 2,
                  url: "http://example.com",
                  triggeringPrincipal_base64,
                },
              ],
            },
            {
              docIdentifier: 2,
              url: "http://example.com",
              triggeringPrincipal_base64,
              children: [
                {
                  docIdentifier: 1,
                  url: "http://example.com",
                  triggeringPrincipal_base64,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

add_task(async function test() {
  registerCleanupFunction(function () {
    ss.setBrowserState(stateBackup);
  });

  /* This test fails by hanging. */
  await setBrowserState(state);
  ok(true, "Didn't hang!");
});
