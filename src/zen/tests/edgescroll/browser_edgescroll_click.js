/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

// Globals defined by the mochitest environment:
/* global TestUtils, Services, SpecialPowers, BrowserTestUtils, gBrowser, window, document, MouseEvent, info, ok, is */

add_task(async function test_ZenEdgeScroll_ClickScrollsContent() {
  await SpecialPowers.pushPrefEnv({ set: [['zen.edgescroll.enabled', true]] });
  const tallPage = `
    data:text/html,
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body{height:5000px;margin:0;background: linear-gradient(to bottom, blue, green);}
        </style>
      </head>
      <body></body>
    </html>
  `;
  await BrowserTestUtils.openNewForegroundTab(window.gBrowser, tallPage, true);

  // wait for trigger
  const trigger = await TestUtils.waitForCondition(
    () => document.getElementById('zen-edgescroll-trigger'),
    'Edge scroll trigger appears'
  );

  const browser = window.gBrowser.selectedBrowser;
  await SpecialPowers.spawn(browser, [], () => content.scrollTo(0, 0));
  const initialScroll = await SpecialPowers.spawn(browser, [], () => content.scrollY);

  // simulate click on the edge trigger
  const rect = trigger.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  // press down on the trigger
  trigger.dispatchEvent(new MouseEvent('mousedown', {
    clientX,
    clientY,
    bubbles: true,
    cancelable: true,
  }));
  // release to complete the click
  document.dispatchEvent(new MouseEvent('mouseup', {
    clientX,
    clientY,
    bubbles: true,
    cancelable: true,
  }));  

  // wait for synthetic scroll
  await new Promise(r => setTimeout(r, 500));
  const newScroll = await SpecialPowers.spawn(browser, [], () => content.scrollY);
  ok(newScroll > initialScroll, 'Clicking the edge trigger scrolls the content');

  BrowserTestUtils.removeTab(window.gBrowser.selectedTab);
});