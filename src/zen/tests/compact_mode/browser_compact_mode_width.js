/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

function goToRightSideTabs(callback) {
  return new Promise(async (resolve) => {
    await SpecialPowers.pushPrefEnv({
      set: [['zen.tabs.vertical.right-side', true]],
    });
    setTimeout(async () => {
      await callback();
      await SpecialPowers.popPrefEnv();
      setTimeout(() => {
        resolve();
      }, 1000); // Wait for new layout
    }, 1000); // Wait for new layout
  });
}

async function testSidebarWidth() {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  let hasRan = false;
  const ogSize = gNavToolbox.getBoundingClientRect().width;
  const onCompactChanged = (event) => {
    if (hasRan) {
      setTimeout(() => {
        gZenCompactModeManager.removeEventListener(onCompactChanged);
        resolvePromise();
      }, 500);
      return;
    }
    setTimeout(() => {
      const newSize = gNavToolbox.style.getPropertyValue('--zen-sidebar-width').replace('px', '');
      Assert.equal(
        newSize,
        ogSize,
        'The size of the titlebar should be the same as the original size'
      );
      hasRan = true;
      gZenCompactModeManager.preference = false;
    }, 500);
  };

  gZenCompactModeManager.addEventListener(onCompactChanged);

  gZenCompactModeManager.preference = true;
  await promise;
}

add_task(async function test_Compact_Mode_Width() {
  await testSidebarWidth();
});

add_task(async function test_Compact_Mode_Width_Right_Side() {
  await goToRightSideTabs(testSidebarWidth);
});

add_task(async function test_Compact_Mode_Hover() {
  gNavToolbox.setAttribute('zen-has-hover', true);
  await testSidebarWidth();
  gNavToolbox.removeAttribute('zen-has-hover');
});
