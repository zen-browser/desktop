/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

// Globals defined by the mochitest environment:
/* global TestUtils, Services, SpecialPowers, BrowserTestUtils, gBrowser, window, document, MouseEvent, info, ok, is */

add_task(async function test_ZenEdgeScroll_WheelScrollsContent() {
  await SpecialPowers.pushPrefEnv({ set: [['zen.edgescroll.enabled', true]] });
  // add <!DOCTYPE html> so scrolling actually works
  const tallPage = `
    data:text/html,
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body{height:5000px;margin:0;background: linear-gradient(to bottom, blue, green);
        </style>
      </head>
      <body></body>
    </html>
  `;
  await BrowserTestUtils.openNewForegroundTab(window.gBrowser, tallPage, true);

  // give the trigger a moment
  await new Promise((r) => setTimeout(r, 100));

  const trigger = await TestUtils.waitForCondition(
    () => document.getElementById('zen-edge-scroll-trigger'),
    'Edge scroll trigger appears'
  );

  const browser = window.gBrowser.selectedBrowser;
  await SpecialPowers.spawn(browser, [], () => content.scrollTo(0, 0));
  const initialScroll = await SpecialPowers.spawn(
    browser,
    [],
    () => content.document.documentElement.scrollTop
  );

  const rect = trigger.getBoundingClientRect();
  const wheelEvent = new WheelEvent('wheel', {
    deltaY: 200,
    clientY: rect.top + 20,
    bubbles: true,
    cancelable: true,
  });
  trigger.dispatchEvent(wheelEvent);

  // give it time to scroll
  await new Promise((r) => setTimeout(r, 500));

  const newScroll = await SpecialPowers.spawn(
    browser,
    [],
    () => content.document.documentElement.scrollTop
  );
  info('Initial scroll:', initialScroll);
  info('New scroll:', newScroll);
  ok(
    newScroll > initialScroll,
    'Content should scroll when wheel event is dispatched to the edge trigger'
  );

  BrowserTestUtils.removeTab(window.gBrowser.selectedTab);
});
