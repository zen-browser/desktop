"use strict";

ChromeUtils.defineESModuleGetters(this, {
  AboutNewTab: "resource:///modules/AboutNewTab.sys.mjs",
  PerfTestHelpers: "resource://testing-common/PerfTestHelpers.sys.mjs",
  PlacesTestUtils: "resource://testing-common/PlacesTestUtils.sys.mjs",
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
  UrlbarUtils: "moz-src:///browser/components/urlbar/UrlbarUtils.sys.mjs",
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

/**
 * This function can be called if the test needs to trigger frame dirtying
 * outside of the normal mechanism.
 *
 * @param win (dom window)
 *        The window in which the frame tree needs to be marked as dirty.
 */
function dirtyFrame(win) {
  let dwu = win.windowUtils;
  try {
    dwu.ensureDirtyRootFrame();
  } catch (e) {
    // If this fails, we should probably make note of it, but it's not fatal.
    info("Note: ensureDirtyRootFrame threw an exception:" + e);
  }
}

/**
 * Async utility function to collect the stacks of uninterruptible reflows
 * occuring during some period of time in a window.
 *
 * @param testPromise (Promise)
 *        A promise that is resolved when the data collection should stop.
 *
 * @param win (browser window, optional)
 *        The browser window to monitor. Defaults to the current window.
 *
 * @return An array of reflow stacks and paths
 */
async function recordReflows(testPromise, win = window) {
  // Collect all reflow stacks, we'll process them later.
  let reflows = [];

  let observer = {
    reflow() {
      // Gather information about the current code path.
      let stack = new Error().stack;
      let path = stack
        .trim()
        .split("\n")
        .slice(1) // the first frame which is our test code.
        .map(line => line.replace(/:\d+:\d+$/, "")); // strip line numbers.

      // Stack trace is empty. Reflow was triggered by native code, which
      // we ignore.
      if (path.length === 0) {
        ChromeUtils.addProfilerMarker(
          "ignoredNativeReflow",
          { category: "Test" },
          "Intentionally ignoring reflow without JS stack"
        );
        return;
      }

      if (
        path[0] ===
        "forceRefreshDriverTick@chrome://mochikit/content/tests/SimpleTest/AccessibilityUtils.js"
      ) {
        // a11y-checks fake a refresh driver tick.
        return;
      }

      reflows.push({ stack, path: path.join("|") });

      // Just in case, dirty the frame now that we've reflowed. This will
      // allow us to detect additional reflows that occur in this same tick
      // of the event loop.
      ChromeUtils.addProfilerMarker(
        "dirtyFrame",
        { category: "Test" },
        "Intentionally dirtying the frame to help ensure that synchrounous " +
          "reflows will be detected."
      );
      dirtyFrame(win);
    },

    reflowInterruptible() {
      // Interruptible reflows are always triggered by native code, like the
      // refresh driver. These are fine.
    },

    QueryInterface: ChromeUtils.generateQI([
      "nsIReflowObserver",
      "nsISupportsWeakReference",
    ]),
  };

  let docShell = win.docShell;
  docShell.addWeakReflowObserver(observer);

  let dirtyFrameFn = event => {
    if (event.type != "MozAfterPaint") {
      dirtyFrame(win);
    }
  };
  Services.els.addListenerForAllEvents(win, dirtyFrameFn, true);

  try {
    dirtyFrame(win);
    await testPromise;
  } finally {
    Services.els.removeListenerForAllEvents(win, dirtyFrameFn, true);
    docShell.removeWeakReflowObserver(observer);
  }

  return reflows;
}

/**
 * Utility function to report unexpected reflows.
 *
 * @param reflows (Array)
 *        An array of reflow stacks returned by recordReflows.
 *
 * @param expectedReflows (Array, optional)
 *        An Array of Objects representing reflows.
 *
 *        Example:
 *
 *        [
 *          {
 *            // This reflow is caused by lorem ipsum.
 *            // Sometimes, due to unpredictable timings, the reflow may be hit
 *            // less times.
 *            stack: [
 *              "somefunction@chrome://somepackage/content/somefile.mjs",
 *              "otherfunction@chrome://otherpackage/content/otherfile.js",
 *              "morecode@resource://somewhereelse/SomeModule.sys.mjs",
 *            ],
 *            // We expect this particular reflow to happen up to 2 times.
 *            maxCount: 2,
 *          },
 *
 *          {
 *            // This reflow is caused by lorem ipsum. We expect this reflow
 *            // to only happen once, so we can omit the "maxCount" property.
 *            stack: [
 *              "somefunction@chrome://somepackage/content/somefile.mjs",
 *              "otherfunction@chrome://otherpackage/content/otherfile.js",
 *              "morecode@resource://somewhereelse/SomeModule.sys.mjs",
 *            ],
 *          }
 *        ]
 *
 *        Note that line numbers are not included in the stacks.
 *
 *        Order of the reflows doesn't matter. Expected reflows that aren't seen
 *        will cause an assertion failure. When this argument is not passed,
 *        it defaults to the empty Array, meaning no reflows are expected.
 */
function reportUnexpectedReflows(reflows, expectedReflows = []) {
  let knownReflows = expectedReflows.map(r => {
    return {
      stack: r.stack,
      path: r.stack.join("|"),
      count: 0,
      maxCount: r.maxCount || 1,
      actualStacks: new Map(),
    };
  });
  let unexpectedReflows = new Map();

  if (knownReflows.some(r => r.path.includes("*"))) {
    Assert.ok(
      false,
      "Do not include async frames in the stack, as " +
        "that feature is not available on all trees."
    );
  }

  for (let { stack, path } of reflows) {
    // Functions from EventUtils.js calculate coordinates and
    // dimensions, causing us to reflow. That's the test
    // harness and we don't care about that, so we'll filter that out.
    if (
      /^(synthesize|send|createDragEventObject).*?@chrome:\/\/mochikit.*?EventUtils\.js/.test(
        path
      )
    ) {
      continue;
    }

    let index = knownReflows.findIndex(reflow => path.startsWith(reflow.path));
    if (index != -1) {
      let reflow = knownReflows[index];
      ++reflow.count;
      reflow.actualStacks.set(stack, (reflow.actualStacks.get(stack) || 0) + 1);
    } else {
      unexpectedReflows.set(stack, (unexpectedReflows.get(stack) || 0) + 1);
    }
  }

  let formatStack = stack =>
    stack
      .split("\n")
      .slice(1)
      .map(frame => "  " + frame)
      .join("\n");
  for (let reflow of knownReflows) {
    let firstFrame = reflow.stack[0];
    if (!reflow.count) {
      Assert.ok(
        false,
        `Unused expected reflow at ${firstFrame}:\nStack:\n` +
          reflow.stack.map(frame => "  " + frame).join("\n") +
          "\n" +
          "This is probably a good thing - just remove it from the list of reflows."
      );
    } else {
      if (reflow.count > reflow.maxCount) {
        Assert.ok(
          false,
          `reflow at ${firstFrame} was encountered ${reflow.count} times,\n` +
            `it was expected to happen up to ${reflow.maxCount} times.`
        );
      } else {
        todo(
          false,
          `known reflow at ${firstFrame} was encountered ${reflow.count} times`
        );
      }
      for (let [stack, count] of reflow.actualStacks) {
        info(
          "Full stack" +
            (count > 1 ? ` (hit ${count} times)` : "") +
            ":\n" +
            formatStack(stack)
        );
      }
    }
  }

  for (let [stack, count] of unexpectedReflows) {
    let location = stack.split("\n")[1].replace(/:\d+:\d+$/, "");
    Assert.ok(
      false,
      `unexpected reflow at ${location} hit ${count} times\n` +
        "Stack:\n" +
        formatStack(stack)
    );
  }
  Assert.ok(
    !unexpectedReflows.size,
    unexpectedReflows.size + " unexpected reflows"
  );
}

async function ensureNoPreloadedBrowser(win = window) {
  // If we've got a preloaded browser, get rid of it so that it
  // doesn't interfere with the test if it's loading. We have to
  // do this before we disable preloading or changing the new tab
  // URL, otherwise _getPreloadedBrowser will return null, despite
  // the preloaded browser existing.
  NewTabPagePreloading.removePreloadedBrowser(win);

  await SpecialPowers.pushPrefEnv({
    set: [["browser.newtab.preload", false]],
  });

  AboutNewTab.newTabURL = "about:blank";

  registerCleanupFunction(() => {
    AboutNewTab.resetNewTabURL();
  });
}

// Onboarding puts a badge on the fxa toolbar button a while after startup
// which confuses tests that look at repaints in the toolbar.  Use this
// function to cancel the badge update.
function disableFxaBadge() {
  let { ToolbarBadgeHub } = ChromeUtils.importESModule(
    "resource:///modules/asrouter/ToolbarBadgeHub.sys.mjs"
  );
  ToolbarBadgeHub.removeAllNotifications();

  // Also prevent a new timer from being set
  return SpecialPowers.pushPrefEnv({
    set: [["identity.fxaccounts.toolbar.accessed", true]],
  });
}

// Ensure updating Unified Search Button icon by user interaction before
// tests. This prevents the search engine logo from appearing in the urlbar
// during the test, which would cause unexpected visual changes.
async function ensureSearchIconVisible() {
  if (
    Services.prefs.getBoolPref("browser.urlbar.scotchBonnet.enableOverride")
  ) {
    let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser);
    BrowserTestUtils.removeTab(tab);
    await TestUtils.waitForCondition(
      () =>
        UrlbarTestUtils.getSearchModeSwitcherIcon(window) !=
        UrlbarShared.ICON.SEARCH_GLASS
    );
  }
}

function rectInBoundingClientRect(r, bcr) {
  return (
    bcr.x <= r.x1 &&
    bcr.y <= r.y1 &&
    bcr.x + bcr.width >= r.x2 &&
    bcr.y + bcr.height >= r.y2
  );
}

async function getBookmarksToolbarRect() {
  // Temporarily open the bookmarks toolbar to measure its rect
  let bookmarksToolbar = gNavToolbox.querySelector("#PersonalToolbar");
  let wasVisible = !bookmarksToolbar.collapsed;
  if (!wasVisible) {
    setToolbarVisibility(bookmarksToolbar, true, false, false);
    await TestUtils.waitForCondition(
      () => bookmarksToolbar.getBoundingClientRect().height > 0,
      "wait for non-zero bookmarks toolbar height"
    );
  }
  let bookmarksToolbarRect = bookmarksToolbar.getBoundingClientRect();
  if (!wasVisible) {
    setToolbarVisibility(bookmarksToolbar, false, false, false);
    await TestUtils.waitForCondition(
      () => bookmarksToolbar.getBoundingClientRect().height == 0,
      "wait for zero bookmarks toolbar height"
    );
  }
  return bookmarksToolbarRect;
}

async function ensureAnimationsFinished(win = window) {
  let animations = win.document.getAnimations();
  info(`Waiting for ${animations.length} animations`);
  await Promise.allSettled(animations.map(a => a.finished));
}

async function prepareSettledWindow() {
  let win = await BrowserTestUtils.openNewBrowserWindow();
  await ensureNoPreloadedBrowser(win);
  await ensureAnimationsFinished(win);
  return win;
}

/**
 * Calculate and return how many additional tabs can be fit into the
 * tabstrip without causing it to overflow.
 *
 * @return int
 *         The maximum additional tabs that can be fit into the
 *         tabstrip without causing it to overflow.
 */
function computeMaxTabCount() {
  let currentTabCount = gBrowser.tabs.length;
  let newTabButton = gBrowser.tabContainer.newTabButton;
  let newTabRect = newTabButton.getBoundingClientRect();
  let tabStripRect =
    gBrowser.tabContainer.arrowScrollbox.getBoundingClientRect();
  let availableTabStripWidth = tabStripRect.width - newTabRect.width;

  let tabMinWidth = parseInt(
    getComputedStyle(gBrowser.selectedTab, null).minWidth,
    10
  );

  let maxTabCount =
    Math.floor(availableTabStripWidth / tabMinWidth) - currentTabCount;
  Assert.greater(
    maxTabCount,
    0,
    "Tabstrip needs to be wide enough to accomodate at least 1 more tab " +
      "without overflowing."
  );
  return maxTabCount;
}

/**
 * Helper function that opens up some number of about:blank tabs, and wait
 * until they're all fully open.
 *
 * @param howMany (int)
 *        How many about:blank tabs to open.
 */
async function createTabs(howMany) {
  let uris = [];
  while (howMany--) {
    uris.push("about:blank");
  }

  gBrowser.loadTabs(uris, {
    inBackground: true,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });

  await TestUtils.waitForCondition(() => {
    return Array.from(gBrowser.tabs).every(tab => tab._fullyOpen);
  });
}

/**
 * Removes all of the tabs except the originally selected
 * tab, and waits until all of the DOM nodes have been
 * completely removed from the tab strip.
 */
async function removeAllButFirstTab() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.tabs.warnOnCloseOtherTabs", false]],
  });
  gBrowser.removeAllTabsBut(gBrowser.tabs[0]);
  await TestUtils.waitForCondition(() => gBrowser.tabs.length == 1);
  await SpecialPowers.popPrefEnv();
}

/**
 * Adds some entries to the Places database so that we can
 * do semi-realistic look-ups in the URL bar.
 *
 * @param searchStr (string)
 *        Optional text to add to the search history items.
 */
async function addDummyHistoryEntries(searchStr = "") {
  await PlacesUtils.history.clear();
  const NUM_VISITS = 10;
  let visits = [];

  for (let i = 0; i < NUM_VISITS; ++i) {
    visits.push({
      // eslint-disable-next-line sdl/no-insecure-url
      uri: `http://example.com/urlbar-reflows-${i}`,
      title: `Reflow test for URL bar entry #${i} - ${searchStr}`,
    });
  }

  await PlacesTestUtils.addVisits(visits);

  registerCleanupFunction(async function () {
    await PlacesUtils.history.clear();
  });
}

/**
 * Async utility function to capture a screenshot of each painted frame.
 *
 * @param testPromise (Promise)
 *        A promise that is resolved when the data collection should stop.
 *
 * @param win (browser window, optional)
 *        The browser window to monitor. Defaults to the current window.
 *
 * @return An array of screenshots
 */
async function recordFrames(testPromise, win = window) {
  let canvas = win.document.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "canvas"
  );
  canvas.mozOpaque = true;
  let ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });

  let frames = [];

  let afterPaintListener = () => {
    let width, height;
    canvas.width = width = win.innerWidth;
    canvas.height = height = win.innerHeight;
    ctx.drawWindow(
      win,
      0,
      0,
      width,
      height,
      "white",
      ctx.DRAWWINDOW_DO_NOT_FLUSH |
        ctx.DRAWWINDOW_DRAW_VIEW |
        ctx.DRAWWINDOW_ASYNC_DECODE_IMAGES |
        ctx.DRAWWINDOW_USE_WIDGET_LAYERS
    );
    let data = Cu.cloneInto(ctx.getImageData(0, 0, width, height).data, {});
    if (frames.length) {
      // Compare this frame with the previous one to avoid storing duplicate
      // frames and running out of memory.
      let previous = frames[frames.length - 1];
      if (previous.width == width && previous.height == height) {
        let equals = true;
        for (let i = 0; i < data.length; ++i) {
          if (data[i] != previous.data[i]) {
            equals = false;
            break;
          }
        }
        if (equals) {
          return;
        }
      }
    }
    frames.push({ data, width, height });
  };
  win.addEventListener("MozAfterPaint", afterPaintListener);

  // If the test is using an existing window, capture a frame immediately.
  if (
    win.document.readyState == "complete" &&
    win.location.href != "about:blank"
  ) {
    afterPaintListener();
  }

  try {
    await testPromise;
  } finally {
    win.removeEventListener("MozAfterPaint", afterPaintListener);
  }

  return frames;
}

// How many identical pixels to accept between 2 rects when deciding to merge
// them. This needs to be at least as big as the size of the margin between 2
// tabs so 2 consecutive tabs being repainted at once are counted as a single
// changed rect.
const kMaxEmptyPixels = 4;
function compareFrames(frame, previousFrame) {
  // Accessing the Math global is expensive as the test executes in a
  // non-syntactic scope. Accessing it as a lexical variable is enough
  // to make the code JIT well.
  const M = Math;

  function expandRect(x, y, rect) {
    if (rect.x2 < x) {
      rect.x2 = x;
    } else if (rect.x1 > x) {
      rect.x1 = x;
    }
    if (rect.y2 < y) {
      rect.y2 = y;
    }
  }

  function isInRect(x, y, rect) {
    return (
      (rect.y2 == y || rect.y2 == y - 1) && rect.x1 - 1 <= x && x <= rect.x2 + 1
    );
  }

  if (
    frame.height != previousFrame.height ||
    frame.width != previousFrame.width
  ) {
    // If the frames have different sizes, assume the whole window has
    // been repainted when the window was resized.
    return [{ x1: 0, x2: frame.width, y1: 0, y2: frame.height }];
  }

  let l = frame.data.length;
  let different = [];
  let rects = [];
  for (let i = 0; i < l; i += 4) {
    let x = (i / 4) % frame.width;
    let y = M.floor(i / 4 / frame.width);
    for (let j = 0; j < 4; ++j) {
      let index = i + j;

      if (frame.data[index] != previousFrame.data[index]) {
        let found = false;
        for (let rect of rects) {
          if (isInRect(x, y, rect)) {
            expandRect(x, y, rect);
            found = true;
            break;
          }
        }
        if (!found) {
          rects.unshift({ x1: x, x2: x, y1: y, y2: y });
        }

        different.push(i);
        break;
      }
    }
  }
  rects.reverse();

  // The following code block merges rects that are close to each other
  // (less than kMaxEmptyPixels away).
  // This is needed to avoid having a rect for each letter when a label moves.
  let areRectsContiguous = function (r1, r2) {
    return (
      r1.y2 >= r2.y1 - 1 - kMaxEmptyPixels &&
      r2.x1 - 1 - kMaxEmptyPixels <= r1.x2 &&
      r2.x2 >= r1.x1 - 1 - kMaxEmptyPixels
    );
  };
  let hasMergedRects;
  do {
    hasMergedRects = false;
    for (let r = rects.length - 1; r > 0; --r) {
      let rr = rects[r];
      for (let s = r - 1; s >= 0; --s) {
        let rs = rects[s];
        if (areRectsContiguous(rs, rr)) {
          rs.x1 = Math.min(rs.x1, rr.x1);
          rs.y1 = Math.min(rs.y1, rr.y1);
          rs.x2 = Math.max(rs.x2, rr.x2);
          rs.y2 = Math.max(rs.y2, rr.y2);
          rects.splice(r, 1);
          hasMergedRects = true;
          break;
        }
      }
    }
  } while (hasMergedRects);

  // For convenience, pre-compute the width and height of each rect.
  rects.forEach(r => {
    r.w = r.x2 - r.x1 + 1;
    r.h = r.y2 - r.y1 + 1;
  });

  return rects;
}

let _artifactCounter = 0;

/**
 * Creates and uploads an animated PNG artifact showing flicker between two frames.
 *
 * The APNG contains three frames:
 * - Previous frame with "Frame N" label
 * - Current frame with "Frame N+1" label
 * - Difference frame highlighting changed areas (orange for expected, red for unexpected)
 *
 * Uploads to MOZ_UPLOAD_DIR if set, otherwise logs as base64 data URI.
 */
async function reportFlickerWithAPNG(
  previousFrame,
  currentFrame,
  frameIndex,
  expectedRects
) {
  let apngBytes = createAnimatedPNG(
    previousFrame,
    currentFrame,
    frameIndex,
    expectedRects
  );
  if (apngBytes) {
    _artifactCounter++;
    let testName = "flicker_test";
    if (typeof gTestPath === "string") {
      testName = gTestPath.split("/").pop().replace(/\.js$/, "");
    }
    let filename = `${testName}_flicker_detected_${_artifactCounter}.png`;

    let uploadDir = Services.env.get("MOZ_UPLOAD_DIR");
    if (uploadDir) {
      let file = PathUtils.join(uploadDir, filename);
      await IOUtils.write(file, Uint8Array.from(apngBytes));
      Assert.ok(false, `See the ${filename} APNG artifact`);
    } else {
      let binary = "";
      for (let i = 0; i < apngBytes.length; i++) {
        binary += String.fromCharCode(apngBytes[i]);
      }
      let base64 = btoa(binary);
      info(`data:image/png;base64,${base64}`);
      Assert.ok(
        false,
        "Set MOZ_UPLOAD_DIR environment variable to save APNG artifacts"
      );
    }
  }
}

/**
 * Helper function to add text overlay to a canvas
 */
function addTextOverlay(canvas, text) {
  let ctx = canvas.getContext("2d");
  ctx.font = "bold 32px Arial";
  ctx.fillStyle = "yellow";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 4;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let x = canvas.width / 2;
  let y = canvas.height / 2;

  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

/**
 * Helper to create canvas frame with overlay text
 */
function createFrameWithOverlay(frameData, width, height, overlayText) {
  let canvas = document.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "canvas"
  );
  canvas.width = width;
  canvas.height = height;
  let ctx = canvas.getContext("2d");
  ctx.putImageData(new ImageData(frameData, width, height), 0, 0);
  addTextOverlay(canvas, overlayText);
  return ctx.getImageData(0, 0, width, height).data;
}

function createAnimatedPNG(
  previousFrame,
  currentFrame,
  frameIndex,
  expectedRects
) {
  const { width, height } = previousFrame;

  let apngFrames = [
    {
      data: createFrameWithOverlay(
        previousFrame.data,
        width,
        height,
        `Frame ${frameIndex}`
      ),
      delay: 1500,
    },
    {
      data: createFrameWithOverlay(
        currentFrame.data,
        width,
        height,
        `Frame ${frameIndex + 1}`
      ),
      delay: 1500,
    },
    {
      data: createDifferenceHighlight(
        previousFrame,
        currentFrame,
        expectedRects
      ),
      delay: 2000,
    },
  ];
  // Start APNG encoding
  let encoder = Cc[
    "@mozilla.org/image/encoder;2?type=image/png"
  ].createInstance(Ci.imgIEncoder);
  encoder.startImageEncode(
    width,
    height,
    encoder.INPUT_FORMAT_RGBA,
    `frames=${apngFrames.length};plays=0;skipfirstframe=no`
  );
  let stride = width * 4;
  for (let frame of apngFrames) {
    encoder.addImageFrame(
      frame.data,
      frame.data.length,
      width,
      height,
      stride,
      encoder.INPUT_FORMAT_RGBA,
      `delay=${frame.delay}`
    );
  }
  encoder.endImageEncode();

  let rawStream = encoder.QueryInterface(Ci.nsIInputStream);
  let binaryStream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(
    Ci.nsIBinaryInputStream
  );
  binaryStream.setInputStream(rawStream);
  let available = binaryStream.available();
  if (available === 0) {
    return null;
  }
  return binaryStream.readByteArray(available);
}

function createDifferenceHighlight(frame1, frame2, expectedRects) {
  const width = frame1.width;
  const height = frame1.height;

  // Validate dimensions
  if (
    width <= 0 ||
    height <= 0 ||
    !frame2.data ||
    frame2.data.length !== width * height * 4
  ) {
    let canvas = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "canvas"
    );
    canvas.width = 1;
    canvas.height = 1;
    let ctx = canvas.getContext("2d");
    return ctx.getImageData(0, 0, 1, 1).data;
  }

  let canvas = document.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "canvas"
  );
  canvas.width = width;
  canvas.height = height;
  let ctx = canvas.getContext("2d");
  let rects = [];

  try {
    ctx.putImageData(new ImageData(frame2.data, width, height), 0, 0);

    rects = compareFrames(frame2, frame1);

    const isExpected = rect =>
      expectedRects.some(
        exp =>
          exp.x1 === rect.x1 &&
          exp.y1 === rect.y1 &&
          exp.w === rect.w &&
          exp.h === rect.h
      );

    for (let rect of rects) {
      // Use orange for expected changes, red for unexpected
      const expected = isExpected(rect);
      ctx.strokeStyle = expected ? "orange" : "red";
      ctx.lineWidth = 2;
      ctx.fillStyle = expected
        ? "rgba(255, 165, 0, 0.2)"
        : "rgba(255, 0, 0, 0.2)";

      // Draw the red rectangle (same for all)
      ctx.fillRect(rect.x1, rect.y1, rect.w, rect.h);
      ctx.strokeRect(rect.x1, rect.y1, rect.w, rect.h);

      // For small flicker, also draw a larger circle
      let area = rect.w * rect.h;
      let minDimension = Math.min(rect.w, rect.h);

      if (area < 100 || minDimension < 10) {
        let centerX = rect.x1 + rect.w / 2;
        let centerY = rect.y1 + rect.h / 2;
        let radius = Math.max(20, Math.max(rect.w, rect.h) / 2 + 10);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    let unexpectedCount = rects.filter(r => !isExpected(r)).length;
    let expectedCount = expectedRects.length;
    addTextOverlay(
      canvas,
      `${rects.length} changes (${unexpectedCount} unexpected, ${expectedCount} expected)`
    );
  } catch (e) {
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, width, height);
  }

  return ctx.getImageData(0, 0, width, height).data;
}

/**
 * Utility function to report unexpected changed areas on screen.
 *
 * @param frames (Array)
 *        An array of frames captured by recordFrames.
 *
 * @param expectations (Object)
 *        An Object indicating which changes on screen are expected.
 *        If can contain the following optional fields:
 *         - filter: a function used to exclude changed rects that are expected.
 *            It takes the following parameters:
 *             - rects: an array of changed rects
 *             - frame: the current frame
 *             - previousFrame: the previous frame
 *            It returns an array of rects. This array is typically a copy of
 *            the rects parameter, from which identified expected changes have
 *            been excluded.
 *         - exceptions: an array of objects describing known flicker bugs.
 *           Example:
 *             exceptions: [
 *               {name: "bug 1nnnnnn - the foo icon shouldn't flicker",
 *                condition: r => r.w == 14 && r.y1 == 0 && ... }
 *               },
 *               {name: "bug ...
 *             ]
 */
async function reportUnexpectedFlicker(frames, expectations) {
  info("comparing " + frames.length + " frames");

  let unexpectedRects = 0;
  for (let i = 1; i < frames.length; ++i) {
    let frame = frames[i],
      previousFrame = frames[i - 1];
    let allRects = compareFrames(frame, previousFrame);

    let rectText = r => `${r.toSource()}, window width: ${frame.width}`;

    // Track which rects are expected (caught by exceptions)
    let expectedRects = [];
    let rects = allRects.filter(rect => {
      for (let e of expectations.exceptions || []) {
        if (e.condition(rect)) {
          todo(false, e.name + ", " + rectText(rect));
          expectedRects.push(rect);
          return false;
        }
      }
      return true;
    });

    if (expectations.filter) {
      rects = expectations.filter(rects, frame, previousFrame);
    }

    if (!rects.length) {
      continue;
    }

    ok(
      false,
      `unexpected ${rects.length} changed rects: ${rects
        .map(rectText)
        .join(", ")}`
    );

    await reportFlickerWithAPNG(previousFrame, frame, i, expectedRects);
    unexpectedRects += rects.length;
  }
  is(unexpectedRects, 0, "should have 0 unknown flickering areas");
}

/**
 * This is the main function that performance tests in this folder will call.
 *
 * The general idea is that individual tests provide a test function (testFn)
 * that will perform some user interactions we care about (eg. open a tab), and
 * this withPerfObserver function takes care of setting up and removing the
 * observers and listener we need to detect common performance issues.
 *
 * Once testFn is done, withPerfObserver will analyse the collected data and
 * report anything unexpected.
 *
 * @param testFn (async function)
 *        An async function that exercises some part of the browser UI.
 *
 * @param exceptions (object, optional)
 *        An Array of Objects representing expectations and known issues.
 *        It can contain the following fields:
 *         - expectedReflows: an array of expected reflow stacks.
 *           (see the comment above reportUnexpectedReflows for an example)
 *         - frames: an object setting expectations for what will change
 *           on screen during the test, and the known flicker bugs.
 *           (see the comment above reportUnexpectedFlicker for an example)
 */
async function withPerfObserver(testFn, exceptions = {}, win = window) {
  let resolveFn, rejectFn;
  let promiseTestDone = new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  let promiseReflows = recordReflows(promiseTestDone, win);
  let promiseFrames = recordFrames(promiseTestDone, win);

  testFn().then(resolveFn, rejectFn);
  await promiseTestDone;

  let reflows = await promiseReflows;
  reportUnexpectedReflows(reflows, exceptions.expectedReflows);

  let frames = await promiseFrames;
  await reportUnexpectedFlicker(frames, exceptions.frames);
}

/**
 * This test ensures that there are no unexpected
 * uninterruptible reflows when typing into the URL bar
 * with the default values in Places.
 *
 * @param {bool} keyed
 *        Pass true to synthesize typing the search string one key at a time.
 * @param {Array} expectedReflowsFirstOpen
 *        The array of expected reflow stacks when the panel is first opened.
 * @param {Array} [expectedReflowsSecondOpen]
 *        The array of expected reflow stacks when the panel is subsequently
 *        opened, if you're testing opening the panel twice.
 */
async function runUrlbarTest(
  keyed,
  expectedReflowsFirstOpen,
  expectedReflowsSecondOpen = null
) {
  const SEARCH_TERM = keyed ? "" : "urlbar-reflows-" + Date.now();
  await addDummyHistoryEntries(SEARCH_TERM);

  let win = await prepareSettledWindow();

  let URLBar = win.gURLBar;

  URLBar.focus();
  URLBar.value = SEARCH_TERM;

  let BACKGROUND_LEFT, BACKGROUND_RIGHT;
  let SHADOW_OVERFLOW_LEFT, SHADOW_OVERFLOW_RIGHT, SHADOW_OVERFLOW_TOP;
  let VERTICAL_OFFSET;

  let testFn = async function () {
    let popup = URLBar.view;
    let oldOnQueryResults = popup.onQueryResults.bind(popup);
    let oldOnQueryFinished = popup.onQueryFinished.bind(popup);

    // We need to invalidate the frame tree outside of the normal
    // mechanism since invalidations and result additions to the
    // URL bar occur without firing JS events (which is how we
    // normally know to dirty the frame tree).
    popup.onQueryResults = context => {
      dirtyFrame(win);
      oldOnQueryResults(context);
    };

    popup.onQueryFinished = context => {
      dirtyFrame(win);
      oldOnQueryFinished(context);
    };

    let waitExtra = async () => {
      // There are several setTimeout(fn, 0); calls inside autocomplete.xml
      // that we need to wait for. Since those have higher priority than
      // idle callbacks, we can be sure they will have run once this
      // idle callback is called. The timeout seems to be required in
      // automation - presumably because the machines can be pretty busy
      // especially if it's GC'ing from previous tests.
      await new Promise(resolve =>
        win.requestIdleCallback(resolve, { timeout: 1000 })
      );
    };

    if (keyed) {
      // Only keying in 6 characters because the number of reflows triggered
      // is so high that we risk timing out the test if we key in any more.
      let searchTerm = "ows-10";
      for (let i = 0; i < searchTerm.length; ++i) {
        let char = searchTerm[i];
        EventUtils.synthesizeKey(char, {}, win);
        await UrlbarTestUtils.promiseSearchComplete(win);
        await waitExtra();
      }
    } else {
      await UrlbarTestUtils.promiseAutocompleteResultPopup({
        window: win,
        waitForFocus: SimpleTest.waitForFocus,
        value: URLBar.value,
      });
      await waitExtra();
    }

    await UrlbarTestUtils.promisePopupClose(win);
    URLBar.value = "";
  };

  // Measure geometry once, outside of withPerfObserver, so the forced layout
  // and style reads below aren't counted as unexpected reflows during the
  // observed openings. This opens the panel, measures, then closes it.
  let measureGeometry = async function () {
    if (keyed) {
      EventUtils.synthesizeKey("ows-10"[0], {}, win);
    } else {
      await UrlbarTestUtils.promiseAutocompleteResultPopup({
        window: win,
        waitForFocus: SimpleTest.waitForFocus,
        value: URLBar.value,
      });
    }
    await UrlbarTestUtils.promiseSearchComplete(win);

    let shadowElem = win.document.querySelector("#urlbar > .urlbar-background");
    let shadow = getComputedStyle(shadowElem).boxShadow;
    let backgroundRect = shadowElem.getBoundingClientRect();

    let offsetElem = win.document.querySelector("#urlbar-container");
    let verticalOffset = getComputedStyle(offsetElem).paddingTop;

    function extractPixelValue(value) {
      if (value) {
        return parseInt(value.replace("px", ""), 10);
      }
      return 0;
    }

    function calculateShadowOverflow(boxShadow) {
      const regex = /-?\d+px/g;
      const matches = boxShadow.match(regex);

      if (matches && matches.length >= 2) {
        // Parse shadow values, defaulting missing values to 0.
        const [offsetX, offsetY, blurRadius = 0, spreadRadius = 0] =
          matches.map(value => parseInt(value.replace("px", ""), 10));

        const left = Math.max(0, -offsetX + blurRadius + spreadRadius);
        const right = Math.max(0, offsetX + blurRadius + spreadRadius);
        const top = Math.max(0, -offsetY + blurRadius + spreadRadius);
        const bottom = Math.max(0, offsetY + blurRadius + spreadRadius);

        return { left, right, top, bottom };
      }

      return { left: 0, right: 0, top: 0, bottom: 0 };
    }

    let overflow = calculateShadowOverflow(shadow);
    const FUZZ_FACTOR = 4;
    // The blur/spread/offset of the box shadow, plus fudge factors depending on platform.
    SHADOW_OVERFLOW_LEFT = overflow.left + FUZZ_FACTOR;
    SHADOW_OVERFLOW_RIGHT = overflow.right + FUZZ_FACTOR;
    SHADOW_OVERFLOW_TOP = overflow.top + FUZZ_FACTOR;

    // The popover positioning requires this offset
    VERTICAL_OFFSET = -extractPixelValue(verticalOffset); // Flip symbol since this CSS value is positive.

    BACKGROUND_LEFT = Math.floor(backgroundRect.left);
    BACKGROUND_RIGHT = Math.ceil(backgroundRect.right);

    await UrlbarTestUtils.promisePopupClose(win);
    URLBar.value = SEARCH_TERM;
  };

  let urlbarRect = URLBar.getBoundingClientRect();
  await measureGeometry();
  await testFn();
  let expectedRects = {
    filter: rects => {
      const referenceRect = {
        x1: BACKGROUND_LEFT - SHADOW_OVERFLOW_LEFT,
        x2: BACKGROUND_RIGHT + SHADOW_OVERFLOW_RIGHT,
        y1: Math.floor(urlbarRect.top) + VERTICAL_OFFSET - SHADOW_OVERFLOW_TOP,
      };

      // We put text into the urlbar so expect its textbox to change.
      // We expect many changes in the results view.
      // So we just allow changes anywhere in the urlbar. We don't check the
      // bottom of the rect because the result view height varies depending on
      // the results.
      // We use floor/ceil because the Urlbar dimensions aren't always
      // integers.
      return rects.filter(
        r =>
          !(
            r.x1 >= referenceRect.x1 &&
            r.x2 <= referenceRect.x2 &&
            r.y1 >= referenceRect.y1
          )
      );
    },
  };

  info("First opening");
  await withPerfObserver(
    testFn,
    { expectedReflows: expectedReflowsFirstOpen, frames: expectedRects },
    win
  );

  if (expectedReflowsSecondOpen) {
    info("Second opening");
    await withPerfObserver(
      testFn,
      { expectedReflows: expectedReflowsSecondOpen, frames: expectedRects },
      win
    );
  }

  await BrowserTestUtils.closeWindow(win);
  await TestUtils.waitForTick();
}

/**
 * Helper method for checking which scripts are loaded on content process
 * startup, used by `browser_startup_content.js` and
 * `browser_startup_content_subframe.js`.
 *
 * Parameters to this function are passed in an object literal to avoid
 * confusion about parameter order.
 *
 * @param loadedInfo (Object)
 *        Mapping from script type to a set of scripts which have been loaded
 *        of that type.
 *
 * @param known (Object)
 *        Mapping from script type to a set of scripts which must have been
 *        loaded of that type.
 *
 * @param intermittent (Object)
 *        Mapping from script type to a set of scripts which may have been
 *        loaded of that type. There must be a script type map for every type
 *        in `known`.
 *
 * @param forbidden (Object)
 *        Mapping from script type to a set of scripts which must not have been
 *        loaded of that type.
 *
 * @param dumpAllStacks (bool)
 *        If true, dump the stacks for all loaded modules. Makes the output
 *        noisy.
 */
async function checkLoadedScripts({
  loadedInfo,
  known,
  intermittent,
  forbidden,
  dumpAllStacks,
}) {
  let loadedList = {};

  async function checkAllExist(scriptType, list, listType) {
    if (scriptType == "services") {
      for (let contract of list) {
        ok(
          contract in Cc,
          `${listType} entry ${contract} for content process startup must exist`
        );
      }
    } else {
      let results = await PerfTestHelpers.throttledMapPromises(
        list,
        async uri => ({
          uri,
          exists: await PerfTestHelpers.checkURIExists(uri),
        })
      );

      for (let { uri, exists } of results) {
        ok(
          exists,
          `${listType} entry ${uri} for content process startup must exist`
        );
      }
    }
  }

  for (let scriptType in known) {
    loadedList[scriptType] = [...loadedInfo[scriptType].keys()].filter(c => {
      if (!known[scriptType].has(c)) {
        return true;
      }
      known[scriptType].delete(c);
      return false;
    });

    loadedList[scriptType] = [...loadedList[scriptType]].filter(c => {
      return !intermittent[scriptType].has(c);
    });

    if (loadedList[scriptType].length) {
      console.log("Unexpected scripts:", loadedList[scriptType]);
    }
    is(
      loadedList[scriptType].length,
      0,
      `should have no unexpected ${scriptType} loaded on content process startup`
    );

    for (let script of loadedList[scriptType]) {
      record(
        false,
        `Unexpected ${scriptType} loaded during content process startup: ${script}`,
        undefined,
        loadedInfo[scriptType].get(script)
      );
    }

    await checkAllExist(scriptType, intermittent[scriptType], "intermittent");

    is(
      known[scriptType].size,
      0,
      `all known ${scriptType} scripts should have been loaded`
    );

    for (let script of known[scriptType]) {
      ok(
        false,
        `${scriptType} is expected to load for content process startup but wasn't: ${script}`
      );
    }

    if (dumpAllStacks) {
      info(`Stacks for all loaded ${scriptType}:`);
      for (let [file, stack] of loadedInfo[scriptType]) {
        if (stack) {
          info(
            `${file}\n------------------------------------\n` + stack + "\n"
          );
        }
      }
    }
  }

  for (let scriptType in forbidden) {
    for (let script of forbidden[scriptType]) {
      let loaded = loadedInfo[scriptType].has(script);
      if (loaded) {
        record(
          false,
          `Forbidden ${scriptType} loaded during content process startup: ${script}`,
          undefined,
          loadedInfo[scriptType].get(script)
        );
      }
    }

    await checkAllExist(scriptType, forbidden[scriptType], "forbidden");
  }
}

// The first screenshot we get in OSX / Windows shows an unfocused browser
// window for some reason. See bug 1445161. This function allows to deal with
// that in a central place.
function isLikelyFocusChange(rects, frame) {
  if (rects.length >= 2 && rects.every(r => r.y2 < 100)) {
    // There are at least 2 areas that changed near the top of the screen.
    // Note that we need a bit more leeway than the titlebar height, because on
    // OSX other toolbarbuttons in the navigation toolbar also get disabled
    // state.
    return true;
  }
  if (
    rects.every(r => r.y1 == 0 && r.x1 == 0 && r.w == frame.width && r.y2 < 100)
  ) {
    // Full-width rect in the top of the titlebar.
    return true;
  }
  // Treat a full-window change as a likely focus change under nova.
  // With the nova floating chrome, the window background is visible in the gaps
  // around the toolbox and content areas. When the window's active state changes,
  // we see a repaint across the whole window (not just the titlebar.)
  if (
    Services.prefs.getBoolPref("browser.nova.enabled", false) &&
    rects.length &&
    rects.every(
      r => r.x1 == 0 && r.y1 == 0 && r.w >= frame.width && r.h >= frame.height
    )
  ) {
    return true;
  }
  return false;
}

// See if the rect might match the coordinates of the bottom-border of an element
// given its DOMRect.
function rectMatchesBottomBorder(r, domRect) {
  return (
    r.h <= 2 &&
    r.x1 >= domRect.x &&
    r.x1 < domRect.x + domRect.width &&
    r.x2 > domRect.x &&
    r.x2 <= domRect.x + domRect.width &&
    r.y1 >= domRect.bottom - 1.5 &&
    r.y2 <= domRect.bottom + 1.5
  );
}
