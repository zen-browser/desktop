/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Welcome_Steps() {
  const selectedTab = gBrowser.selectedTab;
  await new Promise((resolve) => {
    setTimeout(async () => {
      await waitForFocus();
      await EventUtils.synthesizeMouseAtCenter(
        document.getElementById('zen-welcome-start-button'),
        {}
      );
      setTimeout(() => {
        resolve();
      }, 4000); // Wait for the transition to complete
    }, 2000); // Give tons of time for the welcome start button to be clicked
  });
  ok(true, 'Welcome start button clicked successfully');

  const welcomeContent = document.getElementById('zen-welcome-page-content');

  for (const button of document.querySelectorAll('#zen-welcome-page-sidebar-buttons button')) {
    ok(
      getComputedStyle(button).pointerEvents !== 'none',
      `Button with l10n-id "${button.getAttribute('data-l10n-id')}" should be clickable`
    );
  }

  await goNextWelcomePage('zen-welcome-skip-button');
  ok(true, 'Welcome Import Step Test Finished');

  Assert.greater(
    welcomeContent.children.length,
    0,
    'Welcome page content should have children after clicking next action'
  );

  for (const child of welcomeContent.children) {
    console.log(child);
    ok(
      child.querySelector('img').getAttribute('src').includes('blob:'),
      'Welcome page content should have an image with a base64 data URL'
    );
  }

  await EventUtils.synthesizeMouseAtCenter(welcomeContent.children[1], {});

  await new Promise((resolve) => {
    setTimeout(async () => {
      let engineName = await Services.search.getDefault();
      const selectedLabel = welcomeContent.children[1];
      ok(selectedLabel.querySelector('input').checked, 'The selected label should be checked');
      Assert.equal(
        engineName.name,
        selectedLabel.querySelector('label').textContent.trim(),
        'The default search engine should match the selected label'
      );
      resolve();
    }, 100); // Wait for the transition to complete
  });

  await goNextWelcomePage('zen-welcome-next-action');
  ok(true, 'Welcome Search Step Test Finished');

  await new Promise((resolve) => {
    setTimeout(async () => {
      const essentials = welcomeContent.querySelector(
        '#zen-welcome-initial-essentials-browser-sidebar-essentials'
      ).children;
      Assert.greater(
        essentials.length,
        3,
        'Welcome page content should have more than 3 essentials after clicking next action'
      );
      await EventUtils.synthesizeMouseAtCenter(essentials[0], {});
      await EventUtils.synthesizeMouseAtCenter(essentials[1], {});
      await EventUtils.synthesizeMouseAtCenter(essentials[2], {});

      ok(
        essentials[0].hasAttribute('visuallyselected'),
        'The first essential should be visually selected'
      );
      ok(
        !essentials[1].hasAttribute('visuallyselected'),
        'The second essential should be visually selected'
      );
      ok(
        essentials[2].hasAttribute('visuallyselected'),
        'The third essential should be visually selected'
      );
      const urlsToCheck = [
        essentials[0].getAttribute('data-url'),
        essentials[2].getAttribute('data-url'),
      ];
      for (const url of urlsToCheck) {
        ok(url.startsWith('https://'), `The URL "${url}" should start with "https://"`);
      }

      await goNextWelcomePage('zen-welcome-next-action');

      await new Promise((resolve) => {
        setTimeout(async () => {
          for (const url of urlsToCheck) {
            ok(
              await PlacesUtils.history.hasVisits(url),
              `The URL "${url}" should have visits in history`
            );
          }
          resolve();
        }, 1000); // Wait for the transition to complete
      });
      resolve();
    }, 1000); // Wait for the transition to complete
  });

  await goNextWelcomePage('zen-welcome-next-action');
  ok(true, 'Welcome Theme Step Test Finished');

  await goNextWelcomePage('zen-welcome-start-browsing');
  ok(true, 'Welcome Finish Step Test Finished');

  await new Promise((resolve) => {
    setTimeout(async () => {
      Assert.greater(
        gBrowser._numZenEssentials,
        2,
        'There should be more than 2 Zen Essentials after the welcome process'
      );
      Assert.equal(
        gBrowser.tabs.filter((tab) => tab.pinned && !tab.hasAttribute('zen-essential')).length,
        2,
        'There should be 2 pinned tabs after the welcome process'
      );

      gBrowser.selectedTab = selectedTab;
      for (const tab of gBrowser.tabs) {
        if (tab.pinned) {
          if (!tab.hasAttribute('zen-essential')) {
            ok(
              tab.hasAttribute('zen-workspace-id'),
              'Pinned tabs should have a zen-workspace-id attribute'
            );
          }
          ok(tab.hasAttribute('zen-pin-id'), 'Pinned tabs should have a zen-pin-id attribute');
          await BrowserTestUtils.removeTab(tab);
        }
      }
      resolve();
    }, 8000); // Wait for the transition to complete
  });
  ok(true, 'Welcome process completed successfully');
});
