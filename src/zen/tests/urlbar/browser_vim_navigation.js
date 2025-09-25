/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

ChromeUtils.defineESModuleGetters(this, {
  UrlbarTestUtils: 'resource://testing-common/UrlbarTestUtils.sys.mjs',
});

add_task(async function test_Vim_Navigation() {
  gURLBar.blur();

  await SpecialPowers.pushPrefEnv({
    set: [['zen.urlbar.vim-navigation.enabled', true]],
  });

  await SimpleTest.promiseFocus(window);
  document.getElementById('Browser:OpenLocation').doCommand();
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    waitForFocus: SimpleTest.waitForFocus,
    // This value yields several results in the urlbar
    value: 'a',
  });

  // Ctrl+j and down should work to move the selection down
  EventUtils.synthesizeKey('j', { ctrlKey: true }, window);
  // Move down one more time so the next assertion doesn't land on the start
  EventUtils.synthesizeKey('j', { ctrlKey: true }, window);
  EventUtils.synthesizeKey('VK_DOWN', {}, window);

  ok(
    UrlbarTestUtils.getSelectedRowIndex(window) == 3,
    'Ctrl+j and down should change the selection'
  );

  // Ctrl+k and up should work to move the selection up
  EventUtils.synthesizeKey('k', { ctrlKey: true }, window);
  EventUtils.synthesizeKey('VK_UP', {}, window);
  ok(UrlbarTestUtils.getSelectedRowIndex(window) == 1, 'Ctrl+k and up should change the selection');
});
