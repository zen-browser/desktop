/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Glance_Basic_Open() {
  await openGlanceOnTab(async (glanceTab) => {
    ok(
      glanceTab.hasAttribute('zen-glance-tab'),
      'The glance tab should have the zen-glance-tab attribute'
    );
  });
});
