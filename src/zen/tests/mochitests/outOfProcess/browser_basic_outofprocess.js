/**
 * Verify that the colors were set properly. This has the effect of
 *  verifying that the processes are assigned for child frames correctly.
 */
async function verifyBaseFrameStructure(
  browsingContexts,
  testname,
  expectedHTML
) {
  function checkColorAndText(bc, desc, expectedColor, expectedText) {
    return SpecialPowers.spawn(
      bc,
      [expectedColor, expectedText, desc],
      (expectedColorChild, expectedTextChild, descChild) => {
        Assert.equal(
          content.document.documentElement.style.backgroundColor,
          expectedColorChild,
          descChild + " color"
        );
        Assert.equal(
          content.document.getElementById("insertPoint").innerHTML,
          expectedTextChild,
          descChild + " text"
        );
      }
    );
  }

  let useOOPFrames = gFissionBrowser;

  is(
    browsingContexts.length,
    TOTAL_FRAME_COUNT,
    "correct number of browsing contexts"
  );
  await checkColorAndText(
    browsingContexts[0],
    testname + " base",
    "white",
    expectedHTML.next().value
  );
  await checkColorAndText(
    browsingContexts[1],
    testname + " frame 1",
    useOOPFrames ? "seashell" : "white",
    expectedHTML.next().value
  );
  await checkColorAndText(
    browsingContexts[2],
    testname + " frame 1-1",
    useOOPFrames ? "seashell" : "white",
    expectedHTML.next().value
  );
  await checkColorAndText(
    browsingContexts[3],
    testname + " frame 2",
    useOOPFrames ? "lightcyan" : "white",
    expectedHTML.next().value
  );
  await checkColorAndText(
    browsingContexts[4],
    testname + " frame 2-1",
    useOOPFrames ? "seashell" : "white",
    expectedHTML.next().value
  );
  await checkColorAndText(
    browsingContexts[5],
    testname + " frame 2-2",
    useOOPFrames ? "lightcyan" : "white",
    expectedHTML.next().value
  );
  await checkColorAndText(
    browsingContexts[6],
    testname + " frame 2-3",
    useOOPFrames ? "palegreen" : "white",
    expectedHTML.next().value
  );
  await checkColorAndText(
    browsingContexts[7],
    testname + " frame 2-4",
    "white",
    expectedHTML.next().value
  );
}

/**
 * Test setting up all of the frames where a string of markup is passed
 * to initChildFrames.
 */
add_task(async function test_subframes_string() {
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    OOP_BASE_PAGE_URI
  );

  const markup = "<p>Text</p>";

  let browser = tab.linkedBrowser;
  let browsingContexts = await initChildFrames(browser, markup);

  function* getExpectedHTML() {
    for (let c = 1; c <= TOTAL_FRAME_COUNT; c++) {
      yield markup;
    }
    ok(false, "Frame count does not match actual number of frames");
  }
  await verifyBaseFrameStructure(browsingContexts, "string", getExpectedHTML());

  BrowserTestUtils.removeTab(tab);
});

/**
 * Test setting up all of the frames where a function that returns different markup
 * is passed to initChildFrames.
 */
add_task(async function test_subframes_function() {
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    OOP_BASE_PAGE_URI
  );
  let browser = tab.linkedBrowser;

  let counter = 0;
  let browsingContexts = await initChildFrames(browser, function () {
    return "<p>Text " + ++counter + "</p>";
  });

  is(
    counter,
    TOTAL_FRAME_COUNT,
    "insert HTML function called the correct number of times"
  );

  function* getExpectedHTML() {
    for (let c = 1; c <= TOTAL_FRAME_COUNT; c++) {
      yield "<p>Text " + c + "</p>";
    }
  }
  await verifyBaseFrameStructure(
    browsingContexts,
    "function",
    getExpectedHTML()
  );

  BrowserTestUtils.removeTab(tab);
});
