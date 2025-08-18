/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

async function removeFolder(folder) {
  if (!folder) return;
  const removeEvent = BrowserTestUtils.waitForEvent(folder, 'TabGroupRemoved');
  folder.delete();
  await removeEvent;
}
