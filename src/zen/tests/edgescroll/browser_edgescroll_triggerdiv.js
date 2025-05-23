/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

// Globals defined by the mochitest environment:
/* global TestUtils, Services, SpecialPowers, BrowserTestUtils, gBrowser, window, document, MouseEvent, info, ok, is */

add_task(async function test_ZenEdgeScroll_TriggerExists() {
  await SpecialPowers.pushPrefEnv({ set: [['zen.edgescroll.enabled', true]] });
  // Open a simple page to initialize the edge-scroll manager
  await BrowserTestUtils.openNewForegroundTab(
    window.gBrowser,
    `    
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
    `,
    true
  );

  // Wait for the trigger div to appear
  await TestUtils.waitForCondition(
    () => !!document.getElementById('zen-edge-scroll-trigger'),
    'Edge scroll trigger div should be created'
  );
  const trigger = document.getElementById('zen-edge-scroll-trigger');
  ok(trigger, 'The zen-edge-scroll-trigger div exists');

  BrowserTestUtils.removeTab(window.gBrowser.selectedTab);
});
