/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Ensure that static frames of framesets are serialized but dynamically
 * inserted iframes are ignored.
 */
add_task(async function () {
  // This URL has the following frames:
  //  + data:text/html,A (static)
  //  + data:text/html,B (static)
  //  + data:text/html,C (dynamic iframe)
  const URL =
    "data:text/html;charset=utf-8," +
    "<frameset cols=50%25,50%25><frame src='data:text/html,A'>" +
    "<frame src='data:text/html,B'></frameset>" +
    "<script>var i=document.createElement('iframe');" +
    "i.setAttribute('src', 'data:text/html,C');" +
    "document.body.appendChild(i);</script>";

  // Add a new tab with two "static" and one "dynamic" frame.
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  await TabStateFlusher.flush(browser);
  let { entries } = JSON.parse(ss.getTabState(tab));

  // Check URLs.
  ok(entries[0].url.startsWith("data:text/html"), "correct root url");
  is(
    entries[0].children[0].url,
    "data:text/html,A",
    "correct url for 1st frame"
  );
  is(
    entries[0].children[1].url,
    "data:text/html,B",
    "correct url for 2nd frame"
  );

  // Check the number of children.
  is(entries.length, 1, "there is one root entry ...");
  is(entries[0].children.length, 2, "... with two child entries");

  // Cleanup.
  gBrowser.removeTab(tab);
});

/**
 * Ensure that iframes created by the network parser are serialized but
 * dynamically inserted iframes are ignored. Navigating a subframe should
 * create a second root entry that doesn't contain any dynamic children either.
 */
add_task(async function () {
  // This URL has the following frames:
  //  + data:text/html,A (static)
  //  + data:text/html,C (dynamic iframe)
  const URL =
    "data:text/html;charset=utf-8," +
    "<iframe name=t src='data:text/html,A'></iframe>" +
    "<a id=lnk href='data:text/html,B' target=t>clickme</a>" +
    "<script>var i=document.createElement('iframe');" +
    "i.setAttribute('src', 'data:text/html,C');" +
    "document.body.appendChild(i);</script>";

  // Add a new tab with one "static" and one "dynamic" frame.
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  await TabStateFlusher.flush(browser);
  let { entries } = JSON.parse(ss.getTabState(tab));

  // Check URLs.
  ok(entries[0].url.startsWith("data:text/html"), "correct root url");
  ok(!entries[0].children, "no children collected");

  // Navigate the subframe by activating the link. Activate it directly in
  // content rather than synthesizing a mouse click: the link sits inline
  // between two asynchronously-loading iframes, so a coordinate-based click can
  // intermittently miss it while layout is still reflowing. Set up the load
  // listener before activating so the subframe load can't be missed either.
  let loaded = promiseBrowserLoaded(
    browser,
    false /* don't ignore subframes */
  );
  await SpecialPowers.spawn(browser, [], () => {
    content.document.getElementById("lnk").click();
  });
  await loaded;

  await TabStateFlusher.flush(browser);
  ({ entries } = JSON.parse(ss.getTabState(tab)));

  // Check URLs.
  ok(entries[0].url.startsWith("data:text/html"), "correct 1st root url");
  ok(entries[1].url.startsWith("data:text/html"), "correct 2nd root url");
  ok(!entries.children, "no children collected");
  ok(!entries[0].children, "no children collected");
  ok(!entries[1].children, "no children collected");

  // Cleanup.
  gBrowser.removeTab(tab);
});
