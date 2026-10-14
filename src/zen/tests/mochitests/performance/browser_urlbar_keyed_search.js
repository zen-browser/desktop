"use strict";

// This tests searching in the urlbar (a.k.a. the quantumbar).

/**
 * WHOA THERE: We should never be adding new things to
 * EXPECTED_REFLOWS_FIRST_OPEN or EXPECTED_REFLOWS_SECOND_OPEN.
 * Instead of adding reflows to these lists, you should be modifying your code
 * to avoid the reflow.
 *
 * See https://firefox-source-docs.mozilla.org/performance/bestpractices.html
 * for tips on how to do that.
 */

/* These reflows happen only the first time the panel opens. */
const EXPECTED_REFLOWS_FIRST_OPEN = [];

/* These reflows happen every time the panel opens. */
const EXPECTED_REFLOWS_SECOND_OPEN = [];

add_task(async function quantumbar() {
  await runUrlbarTest(
    true,
    EXPECTED_REFLOWS_FIRST_OPEN,
    EXPECTED_REFLOWS_SECOND_OPEN
  );
});
