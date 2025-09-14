/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

function simulateClick(win = window) {
  let target = win.gURLBar.inputField;
  let promise = BrowserTestUtils.waitForEvent(target, 'click');
  EventUtils.synthesizeMouseAtCenter(target, {});
  return promise;
}

function selectWithMouseDrag(fromX, toX, win = window) {
  let target = win.gURLBar.inputField;
  let rect = target.getBoundingClientRect();
  let promise = BrowserTestUtils.waitForEvent(target, 'mouseup');
  EventUtils.synthesizeMouse(
    target,
    fromX,
    rect.height / 2,
    { type: 'mousemove' },
    target.ownerGlobal
  );
  EventUtils.synthesizeMouse(
    target,
    fromX,
    rect.height / 2,
    { type: 'mousedown' },
    target.ownerGlobal
  );
  EventUtils.synthesizeMouse(
    target,
    toX,
    rect.height / 2,
    { type: 'mousemove' },
    target.ownerGlobal
  );
  EventUtils.synthesizeMouse(target, toX, rect.height / 2, { type: 'mouseup' }, target.ownerGlobal);
  return promise;
}

function goToMultipleLayouts(callback) {
  return new Promise(async (resolve) => {
    await SpecialPowers.pushPrefEnv({
      set: [['zen.view.use-single-toolbar', false]],
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
