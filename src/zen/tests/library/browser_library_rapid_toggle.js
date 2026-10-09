/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Each round waits for the library's spring to come to rest.
requestLongerTimeout(4);

const DELAYS_MS = [0, 0, 16, 40, 90, 160, 260];

function library() {
  return document.querySelector("zen-library");
}

function libraryClass() {
  return customElements.get("zen-library");
}

/**
 * Whether the library has come to rest either fully open or fully closed,
 * with nothing it moved while open left behind.
 */
function isSettled() {
  const lib = library();
  const Library = libraryClass();
  if (lib.hasAttribute("transitioning")) {
    return false;
  }
  if (Library.isLibraryOpen) {
    return Library.libraryProgress === 1 && !lib.hidden;
  }
  return (
    Library.libraryProgress === 0 &&
    lib.hidden &&
    !gNavToolbox.style.opacity &&
    !gNavToolbox.style.transform
  );
}

function describe() {
  const lib = library();
  const Library = libraryClass();
  return JSON.stringify({
    open: Library.isLibraryOpen,
    progress: Library.libraryProgress,
    hidden: lib.hidden,
    transitioning: lib.hasAttribute("transitioning"),
    toolbox: gNavToolbox.getAttribute("style"),
  });
}

async function waitSettled(message) {
  try {
    await TestUtils.waitForCondition(isSettled, message, 50, 60);
  } catch (e) {
    ok(false, `${message}: ${describe()}`);
    throw e;
  }
  ok(true, message);
}

// A small fixed-seed generator, so a failing run can be replayed.
function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function pause(random) {
  const delay = DELAYS_MS[Math.floor(random() * DELAYS_MS.length)];
  if (delay) {
    return new Promise(resolve => setTimeout(resolve, delay));
  }
  return random() < 0.5
    ? new Promise(resolve => requestAnimationFrame(resolve))
    : Promise.resolve();
}

/**
 * Drives the library the way a trackpad swipe between spaces does, in the
 * order ZenSpacesSwipe calls it.
 */
async function swipe(random) {
  const Library = libraryClass();
  Library.swipeReset();
  Library.startSwipe();
  const steps = 1 + Math.floor(random() * 6);
  const towards = random() < 0.5 ? 1 : -1;
  for (let i = 1; i <= steps; i++) {
    // Overshooting either end exercises the rubber band.
    Library.swipeProgress((towards * i * 1.6) / steps);
    if (random() < 0.7) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  }
  Library.stopSwipe(random() < 0.5 ? 1 : -1);
  if (random() < 0.5) {
    await pause(random);
    Library.swipeAnimationEnd();
  }
}

add_task(async function test_toggle_and_swipe_always_settle() {
  const Library = libraryClass();
  const random = makeRandom(7);

  for (let round = 0; round < 40; round++) {
    const actions = 2 + Math.floor(random() * 5);
    for (let i = 0; i < actions; i++) {
      if (random() < 0.5) {
        Library.toggle("history");
      } else {
        await swipe(random);
      }
      await pause(random);
    }
    await waitSettled(`swipe round ${round} (${actions} actions) settles`);

    const wasOpen = Library.isLibraryOpen;
    Library.toggle("history");
    await waitSettled(`swipe round ${round} toggles after settling`);
    is(
      Library.isLibraryOpen,
      !wasOpen,
      `swipe round ${round} press flips the library`
    );
  }

  if (Library.isLibraryOpen) {
    Library.toggle("history");
    await waitSettled("library closes after the swipes");
  }
});

add_task(async function test_rapid_toggle_always_settles() {
  const Library = libraryClass();
  const random = makeRandom(42);

  for (let round = 0; round < 25; round++) {
    const presses = 2 + Math.floor(random() * 6);
    for (let i = 0; i < presses; i++) {
      Library.toggle("history");
      const delay = DELAYS_MS[Math.floor(random() * DELAYS_MS.length)];
      if (delay) {
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (random() < 0.5) {
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    }
    await waitSettled(`round ${round} (${presses} presses) settles`);

    // Whatever it settled on, one more press must flip it.
    const wasOpen = Library.isLibraryOpen;
    Library.toggle("history");
    await waitSettled(`round ${round} toggles after settling`);
    is(
      Library.isLibraryOpen,
      !wasOpen,
      `round ${round} press flips the library`
    );
  }

  if (Library.isLibraryOpen) {
    Library.toggle("history");
    await waitSettled("library closes at the end");
  }
});
