/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const URL = `data:text/html,
  <!doctype html>
  <meta charset="utf-8">
  <div style="height: 200vh"></div>
  Some content
  <div style="height: 200vh"></div>
`;

function getScrollPos(browser) {
  return SpecialPowers.spawn(browser, [], () => {
    return {
      scrollY: Math.round(content.scrollY),
      scrollMaxY: Math.round(content.scrollMaxY),
    };
  });
}

// Bug 1964901
add_task(async function test_scroll_command() {
  await BrowserTestUtils.withNewTab(URL, async function (browser) {
    {
      let { scrollY, scrollMaxY } = await getScrollPos(browser);
      is(scrollY, 0, "Should be scrolled to the top");
      isnot(scrollMaxY, 0, "Should be scrollable");
    }
    let scrollEvent = SpecialPowers.spawn(browser, [], async () => {
      await new Promise(r => {
        content.addEventListener("scrollend", r, { once: true });
      });
    });
    goDoCommand("cmd_scrollBottom");
    await scrollEvent;
    {
      let { scrollY, scrollMaxY } = await getScrollPos(browser);
      is(scrollY, scrollMaxY, "Should be scrolled to the bottom");
    }
  });
});
