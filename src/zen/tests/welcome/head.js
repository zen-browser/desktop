/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

async function goNextWelcomePage(l10nId) {
  /* eslint-disable-next-line no-async-promise-executor */
  await new Promise(async resolve => {
    const button = document.querySelector(
      `#zen-welcome-page-sidebar-buttons button[data-l10n-id="${l10nId}"]`
    );
    if (!button) {
      throw new Error(`Button with l10n-id "${l10nId}" not found`);
    }
    await EventUtils.synthesizeMouseAtCenter(button, {});
    setTimeout(() => {
      setTimeout(() => {
        resolve();
      }, 0);
    }, 3000); // Wait for the transition to complete
  });
}

async function waitForFocus(...args) {
  await new Promise(resolve => SimpleTest.waitForFocus(resolve, ...args));
}

async function waitForWelcomeElement(getter, message, timeout = 15000) {
  await TestUtils.waitForCondition(getter, message, 100, timeout / 100);
  const element = getter();
  ok(element, message);
  return element;
}

async function waitForWelcomeSidebarTitle(l10nId, message) {
  return waitForWelcomeElement(
    () =>
      document.querySelector(
        `#zen-welcome-sidebar-title[data-l10n-id="${l10nId}"]`
      ),
    message || `Welcome sidebar title should be ${l10nId}`
  );
}

async function waitForClickableWelcomeButton(l10nId) {
  return waitForWelcomeElement(() => {
    const button = document.querySelector(
      `.zen-welcome-btn-row button[data-l10n-id="${l10nId}"]`
    );
    if (!button) {
      return null;
    }
    const style = getComputedStyle(button);
    if (style.pointerEvents === "none") {
      return null;
    }
    // Catch the opacity:0 regression where Next existed but was invisible.
    if (parseFloat(style.opacity) === 0) {
      return null;
    }
    const row = button.closest(".zen-welcome-btn-row");
    if (row && parseFloat(getComputedStyle(row).opacity) === 0) {
      return null;
    }
    return button;
  }, `Clickable welcome button ${l10nId} should appear`);
}

async function clickWelcomePrimaryButton(l10nId) {
  const button = await waitForClickableWelcomeButton(l10nId);
  await EventUtils.synthesizeMouseAtCenter(button, {});
  return button;
}

function assertWelcomeStepProgress(stepNum, totalSteps) {
  const pill = document.querySelector(".zen-welcome-step-pill");
  ok(pill, "Welcome step pill should exist");
  Assert.equal(
    pill.textContent.trim(),
    `Step ${stepNum} of ${totalSteps}`,
    `Step pill should read Step ${stepNum} of ${totalSteps}`
  );
  const dots = document.querySelectorAll(".zen-welcome-dots .zen-welcome-dot");
  Assert.equal(
    dots.length,
    totalSteps,
    `Progress dots should total ${totalSteps}`
  );
  const activeIndex = Array.from(dots).findIndex(dot =>
    dot.hasAttribute("active")
  );
  Assert.equal(
    activeIndex,
    stepNum - 1,
    `Active progress dot should match step ${stepNum}`
  );
}
