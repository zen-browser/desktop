/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

Services.scriptloader.loadSubScript(
  "chrome://mochitests/content/browser/toolkit/components/translations/tests/browser/shared-head.js",
  this
);

/**
 * Converts milliseconds to seconds.
 *
 * @param {number} ms - The duration in milliseconds.
 * @returns {number} The duration in seconds.
 */
function millisecondsToSeconds(ms) {
  return ms / 1000;
}

/**
 * Converts bytes to mebibytes.
 *
 * @param {number} bytes - The size in bytes.
 * @returns {number} The size in mebibytes.
 */
function bytesToMebibytes(bytes) {
  return bytes / (1024 * 1024);
}

/**
 * Calculates the median of a list of numbers.
 *
 * @param {number[]} numbers - An array of numbers to find the median of.
 * @returns {number} The median of the provided numbers.
 */
function median(numbers) {
  numbers = numbers.sort((lhs, rhs) => lhs - rhs);
  const midIndex = Math.floor(numbers.length / 2);

  if (numbers.length & 1) {
    return numbers[midIndex];
  }

  return (numbers[midIndex - 1] + numbers[midIndex]) / 2;
}

/**
 * Opens a new tab in the foreground.
 *
 * @param {string} url
 */
async function addTab(url, message, win = window) {
  logAction(url);
  info(message);
  const tab = await BrowserTestUtils.openNewForegroundTab(
    win.gBrowser,
    url,
    true // Wait for load
  );
  return {
    tab,
    removeTab() {
      BrowserTestUtils.removeTab(tab);
    },
    /**
     * Runs a callback in the content page. The function's contents are serialized as
     * a string, and run in the page. The `translations-test.mjs` module is made
     * available to the page.
     *
     * @param {(TranslationsTest: import("./translations-test.mjs")) => any} callback
     * @returns {Promise<void>}
     */
    runInPage(callback, data = {}) {
      return ContentTask.spawn(
        tab.linkedBrowser,
        { contentData: data, callbackSource: callback.toString() }, // Data to inject.
        function ({ contentData, callbackSource }) {
          const TranslationsTest = ChromeUtils.importESModule(
            "chrome://mochitests/content/browser/toolkit/components/translations/tests/browser/translations-test.mjs"
          );

          // Pass in the values that get injected by the task runner.
          TranslationsTest.setup({ Assert, ContentTaskUtils, content });

          // eslint-disable-next-line no-eval
          let contentCallback = eval(`(${callbackSource})`);
          return contentCallback(TranslationsTest, contentData);
        }
      );
    },
  };
}

/**
 * Simulates clicking an element with the mouse.
 *
 * @param {element} element - The element to click.
 * @param {string} [message] - A message to log to info.
 */
function click(element, message) {
  logAction(message);
  return new Promise(resolve => {
    element.addEventListener(
      "click",
      function () {
        resolve();
      },
      { once: true }
    );

    EventUtils.synthesizeMouseAtCenter(element, {
      type: "mousedown",
      isSynthesized: false,
    });
    EventUtils.synthesizeMouseAtCenter(element, {
      type: "mouseup",
      isSynthesized: false,
    });
  });
}

function focusElementAndSynthesizeKey(element, key) {
  assertVisibility({ visible: { element } });
  element.focus();
  EventUtils.synthesizeKey(key);
}

/**
 * Focuses the given window object, moving it to the top of all open windows.
 *
 * @param {Window} win
 */
async function focusWindow(win) {
  const windowFocusPromise = BrowserTestUtils.waitForEvent(win, "focus");
  win.focus();
  await windowFocusPromise;
}

/**
 * Get all elements that match the l10n id.
 *
 * @param {string} l10nId
 * @param {Document} doc
 * @returns {Element}
 */
function getAllByL10nId(l10nId, doc = document) {
  const elements = doc.querySelectorAll(`[data-l10n-id="${l10nId}"]`);
  if (elements.length === 0) {
    throw new Error("Could not find the element by l10n id: " + l10nId);
  }
  return elements;
}

/**
 * Retrieves an element by its Id.
 *
 * @param {string} id
 * @param {Document} [doc]
 * @returns {Element}
 * @throws Throws if the element is not visible in the DOM.
 */
function getById(id, doc = document) {
  const element = maybeGetById(id, /* ensureIsVisible */ true, doc);
  if (!element) {
    throw new Error("The element is not visible in the DOM: #" + id);
  }
  return element;
}

/**
 * Get an element by its l10n id, as this is a user-visible way to find an element.
 * The `l10nId` represents the text that a user would actually see.
 *
 * @param {string} l10nId
 * @param {Document} doc
 * @returns {Element}
 */
function getByL10nId(l10nId, doc = document) {
  const elements = doc.querySelectorAll(`[data-l10n-id="${l10nId}"]`);
  if (elements.length === 0) {
    throw new Error("Could not find the element by l10n id: " + l10nId);
  }
  for (const element of elements) {
    if (BrowserTestUtils.isVisible(element)) {
      return element;
    }
  }
  throw new Error("The element is not visible in the DOM: " + l10nId);
}

/**
 * Returns the intl display name of a given language tag.
 *
 * @param {string} langTag - A BCP-47 language tag.
 */
const getIntlDisplayName = (() => {
  let languageDisplayNames = null;

  return langTag => {
    if (!languageDisplayNames) {
      languageDisplayNames = TranslationsParent.createLanguageDisplayNames({
        fallback: "none",
      });
    }
    return languageDisplayNames.of(langTag);
  };
})();

/**
 * Attempts to retrieve an element by its Id.
 *
 * @param {string} id - The Id of the element to retrieve.
 * @param {boolean} [ensureIsVisible=true] - If set to true, the function will return null when the element is not visible.
 * @param {Document} [doc=document] - The document from which to retrieve the element.
 * @returns {Element | null} - The retrieved element.
 * @throws Throws if no element was found by the given Id.
 */
function maybeGetById(id, ensureIsVisible = true, doc = document) {
  const element = doc.getElementById(id);
  if (!element) {
    throw new Error("Could not find the element by id: #" + id);
  }

  if (!ensureIsVisible) {
    return element;
  }

  if (BrowserTestUtils.isVisible(element)) {
    return element;
  }

  return null;
}

/**
 * A non-throwing version of `getByL10nId`.
 *
 * @param {string} l10nId
 * @returns {Element | null}
 */
function maybeGetByL10nId(l10nId, doc = document) {
  const selector = `[data-l10n-id="${l10nId}"]`;
  const elements = doc.querySelectorAll(selector);
  for (const element of elements) {
    if (BrowserTestUtils.isVisible(element)) {
      return element;
    }
  }
  return null;
}

/**
 * Provide a uniform way to log actions. This abuses the Error stack to get the callers
 * of the action. This should help in test debugging.
 */
function logAction(...params) {
  const error = new Error();
  const stackLines = error.stack.split("\n");
  const actionName = stackLines[1]?.split("@")[0] ?? "";
  const taskFileLocation = stackLines[2]?.split("@")[1] ?? "";
  if (taskFileLocation.includes("head.js")) {
    // Only log actions that were done at the test level.
    return;
  }

  info(`Action: ${actionName}(${params.join(", ")})`);
  info(
    `Source: ${taskFileLocation.replace(
      "chrome://mochitests/content/browser/",
      ""
    )}`
  );
}

/**
 * Returns true if Full-Page Translations is currently active, otherwise false.
 *
 * @returns {boolean}
 */
function isFullPageTranslationsActive() {
  try {
    const { requestedLanguagePair } = TranslationsParent.getTranslationsActor(
      gBrowser.selectedBrowser
    ).languageState;
    return !!requestedLanguagePair;
  } catch {
    // Translations actor unavailable, continue on.
  }
  return false;
}

/**
 * Navigate to a URL and indicate a message as to why.
 */
async function navigate(
  message,
  { url, onOpenPanel = null, downloadHandler = null, pivotTranslation = false }
) {
  logAction();
  // When the translations panel is open from the app menu,
  // it doesn't close on navigate the way that it does when it's
  // open from the translations button, so ensure that we always
  // close it when we navigate to a new page.
  await closeAllOpenPanelsAndMenus();

  info(message + " - " + url);

  // Load a blank page first to ensure that tests don't hang.
  // I don't know why this is needed, but it appears to be necessary.
  await loadBlankPage();
  const loadTargetPage = async () => {
    await loadNewPage(gBrowser.selectedBrowser, url);

    if (downloadHandler) {
      await FullPageTranslationsTestUtils.assertTranslationsButton(
        { button: true, circleArrows: true, locale: false, icon: true },
        "The icon presents the loading indicator."
      );
      await downloadHandler(pivotTranslation ? 2 : 1);
    }
  };

  info(`Loading url: "${url}"`);
  if (onOpenPanel) {
    await FullPageTranslationsTestUtils.waitForPanelPopupEvent(
      "popupshown",
      loadTargetPage,
      onOpenPanel
    );
  } else {
    await loadTargetPage();
  }
}

/**
 * Switches to a given tab.
 *
 * @param {object} tab - The tab to switch to
 * @param {string} name
 */
async function switchTab(tab, name) {
  logAction("tab", name);
  gBrowser.selectedTab = tab;
  await new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Click the reader-mode button if the reader-mode button is available.
 * Fails if the reader-mode button is hidden.
 */
async function toggleReaderMode() {
  logAction();
  const readerButton = document.getElementById("reader-mode-button");
  await waitForCondition(() => readerButton.hidden === false);

  readerButton.getAttribute("readeractive")
    ? info("Exiting reader mode")
    : info("Entering reader mode");

  const readyPromise = readerButton.getAttribute("readeractive")
    ? waitForCondition(() => !readerButton.getAttribute("readeractive"))
    : BrowserTestUtils.waitForContentEvent(
        gBrowser.selectedBrowser,
        "AboutReaderContentReady"
      );

  click(readerButton, "Clicking the reader-mode button");
  await readyPromise;
}

/**
 * Scrolls to the top of the content page.
 *
 * @param {Function} runInPage - Runs a closure within the content context of the content page.
 *
 * @returns {Promise<void>} Resolves once the scroll position has been updated and a paint has occurred.
 */
async function scrollToTopOfPage(runInPage) {
  logAction();
  await runInPage(async ({ waitForCondition }) => {
    content.scrollTo({ top: 0, behavior: "smooth" });

    await waitForCondition(
      () => content.scrollY <= 10,
      "Waiting for scroll animation to complete."
    );

    // Wait for the new position to be painted.
    await new Promise(resolve => {
      content.requestAnimationFrame(() =>
        content.requestAnimationFrame(resolve)
      );
    });
  });
}

/**
 * Scrolls the content page to the very bottom.
 *
 * @param {Function} runInPage - Runs a closure within the content context of the content page.
 *
 * @returns {Promise<void>} Resolves once the scroll position has been updated and a paint has occurred.
 */
async function scrollToBottomOfPage(runInPage) {
  logAction();
  await runInPage(async ({ waitForCondition }) => {
    const scrollHeight = content.document.documentElement.scrollHeight;
    content.scrollTo({ top: scrollHeight, behavior: "smooth" });

    await waitForCondition(() => {
      return content.scrollY >= scrollHeight - content.innerHeight - 10;
    }, "Waiting for scroll animation to complete.");

    // Wait for the new position to be painted.
    await new Promise(resolve => {
      content.requestAnimationFrame(() =>
        content.requestAnimationFrame(resolve)
      );
    });
  });
}

/**
 * A class for benchmarking translation performance and reporting
 * metrics to our perftest infrastructure.
 */
class TranslationsBencher {
  /**
   * The metric base name for the engine initialization time.
   *
   * @type {string}
   */
  static METRIC_ENGINE_INIT_TIME = "engine-init-time";

  /**
   * The metric base name for words translated per second.
   *
   * @type {string}
   */
  static METRIC_WORDS_PER_SECOND = "words-per-second";

  /**
   * The metric base name for tokens translated per second.
   *
   * @type {string}
   */
  static METRIC_TOKENS_PER_SECOND = "tokens-per-second";

  /**
   * The metric base name for peak memory usage in the parent process.
   * The TranslationsBencher records this at a sampled interval reporting
   * the maximum recorded memory recorded during the benchmark.
   *
   * @type {string}
   */
  static METRIC_PEAK_PARENT_PROCESS_MEMORY_USAGE =
    "peak-parent-process-memory-usage";

  /**
   * The metric base name for stabilized memory usage in the parent process.
   * The TranslationsBencher records this just after finishing the final translation,
   * but before destroying the engine and running GC.
   *
   * @type {string}
   */
  static METRIC_STABILIZED_PARENT_PROCESS_MEMORY_USAGE =
    "stabilized-parent-process-memory-usage";

  /**
   * The metric base name for the memory usage in the parent process after
   * translation has completed, and after running cycle collection and
   * garbage collection.
   *
   * @type {string}
   */
  static METRIC_POST_GC_PARENT_PROCESS_MEMORY_USAGE =
    "post-gc-parent-process-memory-usage";

  /**
   * The metric base name for peak memory usage in the inference process.
   * The TranslationsBencher records this at a sampled interval reporting
   * the maximum recorded memory recorded during the benchmark.
   *
   * @type {string}
   */
  static METRIC_PEAK_INFERENCE_PROCESS_MEMORY_USAGE =
    "peak-inference-process-memory-usage";

  /**
   * The metric base name for stabilized memory usage in the inference process,
   * The TranslationsBencher records this just after finishing the final translation,
   * but before running GC.
   *
   * @type {string}
   */
  static METRIC_STABILIZED_INFERENCE_PROCESS_MEMORY_USAGE =
    "stabilized-inference-process-memory-usage";

  /**
   * The metric base name for the memory usage in the inference process after
   * translation has completed, and after running cycle collection and garbage
   * garbage collection.
   *
   * @type {string}
   */
  static METRIC_POST_GC_INFERENCE_PROCESS_MEMORY_USAGE =
    "post-gc-inference-process-memory-usage";

  /**
   * The metric base name for total translation time.
   *
   * @type {string}
   */
  static METRIC_TOTAL_TRANSLATION_TIME = "total-translation-time";

  /**
   * Data required to ensure that peftest metrics are validated and calculated correctly for the
   * given test file. This data can be generated for a test file by running the script located at:
   *
   * toolkit/components/translations/tests/scripts/translations-perf-data.py
   *
   * @type {Record<string, {pageLanguage: string, tokenCount: number, wordCount: number}>}
   */
  static #PAGE_DATA = {
    [SPANISH_BENCHMARK_PAGE_URL]: {
      pageLanguage: "es",
      tokenCount: 10966,
      wordCount: 6944,
    },
  };

  /**
   * A class that gathers and reports metrics to perftest.
   */
  static Journal = class {
    /**
     * A map of collected metrics, where the key is the metric name
     * and the value is an array of all recorded values.
     *
     * @type {Record<string, number[]>}
     */
    #metrics = {};

    /**
     * Pushes a metric value into the journal.
     *
     * @param {string} metricName - The metric name.
     * @param {number} value - The metric value to record.
     */
    pushMetric(metricName, value) {
      if (!this.#metrics[metricName]) {
        this.#metrics[metricName] = [];
      }

      this.#metrics[metricName].push(Number(value.toFixed(3)));
    }

    /**
     * Pushes multiple metric values into the journal.
     *
     * @param {Array<[string, number]>} metrics - An array of [metricName, value] pairs.
     */
    pushMetrics(metrics) {
      for (const [metricName, value] of metrics) {
        this.pushMetric(metricName, value);
      }
    }

    /**
     * Logs the median value along with the individual values from all
     * test runs for each collected metric to the console.
     * The log is then picked up by the perftest infrastructure.
     * The logged data must match the schema defined in the test file.
     */
    reportMetrics() {
      const reportedMetrics = [];
      for (const [name, values] of Object.entries(this.#metrics)) {
        reportedMetrics.push({
          name,
          values,
          value: median(values),
        });
      }
      info(`perfMetrics | ${JSON.stringify(reportedMetrics)}`);
    }
  };

  /**
   * A class to track peak memory usage during translation via sampled intervals.
   */
  static PeakMemorySampler = class {
    /**
     * The peak recorded memory in mebibytes (MiB) for the parent process.
     *
     * @type {number}
     */
    #peakParentMemoryMiB = 0;

    /**
     * The peak recorded memory in mebibytes (MiB) for the inference process.
     *
     * @type {number}
     */
    #peakInferenceMemoryMiB = 0;

    /**
     * The interval id for the memory sample timer.
     *
     * @type {number|null}
     */
    #intervalId = null;

    /**
     * The interval at which memory usage is sampled in milliseconds.
     *
     * @type {number}
     */
    #interval;

    /**
     * Constructs a PeakMemorySampler.
     *
     * @param {number} interval - The interval in milliseconds between memory samples.
     */
    constructor(interval) {
      this.#interval = interval;
    }

    /**
     * Collects the current memory usage for both the parent and inference processes
     * and updates the peak memory measurements if the current usage exceeds the
     * previously recorded peaks.
     *
     * @returns {Promise<void>}
     */
    async #collectMemorySample() {
      const { parentMemoryMiB, inferenceMemoryMiB } =
        await TranslationsBencher.#getTotalMemoryUsageByProcess();

      if (parentMemoryMiB > this.#peakParentMemoryMiB) {
        this.#peakParentMemoryMiB = parentMemoryMiB;
      }
      if (inferenceMemoryMiB > this.#peakInferenceMemoryMiB) {
        this.#peakInferenceMemoryMiB = inferenceMemoryMiB;
      }
    }

    /**
     * Starts the interval timer to begin sampling new peak memory usage values.
     */
    start() {
      if (this.#intervalId !== null) {
        throw new Error(
          "Attempt to start a PeakMemorySampler that was already running."
        );
      }

      this.#peakParentMemoryMiB = 0;
      this.#peakInferenceMemoryMiB = 0;
      this.#intervalId = setInterval(() => {
        this.#collectMemorySample().catch(console.error);
      }, this.#interval);
    }

    /**
     * Stops the interval timer from continuing to sample peak memory usage.
     */
    stop() {
      if (this.#intervalId === null) {
        throw new Error(
          "Attempt to stop a PeakMemorySampler that was not running."
        );
      }

      clearInterval(this.#intervalId);
      this.#intervalId = null;
      this.#collectMemorySample();
    }

    /**
     * Returns the peak recorded memory usage in mebibytes (MiB).
     *
     * @returns {{ peakParentMemoryMiB: number, peakInferenceMemoryMiB: number }}
     */
    getPeakRecordedMemoryUsage() {
      if (this.#intervalId) {
        throw new Error(
          "Attempt to retrieve peak recorded memory usage while the memory sampler is running."
        );
      }

      return {
        peakParentMemoryMiB: this.#peakParentMemoryMiB,
        peakInferenceMemoryMiB: this.#peakInferenceMemoryMiB,
      };
    }
  };

  /**
   * Benchmarks the translation process (both memory usage and speed)
   * and reports metrics to perftest. It runs one full translation for
   * each memory sample, and then one full translation for each speed sample.
   *
   * @param {object} options - The benchmark options.
   * @param {string} options.page - The URL of the page to test.
   * @param {string} options.sourceLanguage - The BCP-47 language tag for the source language.
   * @param {string} options.targetLanguage - The BCP-47 language tag for the target language.
   * @param {number} options.speedBenchCount - The number of speed-sampling runs to perform.
   * @param {number} options.memoryBenchCount - The number of memory-sampling runs to perform.
   * @param {number} [options.memorySampleInterval] - The interval in milliseconds between memory usage samples.
   *
   * @returns {Promise<void>} Resolves when benchmarking is complete.
   */
  static async benchmarkTranslation({
    page,
    sourceLanguage,
    targetLanguage,
    speedBenchCount,
    memoryBenchCount,
    memorySampleInterval = 10,
  }) {
    const { wordCount, tokenCount, pageLanguage } =
      TranslationsBencher.#PAGE_DATA[page] ?? {};

    if (!wordCount || !tokenCount || !pageLanguage) {
      const testPageName = page.match(/[^\\/]+$/)[0];
      const testPagePath = page.substring(
        "https://example.com/browser/".length
      );
      const sourceLangName = getIntlDisplayName(sourceLanguage);
      throw new Error(`

        🚨 Perf test data is not properly defined for ${testPageName} 🚨

        To enable ${testPageName} for Translations perf tests, please follow these steps:

          1) Ensure ${testPageName} has a proper HTML lang attribute in the markup:

               <html lang="${sourceLanguage}">

          2) Download the ${sourceLanguage}-${PIVOT_LANGUAGE}.vocab.spm model from a ${sourceLangName} row on the following site:

               https://gregtatum.github.io/taskcluster-tools/src/models/

          3) Run the following command to extract the perf metadata from ${testPageName}:

               ❯ python3 toolkit/components/translations/tests/scripts/translations-perf-data.py \\
                 --page_path="${testPagePath}" \\
                 --model_path="..."

          4) Include the resulting metadata for ${testPageName} in the TranslationsBencher.#PAGE_DATA object.
      `);
    }

    if (sourceLanguage !== pageLanguage) {
      throw new Error(
        `Perf test source language '${sourceLanguage}' did not match the expected page language '${pageLanguage}'.`
      );
    }

    const journal = new TranslationsBencher.Journal();

    await TranslationsBencher.#benchmarkTranslationMemory({
      page,
      journal,
      sourceLanguage,
      targetLanguage,
      memoryBenchCount,
      memorySampleInterval,
    });

    await TranslationsBencher.#benchmarkTranslationSpeed({
      page,
      journal,
      sourceLanguage,
      targetLanguage,
      wordCount,
      tokenCount,
      speedBenchCount,
    });

    journal.reportMetrics();
  }

  /**
   * Benchmarks memory usage by measuring peak and stabilized memory usage
   * across multiple runs of the translation process.
   *
   * @param {object} options - The benchmark options.
   * @param {string} options.page - The URL of the page to test.
   * @param {TranslationsBencher.Journal} options.journal - The shared metrics journal.
   * @param {string} options.sourceLanguage - The BCP-47 language tag for the source language.
   * @param {string} options.targetLanguage - The BCP-47 language tag for the target language.
   * @param {number} options.memoryBenchCount - The number of runs to perform for memory sampling.
   * @param {number} options.memorySampleInterval - The interval in milliseconds between memory samples.
   *
   * @returns {Promise<void>} Resolves when memory benchmarking is complete.
   */
  static async #benchmarkTranslationMemory({
    page,
    journal,
    sourceLanguage,
    targetLanguage,
    memoryBenchCount,
    memorySampleInterval,
  }) {
    for (let runNumber = 0; runNumber < memoryBenchCount; ++runNumber) {
      const { cleanup, runInPage } = await loadTestPage({
        page,
        endToEndTest: true,
        languagePairs: [
          { fromLang: sourceLanguage, toLang: "en" },
          { fromLang: "en", toLang: targetLanguage },
        ],
        prefs: [["browser.translations.logLevel", "Error"]],
        contentEagerMode: true,
      });

      // Create a new PeakMemorySampler using the provided interval.
      const peakMemorySampler = new TranslationsBencher.PeakMemorySampler(
        memorySampleInterval
      );

      await TranslationsBencher.#injectFinalParagraphTranslatedObserver(
        runInPage
      );

      await FullPageTranslationsTestUtils.assertTranslationsButton(
        { button: true, circleArrows: false, locale: false, icon: true },
        "The button is available."
      );

      await FullPageTranslationsTestUtils.openPanel({
        onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
      });

      await FullPageTranslationsTestUtils.changeSelectedFromLanguage({
        langTag: sourceLanguage,
      });
      await FullPageTranslationsTestUtils.changeSelectedToLanguage({
        langTag: targetLanguage,
      });

      const translationCompleteTimestampPromise =
        TranslationsBencher.#getTranslationCompleteTimestampPromise(runInPage);

      peakMemorySampler.start();

      await FullPageTranslationsTestUtils.clickTranslateButton();
      await translationCompleteTimestampPromise;

      peakMemorySampler.stop();

      const { peakParentMemoryMiB, peakInferenceMemoryMiB } =
        peakMemorySampler.getPeakRecordedMemoryUsage();

      const { parentMemoryMiB, inferenceMemoryMiB } =
        await TranslationsBencher.#getTotalMemoryUsageByProcess();

      // Force cycle collection and garbage collection.
      Services.obs.notifyObservers(null, "child-cc-request");
      Services.obs.notifyObservers(null, "child-gc-request");
      window.windowUtils.cycleCollect();
      Cu.forceGC();

      const { inferenceMemoryMiB: postGCInferenceMiB } =
        await TranslationsBencher.#getTotalMemoryUsageByProcess();

      // Destroy the TranslationsEngine, then force cycle collection and garbage collection again.
      await EngineProcess.destroyTranslationsEngine();
      Services.obs.notifyObservers(null, "child-cc-request");
      Services.obs.notifyObservers(null, "child-gc-request");
      window.windowUtils.cycleCollect();
      Cu.forceGC();

      const { parentMemoryMiB: postGCParentMiB } =
        await TranslationsBencher.#getTotalMemoryUsageByProcess();

      journal.pushMetrics([
        [
          TranslationsBencher.METRIC_PEAK_PARENT_PROCESS_MEMORY_USAGE,
          peakParentMemoryMiB,
        ],
        [
          TranslationsBencher.METRIC_STABILIZED_PARENT_PROCESS_MEMORY_USAGE,
          parentMemoryMiB,
        ],
        [
          TranslationsBencher.METRIC_POST_GC_PARENT_PROCESS_MEMORY_USAGE,
          postGCParentMiB,
        ],
        [
          TranslationsBencher.METRIC_PEAK_INFERENCE_PROCESS_MEMORY_USAGE,
          peakInferenceMemoryMiB,
        ],
        [
          TranslationsBencher.METRIC_STABILIZED_INFERENCE_PROCESS_MEMORY_USAGE,
          inferenceMemoryMiB,
        ],
        [
          TranslationsBencher.METRIC_POST_GC_INFERENCE_PROCESS_MEMORY_USAGE,
          postGCInferenceMiB,
        ],
      ]);

      await cleanup();
    }
  }

  /**
   * Benchmarks speed by measuring engine init time, words per second, tokens per second,
   * and total translation time across multiple runs.
   *
   * @param {object} options - The benchmark options.
   * @param {string} options.page - The URL of the page to test.
   * @param {TranslationsBencher.Journal} options.journal - The shared metrics journal.
   * @param {string} options.sourceLanguage - The BCP-47 language tag for the source language.
   * @param {string} options.targetLanguage - The BCP-47 language tag for the target language.
   * @param {number} options.wordCount - The total word count of the page.
   * @param {number} options.tokenCount - The total token count of the page.
   * @param {number} options.speedBenchCount - The number of runs to perform for speed sampling.
   *
   * @returns {Promise<void>} Resolves when speed benchmarking is complete.
   */
  static async #benchmarkTranslationSpeed({
    page,
    journal,
    sourceLanguage,
    targetLanguage,
    wordCount,
    tokenCount,
    speedBenchCount,
  }) {
    for (let runNumber = 0; runNumber < speedBenchCount; ++runNumber) {
      const { tab, cleanup, runInPage } = await loadTestPage({
        page,
        endToEndTest: true,
        languagePairs: [
          { fromLang: sourceLanguage, toLang: "en" },
          { fromLang: "en", toLang: targetLanguage },
        ],
        prefs: [["browser.translations.logLevel", "Error"]],
        contentEagerMode: true,
      });

      await TranslationsBencher.#injectFinalParagraphTranslatedObserver(
        runInPage
      );

      await FullPageTranslationsTestUtils.assertTranslationsButton(
        { button: true, circleArrows: false, locale: false, icon: true },
        "The button is available."
      );

      await FullPageTranslationsTestUtils.openPanel({
        onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
      });

      await FullPageTranslationsTestUtils.changeSelectedFromLanguage({
        langTag: sourceLanguage,
      });
      await FullPageTranslationsTestUtils.changeSelectedToLanguage({
        langTag: targetLanguage,
      });

      const engineReadyTimestampPromise =
        TranslationsBencher.#getEngineReadyTimestampPromise(tab.linkedBrowser);
      const translationCompleteTimestampPromise =
        TranslationsBencher.#getTranslationCompleteTimestampPromise(runInPage);

      const translateButtonClickedTime = performance.now();
      await FullPageTranslationsTestUtils.clickTranslateButton();

      const [engineReadyTime, translationCompleteTime] = await Promise.all([
        engineReadyTimestampPromise,
        translationCompleteTimestampPromise,
      ]);

      const initTimeMilliseconds = engineReadyTime - translateButtonClickedTime;
      const translationTimeSeconds = millisecondsToSeconds(
        translationCompleteTime - engineReadyTime
      );
      const wordsPerSecond = wordCount / translationTimeSeconds;
      const tokensPerSecond = tokenCount / translationTimeSeconds;

      journal.pushMetrics([
        [TranslationsBencher.METRIC_ENGINE_INIT_TIME, initTimeMilliseconds],
        [TranslationsBencher.METRIC_WORDS_PER_SECOND, wordsPerSecond],
        [TranslationsBencher.METRIC_TOKENS_PER_SECOND, tokensPerSecond],
        [
          TranslationsBencher.METRIC_TOTAL_TRANSLATION_TIME,
          translationTimeSeconds,
        ],
      ]);

      await cleanup();
    }
  }

  /**
   * Injects a mutation observer into the test page to detect when the final paragraph
   * has been translated, and dispatch an event when that happens. This is a signal that
   * we are nearing the end of translating, at which point we can wait for the pending
   * request count to reduce to zero.
   *
   * @param {Function} runInPage - Runs a closure within the content context of the page.
   * @returns {Promise<void>} Resolves when the observer is injected.
   */
  static async #injectFinalParagraphTranslatedObserver(runInPage) {
    await runInPage(TranslationsTest => {
      const { getFinalParagraph } = TranslationsTest.getSelectors();
      const lastParagraph = getFinalParagraph();

      if (!lastParagraph) {
        throw new Error("Unable to find the final paragraph for observation.");
      }

      const observer = new content.MutationObserver(
        (_mutationsList, _observer) => {
          content.document.dispatchEvent(
            new CustomEvent("FinalParagraphTranslated")
          );
        }
      );

      observer.observe(lastParagraph, {
        childList: true,
      });
    });
  }

  /**
   * Returns a Promise that resolves with the timestamp when the Translations engine becomes ready.
   *
   * @param {Browser} browser - The browser hosting the translation.
   * @returns {Promise<number>} The timestamp when the engine is ready.
   */
  static async #getEngineReadyTimestampPromise(browser) {
    const { promise, resolve } = Promise.withResolvers();

    function maybeGetTranslationStartTime(event) {
      if (
        event.detail.reason === "isEngineReady" &&
        event.detail.actor.languageState.isEngineReady
      ) {
        browser.removeEventListener(
          "TranslationsParent:LanguageState",
          maybeGetTranslationStartTime
        );
        resolve(performance.now());
      }
    }

    browser.addEventListener(
      "TranslationsParent:LanguageState",
      maybeGetTranslationStartTime
    );

    return promise;
  }

  /**
   * Returns a Promise that resolves with the timestamp after the translation is complete.
   *
   * @param {Function} runInPage - A helper to run code on the test page.
   * @returns {Promise<number>} The timestamp when the translation is complete.
   */
  static async #getTranslationCompleteTimestampPromise(runInPage) {
    await runInPage(async ({ waitForCondition }) => {
      // First, wait for the final paragraph to be translated.
      await new Promise(resolve => {
        content.document.addEventListener("FinalParagraphTranslated", resolve, {
          once: true,
        });
      });

      const translationsChild =
        content.windowGlobalChild.getActor("Translations");

      if (
        translationsChild.translatedDoc?.hasPendingCallbackOnEventLoop() ||
        translationsChild.translatedDoc?.hasPendingTranslationRequests() ||
        translationsChild.translatedDoc?.isObservingAnyElementForContentIntersection()
      ) {
        // The final paragraph was translated, but it wasn't the final request,
        // so we must still wait for every translation request to complete.
        await waitForCondition(
          () =>
            !translationsChild.translatedDoc?.hasPendingCallbackOnEventLoop() &&
            !translationsChild.translatedDoc?.hasPendingTranslationRequests() &&
            !translationsChild.translatedDoc?.isObservingAnyElementForContentIntersection(),
          "Waiting for all pending translation requests to complete."
        );
      }
    });

    return performance.now();
  }

  /**
   * Returns the total memory used by both the parent process and the inference
   * process in mebibytes (MiB).
   *
   * @returns {Promise<{ parentMemoryMiB: number, inferenceMemoryMiB: number }>}
   *          The total memory usage for each process in mebibytes.
   */
  static async #getTotalMemoryUsageByProcess() {
    const { parentInfo, inferenceInfo } =
      await TranslationsBencher.#fetchProcessesInfo();
    return {
      parentMemoryMiB: bytesToMebibytes(parentInfo.memory),
      inferenceMemoryMiB: bytesToMebibytes(inferenceInfo.memory),
    };
  }

  /**
   * Returns the process info for both the parent process and inference process.
   *
   * @returns {Promise<{ parentInfo: { pid: number, memory: number, cpuTime: number, cpuCycleCount: number },
   *                     inferenceInfo: { pid: number, memory: number, cpuTime: number, cpuCycleCount: number } }>}
   */
  static async #fetchProcessesInfo() {
    let info = await ChromeUtils.requestProcInfo();

    const parentInfo = {
      pid: info.pid,
      memory: info.memory,
      cpuTime: info.cpuTime,
      cpuCycleCount: info.cpuCycleCount,
    };

    let inferenceInfo = {};
    for (const child of info.children) {
      // At the time of writing, there is only a single inference process.
      // If we one day spawn multiple inference processes, this code will
      // need to be revised.
      if (child.type === "inference") {
        inferenceInfo = {
          pid: child.pid,
          memory: child.memory,
          cpuTime: child.cpuTime,
          cpuCycleCount: child.cpuCycleCount,
        };
        break;
      }
    }

    return {
      parentInfo,
      inferenceInfo,
    };
  }
}

/**
 * A collection of shared functionality utilized by
 * FullPageTranslationsTestUtils and SelectTranslationsTestUtils.
 *
 * Using functions from the aforementioned classes is preferred over
 * using functions from this class directly.
 */
class SharedTranslationsTestUtils {
  /**
   * Asserts that the specified element currently has focus.
   *
   * @param {Element} element - The element to check for focus.
   */
  static _assertHasFocus(element) {
    is(
      document.activeElement,
      element,
      `The element '${element.id}' should have focus.`
    );
  }

  /**
   * Asserts that the given element has the expected L10nId.
   *
   * @param {Element} element - The element to assert against.
   * @param {string} l10nId - The expected localization id.
   */
  static _assertL10nId(element, l10nId) {
    is(
      element.getAttribute("data-l10n-id"),
      l10nId,
      `The element ${element.id} should have L10n Id ${l10nId}.`
    );
  }

  /**
   * Asserts that the mainViewId of the panel matches the given string.
   *
   * @param {FullPageTranslationsPanel | SelectTranslationsPanel} panel
   * @param {string} expectedId - The expected id that mainViewId is set to.
   */
  static _assertPanelMainViewId(panel, expectedId) {
    const mainViewId = panel.elements.multiview.getAttribute("mainViewId");
    is(
      mainViewId,
      expectedId,
      "The mainViewId should match its expected value"
    );
  }

  /**
   * Asserts that the selected language in the menu matches the langTag or l10nId.
   *
   * @param {Element} menuList - The menu list element to check.
   * @param {object} options - Options containing 'langTag' and 'l10nId' to assert against.
   * @param {string} [options.langTag] - The BCP-47 language tag to match.
   * @param {string} [options.l10nId] - The localization Id to match.
   */
  static _assertSelectedLanguage(menuList, { langTag, l10nId }) {
    ok(
      menuList.label,
      `The label for the menulist ${menuList.id} should not be empty.`
    );
    if (langTag !== undefined) {
      is(
        menuList.value,
        langTag,
        `Expected ${menuList.id} selection to match '${langTag}'`
      );
    }
    if (l10nId !== undefined) {
      is(
        menuList.getAttribute("data-l10n-id"),
        l10nId,
        `Expected ${menuList.id} l10nId to match '${l10nId}'`
      );
    }
  }

  /**
   * Asserts the visibility of the given elements based on the given expectations.
   *
   * @param {object} elements - An object containing the elements to be checked for visibility.
   * @param {object} expectations - An object where each property corresponds to a property in elements,
   *                                and its value is a boolean indicating whether the element should
   *                                be visible (true) or hidden (false).
   * @throws Throws if elements does not contain a property for each property in expectations.
   */
  static _assertPanelElementVisibility(elements, expectations) {
    const hidden = {};
    const visible = {};

    for (const propertyName in expectations) {
      ok(
        elements.hasOwnProperty(propertyName),
        `Expected panel elements to have property ${propertyName}`
      );
      if (expectations[propertyName]) {
        visible[propertyName] = elements[propertyName];
      } else {
        hidden[propertyName] = elements[propertyName];
      }
    }

    assertVisibility({ hidden, visible });
  }

  /**
   * Asserts that the given elements are focusable in order
   * via the tab key, starting with the first element already
   * focused and ending back on that same first element.
   *
   * @param {Element[]} elements - The focusable elements.
   */
  static _assertTabIndexOrder(elements) {
    const activeElementAtStart = document.activeElement;

    if (elements.length) {
      elements[0].focus();
      elements.push(elements[0]);
    }
    for (const element of elements) {
      SharedTranslationsTestUtils._assertHasFocus(element);
      EventUtils.synthesizeKey("KEY_Tab");
    }

    activeElementAtStart.focus();
  }

  /**
   * Executes the provided callback before waiting for the event and then waits for the given event
   * to be fired for the element corresponding to the provided elementId.
   *
   * Optionally executes a postEventAssertion function once the event occurs.
   *
   * @param {string} elementId - The Id of the element to wait for the event on.
   * @param {string} eventName - The name of the event to wait for.
   * @param {Function} callback - A callback function to execute immediately before waiting for the event.
   *                              This is often used to trigger the event on the expected element.
   * @param {Function|null} [postEventAssertion=null] - An optional callback function to execute after
   *                                                    the event has occurred.
   * @param {ChromeWindow} [win]
   * @throws Throws if the element with the specified `elementId` does not exist.
   * @returns {Promise<void>}
   */
  static async _waitForPopupEvent(
    elementId,
    eventName,
    callback,
    postEventAssertion = null,
    win = window
  ) {
    const element = win.document.getElementById(elementId);
    if (!element) {
      throw new Error(
        `Unable to find the ${elementId} element in the document.`
      );
    }
    const promise = BrowserTestUtils.waitForEvent(element, eventName);
    await callback();
    info(`Waiting for the ${elementId} ${eventName} event`);
    await promise;
    if (postEventAssertion) {
      await postEventAssertion();
    }
    // Wait a single tick on the event loop.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

/**
 * A class containing test utility functions specific to testing full-page translations.
 */
class FullPageTranslationsTestUtils {
  /**
   * A collection of element visibility expectations for the default panel view.
   */
  static #defaultViewVisibilityExpectations = {
    cancelButton: true,
    fromMenuList: true,
    fromLabel: true,
    header: true,
    langSelection: true,
    toMenuList: true,
    toLabel: true,
    translateButton: true,
  };

  /**
   * Asserts that the state of a checkbox with a given dataL10nId is
   * checked or not, based on the value of expected being true or false.
   *
   * @param {string} dataL10nId - The data-l10n-id of the checkbox.
   * @param {object} expectations
   * @param {string} expectations.langTag - A BCP-47 language tag.
   * @param {boolean} expectations.checked - Whether the checkbox is expected to be checked.
   * @param {boolean} expectations.disabled - Whether the menuitem is expected to be disabled.
   */
  static async #assertCheckboxState(
    dataL10nId,
    { langTag = null, checked = true, disabled = false }
  ) {
    const menuItems = getAllByL10nId(dataL10nId);
    for (const menuItem of menuItems) {
      if (langTag) {
        const {
          args: { language },
        } = document.l10n.getAttributes(menuItem);
        is(
          language,
          getIntlDisplayName(langTag),
          `Should match expected language display name for ${dataL10nId}`
        );
      }
      is(
        menuItem.disabled,
        disabled,
        `Should match expected disabled state for ${dataL10nId}`
      );
      await waitForCondition(
        () => menuItem.getAttribute("checked") === (checked ? "true" : "false"),
        "Waiting for checkbox state"
      );
      is(
        menuItem.getAttribute("checked"),
        checked ? "true" : "false",
        `Should match expected checkbox state for ${dataL10nId}`
      );
    }
  }

  /**
   * Asserts that the always-offer-translations checkbox matches the expected checked state.
   *
   * @param {boolean} checked
   */
  static async assertIsAlwaysOfferTranslationsEnabled(checked) {
    info(
      `Checking that always-offer-translations is ${
        checked ? "enabled" : "disabled"
      }`
    );
    await FullPageTranslationsTestUtils.#assertCheckboxState(
      "translations-panel-settings-always-offer-translation",
      { checked }
    );
  }

  /**
   * Asserts that the always-translate-language checkbox matches the expected checked state.
   *
   * @param {string} langTag - A BCP-47 language tag
   * @param {object} expectations
   * @param {boolean} expectations.checked - Whether the checkbox is expected to be checked.
   * @param {boolean} expectations.disabled - Whether the menuitem is expected to be disabled.
   */
  static async assertIsAlwaysTranslateLanguage(
    langTag,
    { checked = true, disabled = false }
  ) {
    info(
      `Checking that always-translate is ${
        checked ? "enabled" : "disabled"
      } for "${langTag}"`
    );
    await FullPageTranslationsTestUtils.#assertCheckboxState(
      "translations-panel-settings-always-translate-language",
      { langTag, checked, disabled }
    );
  }

  /**
   * Asserts that the never-translate-language checkbox matches the expected checked state.
   *
   * @param {string} langTag - A BCP-47 language tag
   * @param {object} expectations
   * @param {boolean} expectations.checked - Whether the checkbox is expected to be checked.
   * @param {boolean} expectations.disabled - Whether the menuitem is expected to be disabled.
   */
  static async assertIsNeverTranslateLanguage(
    langTag,
    { checked = true, disabled = false }
  ) {
    info(
      `Checking that never-translate is ${
        checked ? "enabled" : "disabled"
      } for "${langTag}"`
    );
    await FullPageTranslationsTestUtils.#assertCheckboxState(
      "translations-panel-settings-never-translate-language",
      { langTag, checked, disabled }
    );
  }

  /**
   * Asserts that the never-translate-site checkbox matches the expected checked state.
   *
   * @param {string} url - The url of a website
   * @param {object} expectations
   * @param {boolean} expectations.checked - Whether the checkbox is expected to be checked.
   * @param {boolean} expectations.disabled - Whether the menuitem is expected to be disabled.
   */
  static async assertIsNeverTranslateSite(
    url,
    { checked = true, disabled = false }
  ) {
    info(
      `Checking that never-translate is ${
        checked ? "enabled" : "disabled"
      } for "${url}"`
    );
    await FullPageTranslationsTestUtils.#assertCheckboxState(
      "translations-panel-settings-never-translate-site",
      { checked, disabled }
    );
  }

  /**
   * Asserts that the proper language tags are shown on the translations button.
   *
   * @param {string} fromLanguage - The BCP-47 language tag being translated from.
   * @param {string} toLanguage - The BCP-47 language tag being translated into.
   * @param {ChromeWindow} win
   */
  static async assertLangTagIsShownOnTranslationsButton(
    fromLanguage,
    toLanguage,
    win = window
  ) {
    info(
      `Ensuring that the translations button displays the language tag "${toLanguage}"`
    );
    const { button, locale } =
      await FullPageTranslationsTestUtils.assertTranslationsButton(
        { button: true, circleArrows: false, locale: true, icon: true },
        "The icon presents the locale.",
        win
      );
    is(
      locale.innerText,
      toLanguage.split("-")[0],
      `The expected language tag "${toLanguage}" is shown.`
    );
    is(
      button.getAttribute("data-l10n-id"),
      "urlbar-translations-button-translated"
    );
    const fromLangDisplay = getIntlDisplayName(fromLanguage);
    const toLangDisplay = getIntlDisplayName(toLanguage);
    is(
      button.getAttribute("data-l10n-args"),
      `{"fromLanguage":"${fromLangDisplay}","toLanguage":"${toLangDisplay}"}`
    );
  }

  /**
   * Waits for all pending translation requests in the TranslationsDocument to complete.
   *
   * @param {Function} runInPage - A function run a closure in the content page.
   */
  static async waitForAllPendingTranslationsToComplete(runInPage) {
    await runInPage(async ({ waitForCondition }) => {
      const translationsChild =
        content.windowGlobalChild.getActor("Translations");

      while (
        translationsChild.translatedDoc?.hasPendingTranslationRequests() ||
        translationsChild.translatedDoc?.hasPendingCallbackOnEventLoop()
      ) {
        await waitForCondition(
          () =>
            !translationsChild.translatedDoc?.hasPendingTranslationRequests(),
          "Waiting for all pending translation requests to complete."
        );

        await waitForCondition(
          () =>
            !translationsChild.translatedDoc?.hasPendingCallbackOnEventLoop(),
          "Waiting for pending event-loop callbacks to resolve in the TranslationsDocument."
        );
      }
    });
  }

  /**
   * Waits until no elements are being observed for content intersection,
   * indicating that every content-translation request has completed
   * (barring future DOM mutations).
   *
   * @param {Function} runInPage – Executes an async closure in the content page.
   */
  static async assertNoElementsAreObservedForContentIntersection(runInPage) {
    await runInPage(async ({ waitForCondition }) => {
      const translationsChild =
        content.windowGlobalChild.getActor("Translations");

      await waitForCondition(
        () =>
          !translationsChild.translatedDoc?.isObservingAnyElementForContentIntersection(),
        "Waiting until no elements are observed for content intersection."
      );
    });
  }

  /**
   * Waits until no elements are being observed for attribute intersection,
   * indicating that every attribute-translation request has completed
   * (barring future DOM mutations).
   *
   * @param {Function} runInPage – Executes an async closure in the content page.
   */
  static async assertNoElementsAreObservedForAttributeIntersection(runInPage) {
    await runInPage(async ({ waitForCondition }) => {
      const translationsChild =
        content.windowGlobalChild.getActor("Translations");

      await waitForCondition(
        () =>
          !translationsChild.translatedDoc?.isObservingAnyElementForAttributeIntersection(),
        "Waiting until no elements are observed for attribute intersection."
      );
    });
  }

  /**
   * Waits until at least one element is being observed for content
   * intersection.
   *
   * @param {Function} runInPage – Executes an async closure in the content page.
   */
  static async assertAnyElementIsObservedForContentIntersection(runInPage) {
    await runInPage(async ({ waitForCondition }) => {
      const translationsChild =
        content.windowGlobalChild.getActor("Translations");

      await waitForCondition(
        () =>
          translationsChild.translatedDoc?.isObservingAnyElementForContentIntersection(),
        "Waiting until an element is observed for content intersection."
      );
    });
  }

  /**
   * Waits until at least one element is being observed for attribute
   * intersection.
   *
   * @param {Function} runInPage – Executes an async closure in the content page.
   */
  static async assertAnyElementIsObservedForAttributeIntersection(runInPage) {
    await runInPage(async ({ waitForCondition }) => {
      const translationsChild =
        content.windowGlobalChild.getActor("Translations");

      await waitForCondition(
        () =>
          translationsChild.translatedDoc?.isObservingAnyElementForAttributeIntersection(),
        "Waiting until an element is observed for attribute intersection."
      );
    });
  }

  /**
   * Waits for any translation request to initialize and become pending within the TranslationsDocument.
   *
   * @param {Function} runInPage - A function run a closure in the content page.
   */
  static async waitForAnyRequestToInitialize(runInPage) {
    await runInPage(async ({ waitForCondition }) => {
      const translationsChild =
        content.windowGlobalChild.getActor("Translations");

      await waitForCondition(
        () => translationsChild.translatedDoc?.hasPendingTranslationRequests(),
        "Waiting for any translation request to initialize."
      );
    });
  }

  /**
   * Asserts that the Spanish test page H1 element's content has been translated into the target language.
   *
   * @param {object} options - The options for the assertion.
   *
   * @param {string} options.fromLanguage - The BCP-47 language tag being translated from.
   * @param {string} options.toLanguage - The BCP-47 language tag being translated into.
   * @param {Function} options.runInPage - Allows running a closure in the content page.
   * @param {boolean} [options.endToEndTest=false] - Whether this assertion is for an end-to-end test.
   * @param {string} [options.message] - An optional message to log to info.
   */
  static async assertPageH1ContentIsTranslated({
    fromLanguage,
    toLanguage,
    runInPage,
    endToEndTest = false,
    message = null,
  }) {
    if (message) {
      info(message);
    }
    info("Checking that the page header is translated");
    let callback;
    if (endToEndTest) {
      callback = async TranslationsTest => {
        const { getH1 } = TranslationsTest.getSelectors();
        await TranslationsTest.assertTranslationResult(
          "The page's H1 is translated.",
          getH1,
          "Don Quixote de La Mancha"
        );
      };
    } else {
      callback = async (TranslationsTest, { fromLang, toLang }) => {
        const { getH1 } = TranslationsTest.getSelectors();
        await TranslationsTest.assertTranslationResult(
          "The page's H1 is translated.",
          getH1,
          `DON QUIJOTE DE LA MANCHA [${fromLang} to ${toLang}]`
        );
      };
    }

    await runInPage(callback, { fromLang: fromLanguage, toLang: toLanguage });
  }

  /**
   * Asserts that the Spanish test page H1 element's content is not translated into the target language.
   *
   * @param {object} options - The options for the assertion.
   *
   * @param {Function} options.runInPage - Allows running a closure in the content page.
   * @param {string} [options.message] - An optional message to log to info.
   */
  static async assertPageH1ContentIsNotTranslated({
    runInPage,
    message = null,
  }) {
    if (message) {
      info(message);
    }

    info("Checking that the page header is not translated");
    await runInPage(async TranslationsTest => {
      const { getH1 } = TranslationsTest.getSelectors();
      await TranslationsTest.assertTranslationResult(
        "The page's H1 is not translated and is in the original Spanish.",
        getH1,
        "Don Quijote de La Mancha"
      );
    });
  }

  /**
   * Asserts that the Spanish test page H1 element's title has been translated into the target language.
   *
   * @param {object} options - The options for the assertion.
   *
   * @param {string} options.fromLanguage - The BCP-47 language tag being translated from.
   * @param {string} options.toLanguage - The BCP-47 language tag being translated into.
   * @param {Function} options.runInPage - Allows running a closure in the content page.
   * @param {boolean} [options.endToEndTest=false] - Whether this assertion is for an end-to-end test.
   * @param {string} [options.message] - An optional message to log to info.
   */
  static async assertPageH1TitleIsTranslated({
    fromLanguage,
    toLanguage,
    runInPage,
    endToEndTest = false,
    message = null,
  }) {
    if (message) {
      info(message);
    }
    info("Checking that the page header's title attribute is translated");
    let callback;
    if (endToEndTest) {
      callback = async TranslationsTest => {
        const { getH1Title } = TranslationsTest.getSelectors();
        await TranslationsTest.assertTranslationResult(
          "The page's H1's title attribute is translated.",
          getH1Title,
          "This is the title of the page header"
        );
      };
    } else {
      callback = async (TranslationsTest, { fromLang, toLang }) => {
        const { getH1Title } = TranslationsTest.getSelectors();
        await TranslationsTest.assertTranslationResult(
          "The page's H1's title attribute is translated.",
          getH1Title,
          `ESTE ES EL TÍTULO DEL ENCABEZADO DE PÁGINA [${fromLang} to ${toLang}]`
        );
      };
    }

    await runInPage(callback, { fromLang: fromLanguage, toLang: toLanguage });
  }

  /**
   * Asserts that the Spanish test page H1 element's title attribute is not translated into the target language.
   *
   * @param {object} options - The options for the assertion.
   *
   * @param {Function} options.runInPage - Allows running a closure in the content page.
   * @param {string} [options.message] - An optional message to log to info.
   */
  static async assertPageH1TitleIsNotTranslated({ runInPage, message = null }) {
    if (message) {
      info(message);
    }

    info("Checking that the page header's title is not translated");
    await runInPage(async TranslationsTest => {
      const { getH1Title } = TranslationsTest.getSelectors();
      await TranslationsTest.assertTranslationResult(
        "The page's H1's title is not translated and is in the original Spanish.",
        getH1Title,
        "Este es el título del encabezado de página"
      );
    });
  }

  /**
   * Asserts that the Spanish test page final <p> element has been translated into the target language.
   *
   * @param {object} options - The options for the assertion.
   *
   * @param {string} options.fromLanguage - The BCP-47 language tag being translated from.
   * @param {string} options.toLanguage - The BCP-47 language tag being translated into.
   * @param {Function} options.runInPage - Allows running a closure in the content page.
   * @param {boolean} [options.endToEndTest=false] - Whether this assertion is for an end-to-end test.
   * @param {string} [options.message] - An optional message to log to info.
   */
  static async assertPageFinalParagraphContentIsTranslated({
    fromLanguage,
    toLanguage,
    runInPage,
    endToEndTest = false,
    message = null,
  }) {
    if (message) {
      info(message);
    }
    info("Checking that the page's final paragraph is translated");
    let callback;
    if (endToEndTest) {
      callback = async TranslationsTest => {
        const { getFinalParagraph } = TranslationsTest.getSelectors();
        await TranslationsTest.assertTranslationResult(
          "The page's final paragraph is translated.",
          getFinalParagraph,
          [
            // TODO (Bug 1967764) We need to investigate why some machines may produce
            // a different translated output, given the same models and the same WASM binary.
            "Well, even if you're more arms than those of the giant Briareo, you'll pay me.",
            "For, though you're more arms than those of the giant Briareo, you'll pay me.",
          ]
        );
      };
    } else {
      callback = async (TranslationsTest, { fromLang, toLang }) => {
        const { getFinalParagraph } = TranslationsTest.getSelectors();
        await TranslationsTest.assertTranslationResult(
          "The page's final paragraph is translated.",
          getFinalParagraph,
          `— PUES, AUNQUE MOVÁIS MÁS BRAZOS QUE LOS DEL GIGANTE BRIAREO, ME LO HABÉIS DE PAGAR. [${fromLang} to ${toLang}]`
        );
      };
    }

    await runInPage(callback, { fromLang: fromLanguage, toLang: toLanguage });
  }

  /**
   * Asserts that the Spanish test page final <p> element is still in its original form.
   *
   * @param {object} options - The options for the assertion.
   *
   * @param {Function} options.runInPage - Allows running a closure in the content page.
   * @param {string} [options.message] - An optional message to log to info.
   */
  static async assertPageFinalParagraphContentIsNotTranslated({
    runInPage,
    message = null,
  }) {
    if (message) {
      info(message);
    }

    info("Checking that the page's final paragraph is not translated");
    await runInPage(async TranslationsTest => {
      const { getFinalParagraph } = TranslationsTest.getSelectors();
      await TranslationsTest.assertTranslationResult(
        "The page's final paragraph is not translated and is in the original Spanish.",
        getFinalParagraph,
        "— Pues, aunque mováis más brazos que los del gigante Briareo, me lo habéis de pagar."
      );
    });
  }

  /**
   * Asserts that the Spanish test page final <p> element's title attribute has been translated into the target language.
   *
   * @param {object} options - The options for the assertion.
   *
   * @param {string} options.fromLanguage - The BCP-47 language tag being translated from.
   * @param {string} options.toLanguage - The BCP-47 language tag being translated into.
   * @param {Function} options.runInPage - Allows running a closure in the content page.
   * @param {boolean} [options.endToEndTest=false] - Whether this assertion is for an end-to-end test.
   * @param {string} [options.message] - An optional message to log to info.
   */
  static async assertPageFinalParagraphTitleIsTranslated({
    fromLanguage,
    toLanguage,
    runInPage,
    endToEndTest = false,
    message = null,
  }) {
    if (message) {
      info(message);
    }
    info("Checking that the final paragraph's title attribute is translated");
    let callback;
    if (endToEndTest) {
      callback = async TranslationsTest => {
        const { getFinalParagraphTitle } = TranslationsTest.getSelectors();
        await TranslationsTest.assertTranslationResult(
          "The final paragraph's title attribute is translated.",
          getFinalParagraphTitle,
          "This is the title of the final paragraph"
        );
      };
    } else {
      callback = async (TranslationsTest, { fromLang, toLang }) => {
        const { getFinalParagraphTitle } = TranslationsTest.getSelectors();
        await TranslationsTest.assertTranslationResult(
          "The final paragraph's title attribute is translated.",
          getFinalParagraphTitle,
          `ESTE ES EL TÍTULO DEL ÚLTIMO PÁRRAFO [${fromLang} to ${toLang}]`
        );
      };
    }

    await runInPage(callback, { fromLang: fromLanguage, toLang: toLanguage });
  }

  /**
   * Asserts that the Spanish test page final <p> element's title attribute is not translated into the target language.
   *
   * @param {object} options - The options for the assertion.
   *
   * @param {Function} options.runInPage - Allows running a closure in the content page.
   * @param {string} [options.message] - An optional message to log to info.
   */
  static async assertPageFinalParagraphTitleIsNotTranslated({
    runInPage,
    message = null,
  }) {
    if (message) {
      info(message);
    }

    info(
      "Checking that the final paragraph's title attribute is not translated"
    );
    await runInPage(async TranslationsTest => {
      const { getFinalParagraphTitle } = TranslationsTest.getSelectors();
      await TranslationsTest.assertTranslationResult(
        "The final paragraph's title attribute is not translated and is in the original Spanish.",
        getFinalParagraphTitle,
        "Este es el título del último párrafo"
      );
    });
  }

  /**
   *
   * @param {object} options - The options for the assertion.
   *
   * @param {string} options.fromLanguage - The BCP-47 language tag being translated from.
   * @param {string} options.toLanguage - The BCP-47 language tag being translated into.
   * @param {Function} options.runInPage - Allows running a closure in the content page.
   * @param {boolean} [options.endToEndTest=false] - Whether this assertion is for an end-to-end test.
   * @param {string} [options.message] - An optional message to log to info.
   * @param {ChromeWindow} [options.win=window] - The window in which to perform the check (defaults to the current window).
   */
  static async assertAllPageContentIsTranslated(options) {
    await FullPageTranslationsTestUtils.assertPageH1ContentIsTranslated(
      options
    );
    await FullPageTranslationsTestUtils.assertPageFinalParagraphContentIsTranslated(
      options
    );

    const { win, fromLanguage, toLanguage, runInPage } = options;

    await FullPageTranslationsTestUtils.assertLangTagIsShownOnTranslationsButton(
      fromLanguage,
      toLanguage,
      win
    );

    await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
      runInPage
    );

    await FullPageTranslationsTestUtils.assertNoElementsAreObservedForContentIntersection(
      runInPage
    );
  }

  /**
   *
   * @param {object} options - The options for the assertion.
   *
   * @param {string} options.fromLanguage - The BCP-47 language tag being translated from.
   * @param {string} options.toLanguage - The BCP-47 language tag being translated into.
   * @param {Function} options.runInPage - Allows running a closure in the content page.
   * @param {boolean} [options.endToEndTest=false] - Whether this assertion is for an end-to-end test.
   * @param {string} [options.message] - An optional message to log to info.
   * @param {ChromeWindow} [options.win=window] - The window in which to perform the check (defaults to the current window).
   */
  static async assertOnlyIntersectingNodesAreTranslated(options) {
    await FullPageTranslationsTestUtils.assertPageH1ContentIsTranslated(
      options
    );
    await FullPageTranslationsTestUtils.assertPageH1TitleIsTranslated(options);

    const { win, fromLanguage, toLanguage, runInPage } = options;

    await FullPageTranslationsTestUtils.assertLangTagIsShownOnTranslationsButton(
      fromLanguage,
      toLanguage,
      win
    );

    await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
      runInPage
    );

    await FullPageTranslationsTestUtils.assertPageFinalParagraphContentIsNotTranslated(
      options
    );

    await FullPageTranslationsTestUtils.assertPageFinalParagraphTitleIsNotTranslated(
      options
    );

    await FullPageTranslationsTestUtils.assertAnyElementIsObservedForContentIntersection(
      runInPage
    );

    await FullPageTranslationsTestUtils.assertAnyElementIsObservedForAttributeIntersection(
      runInPage
    );
  }

  /**
   * Asserts that the Spanish test page is not translated by checking
   * that the H1 element is still in its original Spanish form.
   *
   * @param {Function} runInPage - Allows running a closure in the content page.
   * @param {string} message - An optional message to log to info.
   */
  static async assertPageIsNotTranslated(runInPage, message = null) {
    if (message) {
      info(message);
    }

    info("Ensuring that no translation requests are pending.");
    await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
      runInPage
    );

    info("Checking that the page is not translated");

    await FullPageTranslationsTestUtils.assertPageH1ContentIsNotTranslated({
      runInPage,
      message,
    });

    await FullPageTranslationsTestUtils.assertPageH1TitleIsNotTranslated({
      runInPage,
      message,
    });

    await FullPageTranslationsTestUtils.assertPageFinalParagraphContentIsNotTranslated(
      {
        runInPage,
        message,
      }
    );

    await FullPageTranslationsTestUtils.assertPageFinalParagraphTitleIsNotTranslated(
      {
        runInPage,
        message,
      }
    );
  }

  /**
   * Asserts that for each provided expectation, the visible state of the corresponding
   * element in FullPageTranslationsPanel.elements both exists and matches the visibility expectation.
   *
   * @param {object} expectations
   *   A list of expectations for the visibility of any subset of FullPageTranslationsPanel.elements
   */
  static #assertPanelElementVisibility(expectations = {}) {
    SharedTranslationsTestUtils._assertPanelElementVisibility(
      FullPageTranslationsPanel.elements,
      {
        cancelButton: false,
        changeSourceLanguageButton: false,
        dismissErrorButton: false,
        error: false,
        errorMessage: false,
        errorMessageHint: false,
        errorHintAction: false,
        fromLabel: false,
        fromMenuList: false,
        fromMenuPopup: false,
        header: false,
        intro: false,
        introLearnMoreLink: false,
        langSelection: false,
        restoreButton: false,
        toLabel: false,
        toMenuList: false,
        toMenuPopup: false,
        translateButton: false,
        unsupportedHeader: false,
        unsupportedHint: false,
        unsupportedLearnMoreLink: false,
        // Overwrite any of the above defaults with the passed in expectations.
        ...expectations,
      }
    );
  }

  /**
   * Asserts that the FullPageTranslationsPanel header has the expected l10nId.
   *
   * @param {string} l10nId - The expected data-l10n-id of the header.
   */
  static #assertPanelHeaderL10nId(l10nId) {
    const { header } = FullPageTranslationsPanel.elements;
    SharedTranslationsTestUtils._assertL10nId(header, l10nId);
  }

  /**
   * Asserts that the FullPageTranslationsPanel error has the expected l10nId.
   *
   * @param {string} l10nId - The expected data-l10n-id of the error.
   */
  static #assertPanelErrorL10nId(l10nId) {
    const { errorMessage } = FullPageTranslationsPanel.elements;
    SharedTranslationsTestUtils._assertL10nId(errorMessage, l10nId);
  }

  /**
   * Asserts that the mainViewId of the panel matches the given string.
   *
   * @param {string} expectedId
   */
  static #assertPanelMainViewId(expectedId) {
    SharedTranslationsTestUtils._assertPanelMainViewId(
      FullPageTranslationsPanel,
      expectedId
    );

    const panelView = document.getElementById(expectedId);
    const label = document.getElementById(
      panelView.getAttribute("aria-labelledby")
    );
    ok(label, "The a11y label for the panel view can be found.");
    assertVisibility({ visible: { label } });
  }

  /**
   * Asserts that panel element visibility matches the default panel view.
   */
  static assertPanelViewDefault() {
    info("Checking that the panel shows the default view");
    FullPageTranslationsTestUtils.#assertPanelMainViewId(
      "full-page-translations-panel-view-default"
    );
    FullPageTranslationsTestUtils.#assertPanelElementVisibility({
      ...FullPageTranslationsTestUtils.#defaultViewVisibilityExpectations,
    });
    FullPageTranslationsTestUtils.#assertPanelHeaderL10nId(
      "translations-panel-header"
    );
  }

  /**
   * Asserts that panel element visibility matches the initialization-failure view.
   */
  static assertPanelViewInitFailure() {
    info("Checking that the panel shows the default view");
    const { translateButton } = FullPageTranslationsPanel.elements;
    FullPageTranslationsTestUtils.#assertPanelMainViewId(
      "full-page-translations-panel-view-default"
    );
    FullPageTranslationsTestUtils.#assertPanelElementVisibility({
      cancelButton: true,
      error: true,
      errorMessage: true,
      errorMessageHint: true,
      errorHintAction: true,
      header: true,
      translateButton: true,
    });
    is(
      translateButton.disabled,
      true,
      "The translate button should be disabled."
    );
    FullPageTranslationsTestUtils.#assertPanelHeaderL10nId(
      "translations-panel-header"
    );
  }

  /**
   * Asserts that panel element visibility matches the panel error view.
   */
  static assertPanelViewError() {
    info("Checking that the panel shows the error view");
    FullPageTranslationsTestUtils.#assertPanelMainViewId(
      "full-page-translations-panel-view-default"
    );
    FullPageTranslationsTestUtils.#assertPanelElementVisibility({
      error: true,
      errorMessage: true,
      ...FullPageTranslationsTestUtils.#defaultViewVisibilityExpectations,
    });
    FullPageTranslationsTestUtils.#assertPanelHeaderL10nId(
      "translations-panel-header"
    );
    FullPageTranslationsTestUtils.#assertPanelErrorL10nId(
      "translations-panel-error-translating"
    );
  }

  /**
   * Asserts that the panel element visibility matches the panel loading view.
   */
  static assertPanelViewLoading() {
    info("Checking that the panel shows the loading view");
    FullPageTranslationsTestUtils.assertPanelViewDefault();
    const loadingButton = getByL10nId(
      "translations-panel-translate-button-loading"
    );
    ok(loadingButton, "The loading button is present");
    ok(loadingButton.disabled, "The loading button is disabled");
  }

  /**
   * Asserts that panel element visibility matches the panel intro view.
   */
  static assertPanelViewIntro() {
    info("Checking that the panel shows the intro view");
    FullPageTranslationsTestUtils.#assertPanelMainViewId(
      "full-page-translations-panel-view-default"
    );
    FullPageTranslationsTestUtils.#assertPanelElementVisibility({
      intro: true,
      introLearnMoreLink: true,
      ...FullPageTranslationsTestUtils.#defaultViewVisibilityExpectations,
    });
    FullPageTranslationsTestUtils.#assertPanelHeaderL10nId(
      "translations-panel-intro-header"
    );
  }

  /**
   * Asserts that panel element visibility matches the panel intro error view.
   */
  static assertPanelViewIntroError() {
    info("Checking that the panel shows the intro error view");
    FullPageTranslationsTestUtils.#assertPanelMainViewId(
      "full-page-translations-panel-view-default"
    );
    FullPageTranslationsTestUtils.#assertPanelElementVisibility({
      error: true,
      intro: true,
      introLearnMoreLink: true,
      ...FullPageTranslationsTestUtils.#defaultViewVisibilityExpectations,
    });
    FullPageTranslationsTestUtils.#assertPanelHeaderL10nId(
      "translations-panel-intro-header"
    );
  }

  /**
   * Asserts that panel element visibility matches the panel revisit view.
   */
  static assertPanelViewRevisit() {
    info("Checking that the panel shows the revisit view");
    FullPageTranslationsTestUtils.#assertPanelMainViewId(
      "full-page-translations-panel-view-default"
    );
    FullPageTranslationsTestUtils.#assertPanelElementVisibility({
      header: true,
      langSelection: true,
      restoreButton: true,
      toLabel: true,
      toMenuList: true,
      translateButton: true,
    });
    FullPageTranslationsTestUtils.#assertPanelHeaderL10nId(
      "translations-panel-revisit-header"
    );
  }

  /**
   * Asserts that panel element visibility matches the panel unsupported language view.
   */
  static assertPanelViewUnsupportedLanguage() {
    info("Checking that the panel shows the unsupported-language view");
    FullPageTranslationsTestUtils.#assertPanelMainViewId(
      "full-page-translations-panel-view-unsupported-language"
    );
    FullPageTranslationsTestUtils.#assertPanelElementVisibility({
      changeSourceLanguageButton: true,
      dismissErrorButton: true,
      unsupportedHeader: true,
      unsupportedHint: true,
      unsupportedLearnMoreLink: true,
    });
  }

  /**
   * Asserts that the selected from-language matches the provided language tag.
   *
   * @param {object} options - Options containing 'langTag' and 'l10nId' to assert against.
   * @param {string} [options.langTag] - The BCP-47 language tag to match.
   * @param {string} [options.l10nId] - The localization Id to match.
   * @param {ChromeWindow} [options.win]
   *  - An optional ChromeWindow, for multi-window tests.
   */
  static assertSelectedFromLanguage({ langTag, l10nId, win = window }) {
    const { fromMenuList } = win.FullPageTranslationsPanel.elements;
    SharedTranslationsTestUtils._assertSelectedLanguage(fromMenuList, {
      langTag,
      l10nId,
    });
  }

  /**
   * Asserts that the selected to-language matches the provided language tag.
   *
   * @param {object} options - Options containing 'langTag' and 'l10nId' to assert against.
   * @param {string} [options.langTag] - The BCP-47 language tag to match.
   * @param {string} [options.l10nId] - The localization Id to match.
   * @param {ChromeWindow} [options.win]
   *  - An optional ChromeWindow, for multi-window tests.
   */
  static assertSelectedToLanguage({ langTag, l10nId, win = window }) {
    const { toMenuList } = win.FullPageTranslationsPanel.elements;
    SharedTranslationsTestUtils._assertSelectedLanguage(toMenuList, {
      langTag,
      l10nId,
    });
  }

  /**
   * Assert some property about the translations button.
   *
   * @param {Record<string, boolean>} visibleAssertions
   * @param {string} message The message for the assertion.
   * @param {ChromeWindow} [win]
   * @returns {HTMLElement}
   */
  static async assertTranslationsButton(
    visibleAssertions,
    message,
    win = window
  ) {
    const elements = {
      button: win.document.getElementById("translations-button"),
      icon: win.document.getElementById("translations-button-icon"),
      circleArrows: win.document.getElementById(
        "translations-button-circle-arrows"
      ),
      locale: win.document.getElementById("translations-button-locale"),
    };

    for (const [name, element] of Object.entries(elements)) {
      if (!element) {
        throw new Error("Could not find the " + name);
      }
    }

    try {
      // Test that the visibilities match.
      await waitForCondition(() => {
        for (const [name, visible] of Object.entries(visibleAssertions)) {
          if (elements[name].hidden === visible) {
            return false;
          }
        }
        return true;
      }, message);
    } catch (error) {
      // On a mismatch, report it.
      for (const [name, expected] of Object.entries(visibleAssertions)) {
        is(!elements[name].hidden, expected, `Visibility for "${name}"`);
      }
    }

    ok(true, message);

    return elements;
  }

  /**
   * Simulates the effect of clicking the always-offer-translations menuitem.
   * Requires that the settings menu of the translations panel is open,
   * otherwise the test will fail.
   */
  static async clickAlwaysOfferTranslations() {
    logAction();
    await FullPageTranslationsTestUtils.#clickSettingsMenuItemByL10nId(
      "translations-panel-settings-always-offer-translation"
    );
  }

  /**
   * Simulates the effect of clicking the always-translate-language menuitem.
   * Requires that the settings menu of the translations panel is open,
   * otherwise the test will fail.
   */
  static async clickAlwaysTranslateLanguage({
    downloadHandler = null,
    pivotTranslation = false,
  } = {}) {
    logAction();
    await FullPageTranslationsTestUtils.#clickSettingsMenuItemByL10nId(
      "translations-panel-settings-always-translate-language"
    );
    if (downloadHandler) {
      await FullPageTranslationsTestUtils.assertTranslationsButton(
        { button: true, circleArrows: true, locale: false, icon: true },
        "The icon presents the loading indicator."
      );
      await downloadHandler(pivotTranslation ? 2 : 1);
    }
  }

  /**
   * Simulates clicking the cancel button.
   */
  static async clickCancelButton() {
    logAction();
    const { cancelButton } = FullPageTranslationsPanel.elements;
    assertVisibility({ visible: { cancelButton } });
    await FullPageTranslationsTestUtils.waitForPanelPopupEvent(
      "popuphidden",
      () => {
        click(cancelButton, "Clicking the cancel button");
      }
    );
  }

  /**
   * Simulates clicking the change-source-language button.
   *
   * @param {object} config
   * @param {boolean} config.intro
   *  - True if the intro view should be expected
   *    False if the default view should be expected
   */
  static async clickChangeSourceLanguageButton({ intro = false } = {}) {
    logAction();
    const { changeSourceLanguageButton } = FullPageTranslationsPanel.elements;
    assertVisibility({ visible: { changeSourceLanguageButton } });
    await FullPageTranslationsTestUtils.waitForPanelPopupEvent(
      "popupshown",
      () => {
        click(
          changeSourceLanguageButton,
          "Click the change-source-language button"
        );
      },
      intro
        ? FullPageTranslationsTestUtils.assertPanelViewIntro
        : FullPageTranslationsTestUtils.assertPanelViewDefault
    );
  }

  /**
   * Simulates clicking the dismiss-error button.
   */
  static async clickDismissErrorButton() {
    logAction();
    const { dismissErrorButton } = FullPageTranslationsPanel.elements;
    assertVisibility({ visible: { dismissErrorButton } });
    await FullPageTranslationsTestUtils.waitForPanelPopupEvent(
      "popuphidden",
      () => {
        click(dismissErrorButton, "Click the dismiss-error button");
      }
    );
  }

  /**
   * Simulates the effect of clicking the manage-languages menuitem.
   * Requires that the settings menu of the translations panel is open,
   * otherwise the test will fail.
   */
  static async clickManageLanguages() {
    logAction();
    await FullPageTranslationsTestUtils.#clickSettingsMenuItemByL10nId(
      "translations-panel-settings-manage-languages"
    );
  }

  /**
   * Simulates the effect of clicking the never-translate-language menuitem.
   * Requires that the settings menu of the translations panel is open,
   * otherwise the test will fail.
   */
  static async clickNeverTranslateLanguage() {
    logAction();
    await FullPageTranslationsTestUtils.#clickSettingsMenuItemByL10nId(
      "translations-panel-settings-never-translate-language"
    );
  }

  /**
   * Simulates the effect of clicking the never-translate-site menuitem.
   * Requires that the settings menu of the translations panel is open,
   * otherwise the test will fail.
   */
  static async clickNeverTranslateSite() {
    logAction();
    await FullPageTranslationsTestUtils.#clickSettingsMenuItemByL10nId(
      "translations-panel-settings-never-translate-site"
    );
  }

  /**
   * Simulates clicking the restore-page button.
   *
   * @param {ChromeWindow} [win]
   *  - An optional ChromeWindow, for multi-window tests.
   */
  static async clickRestoreButton(win = window) {
    logAction();
    const { restoreButton } = win.FullPageTranslationsPanel.elements;
    assertVisibility({ visible: { restoreButton } });
    await FullPageTranslationsTestUtils.waitForPanelPopupEvent(
      "popuphidden",
      () => {
        click(restoreButton, "Click the restore-page button");
      }
    );
  }

  /*
   * Simulates the effect of toggling a menu item in the translations panel
   * settings menu. Requires that the settings menu is currently open,
   * otherwise the test will fail.
   */
  static async #clickSettingsMenuItemByL10nId(l10nId) {
    info(`Toggling the "${l10nId}" settings menu item.`);
    click(getByL10nId(l10nId), `Clicking the "${l10nId}" settings menu item.`);
    await closeFullPagePanelSettingsMenuIfOpen();
  }

  /**
   * Simulates clicking the translate button.
   *
   * @param {object} config
   * @param {Function} config.downloadHandler
   *  - The function handle expected downloads, resolveDownloads() or rejectDownloads()
   *    Leave as null to test more granularly, such as testing opening the loading view,
   *    or allowing for the automatic downloading of files.
   * @param {boolean} config.pivotTranslation
   *  - True if the expected translation is a pivot translation, otherwise false.
   *    Affects the number of expected downloads.
   * @param {Function} config.onOpenPanel
   *  - A function to run as soon as the panel opens.
   * @param {ChromeWindow} [config.win]
   *  - An optional ChromeWindow, for multi-window tests.
   */
  static async clickTranslateButton({
    downloadHandler = null,
    pivotTranslation = false,
    onOpenPanel = null,
    win = window,
  } = {}) {
    logAction();
    const { translateButton } = win.FullPageTranslationsPanel.elements;
    assertVisibility({ visible: { translateButton } });
    await FullPageTranslationsTestUtils.waitForPanelPopupEvent(
      "popuphidden",
      () => {
        click(translateButton);
      },
      null /* postEventAssertion */,
      win
    );

    let panelOpenCallbackPromise;
    if (onOpenPanel) {
      panelOpenCallbackPromise =
        FullPageTranslationsTestUtils.waitForPanelPopupEvent(
          "popupshown",
          () => {},
          onOpenPanel
        );
    }

    if (downloadHandler) {
      await FullPageTranslationsTestUtils.assertTranslationsButton(
        { button: true, circleArrows: true, locale: false, icon: true },
        "The icon presents the loading indicator.",
        win
      );
      await downloadHandler(pivotTranslation ? 2 : 1);
    }

    await panelOpenCallbackPromise;
  }

  /**
   * Opens the translations panel.
   *
   * @param {object} config
   * @param {Function} config.onOpenPanel
   *  - A function to run as soon as the panel opens.
   * @param {boolean} config.openFromAppMenu
   *  - Open the panel from the app menu. If false, uses the translations button.
   * @param {boolean} config.openWithKeyboard
   *  - Open the panel by synthesizing the keyboard. If false, synthesizes the mouse.
   * @param {string} [config.expectedFromLanguage] - The expected from-language tag.
   * @param {string} [config.expectedToLanguage] - The expected to-language tag.
   * @param {ChromeWindow} [config.win]
   *  - An optional window for multi-window tests.
   */
  static async openPanel({
    onOpenPanel = null,
    openFromAppMenu = false,
    openWithKeyboard = false,
    expectedFromLanguage = undefined,
    expectedToLanguage = undefined,
    win = window,
  }) {
    logAction();
    await closeAllOpenPanelsAndMenus(win);
    if (openFromAppMenu) {
      await FullPageTranslationsTestUtils.#openPanelViaAppMenu({
        win,
        onOpenPanel,
        openWithKeyboard,
      });
    } else {
      await FullPageTranslationsTestUtils.#openPanelViaTranslationsButton({
        win,
        onOpenPanel,
        openWithKeyboard,
      });
    }
    if (expectedFromLanguage !== undefined) {
      FullPageTranslationsTestUtils.assertSelectedFromLanguage({
        win,
        langTag: expectedFromLanguage,
      });
    }
    if (expectedToLanguage !== undefined) {
      FullPageTranslationsTestUtils.assertSelectedToLanguage({
        win,
        langTag: expectedToLanguage,
      });
    }
  }

  /**
   * Opens the translations panel via the app menu.
   *
   * @param {object} config
   * @param {Function} config.onOpenPanel
   *  - A function to run as soon as the panel opens.
   * @param {boolean} config.openWithKeyboard
   *  - Open the panel by synthesizing the keyboard. If false, synthesizes the mouse.
   * @param {ChromeWindow} [config.win]
   */
  static async #openPanelViaAppMenu({
    onOpenPanel = null,
    openWithKeyboard = false,
    win = window,
  }) {
    logAction();
    const appMenuButton = getById("PanelUI-menu-button", win.document);
    if (openWithKeyboard) {
      hitEnterKey(appMenuButton, "Opening the app-menu button with keyboard");
    } else {
      click(appMenuButton, "Opening the app-menu button");
    }
    await BrowserTestUtils.waitForEvent(win.PanelUI.mainView, "ViewShown");

    const translateSiteButton = getById(
      "appMenu-translate-button",
      win.document
    );

    is(
      translateSiteButton.disabled,
      false,
      "The app-menu translate button should be enabled"
    );

    await FullPageTranslationsTestUtils.waitForPanelPopupEvent(
      "popupshown",
      () => {
        if (openWithKeyboard) {
          hitEnterKey(translateSiteButton, "Opening the popup with keyboard");
        } else {
          click(translateSiteButton, "Opening the popup");
        }
      },
      onOpenPanel
    );
  }

  /**
   * Opens the translations panel via the translations button.
   *
   * @param {object} config
   * @param {Function} config.onOpenPanel
   *  - A function to run as soon as the panel opens.
   * @param {boolean} config.openWithKeyboard
   *  - Open the panel by synthesizing the keyboard. If false, synthesizes the mouse.
   * @param {ChromeWindow} [config.win]
   */
  static async #openPanelViaTranslationsButton({
    onOpenPanel = null,
    openWithKeyboard = false,
    win = window,
  }) {
    logAction();
    const { button } =
      await FullPageTranslationsTestUtils.assertTranslationsButton(
        { button: true },
        "The translations button is visible.",
        win
      );
    await FullPageTranslationsTestUtils.waitForPanelPopupEvent(
      "popupshown",
      () => {
        if (openWithKeyboard) {
          hitEnterKey(button, "Opening the popup with keyboard");
        } else {
          click(button, "Opening the popup");
        }
      },
      onOpenPanel,
      win
    );
  }

  /**
   * Opens the translations panel settings menu.
   * Requires that the translations panel is already open.
   */
  static async openTranslationsSettingsMenu() {
    logAction();
    const gearIcons = getAllByL10nId("translations-panel-settings-button");
    for (const gearIcon of gearIcons) {
      if (BrowserTestUtils.isHidden(gearIcon)) {
        continue;
      }
      click(gearIcon, "Open the settings menu");
      info("Waiting for settings menu to open.");
      const manageLanguages = await waitForCondition(() =>
        maybeGetByL10nId("translations-panel-settings-manage-languages")
      );
      ok(
        manageLanguages,
        "The manage languages item should be visible in the settings menu."
      );
      return;
    }
  }

  /**
   * Changes the selected language by opening the dropdown menu for each provided language tag.
   *
   * @param {string} langTag - The BCP-47 language tag to select from the dropdown menu.
   * @param {object} elements - Elements involved in the dropdown language selection process.
   * @param {Element} elements.menuList - The element that triggers the dropdown menu.
   * @param {Element} elements.menuPopup - The dropdown menu element containing selectable languages.
   * @param {ChromeWindow} [win]
   *  - An optional ChromeWindow, for multi-window tests.
   *
   * @returns {Promise<void>}
   */
  static async #changeSelectedLanguage(langTag, elements, win = window) {
    const { menuList, menuPopup } = elements;

    await FullPageTranslationsTestUtils.waitForPanelPopupEvent(
      "popupshown",
      () => click(menuList),
      null /* postEventAssertion */,
      win
    );

    const menuItem = menuPopup.querySelector(`[value="${langTag}"]`);
    await FullPageTranslationsTestUtils.waitForPanelPopupEvent(
      "popuphidden",
      () => {
        click(menuItem);
        // Synthesizing a click on the menuitem isn't closing the popup
        // as a click normally would, so this tab keypress is added to
        // ensure the popup closes.
        EventUtils.synthesizeKey("KEY_Tab", {}, win);
      },
      null /* postEventAssertion */,
      win
    );
  }

  /**
   * Switches the selected from-language to the provided language tag.
   *
   * @param {object} options
   * @param {string} options.langTag - A BCP-47 language tag.
   * @param {ChromeWindow} [options.win]
   *  - An optional ChromeWindow, for multi-window tests.
   */
  static async changeSelectedFromLanguage({ langTag, win = window }) {
    logAction(langTag);
    const { fromMenuList: menuList, fromMenuPopup: menuPopup } =
      win.FullPageTranslationsPanel.elements;
    await FullPageTranslationsTestUtils.#changeSelectedLanguage(
      langTag,
      {
        menuList,
        menuPopup,
      },
      win
    );
  }

  /**
   * Switches the selected to-language to the provided language tag.
   *
   * @param {object} options
   * @param {string} options.langTag - A BCP-47 language tag.
   * @param {ChromeWindow} [options.win]
   *  - An optional ChromeWindow, for multi-window tests.
   */
  static async changeSelectedToLanguage({ langTag, win = window }) {
    logAction(langTag);
    const { toMenuList: menuList, toMenuPopup: menuPopup } =
      win.FullPageTranslationsPanel.elements;
    await FullPageTranslationsTestUtils.#changeSelectedLanguage(
      langTag,
      {
        menuList,
        menuPopup,
      },
      win
    );
  }

  /**
   * XUL popups will fire the popupshown and popuphidden events. These will fire for
   * any type of popup in the browser. This function waits for one of those events, and
   * checks that the viewId of the popup is PanelUI-profiler
   *
   * @param {"popupshown" | "popuphidden"} eventName
   * @param {Function} callback
   * @param {Function} postEventAssertion
   *   An optional assertion to be made immediately after the event occurs.
   * @param {ChromeWindow} [win]
   * @returns {Promise<void>}
   */
  static async waitForPanelPopupEvent(
    eventName,
    callback,
    postEventAssertion = null,
    win = window
  ) {
    // De-lazify the panel elements.
    win.FullPageTranslationsPanel.elements;
    await SharedTranslationsTestUtils._waitForPopupEvent(
      "full-page-translations-panel",
      eventName,
      callback,
      postEventAssertion,
      win
    );
  }
}

/**
 * A class containing test utility functions specific to testing select translations.
 */
class SelectTranslationsTestUtils {
  /**
   * Opens the context menu then asserts properties of the translate-selection item in the context menu.
   *
   * @param {Function} runInPage - A content-exposed function to run within the context of the page.
   * @param {object} options - Options for how to open the context menu and what properties to assert about the translate-selection item.
   *
   * @param {boolean} options.expectMenuItemVisible - Whether the select-translations menu item should be present in the context menu.
   * @param {boolean} options.expectedTargetLanguage - The expected target language to be shown in the context menu.
   *
   * The following options will work on all test pages that have an <h1> element.
   *
   * @param {boolean} options.selectH1 - Selects the first H1 element of the page.
   * @param {boolean} options.openAtH1 - Opens the context menu at the first H1 element of the page.
   *
   * The following options will work only in the PDF_TEST_PAGE_URL.
   *
   * @param {boolean} options.selectPdfSpan - Selects the first span of text on the first page of a pdf.
   * @param {boolean} options.openAtPdfSpan - Opens the context menu at the first span of text on the first page of a pdf.
   *
   * The following options will only work when testing SELECT_TEST_PAGE_URL.
   *
   * @param {boolean} options.selectFrenchSection - Selects the section of French text.
   * @param {boolean} options.selectEnglishSection - Selects the section of English text.
   * @param {boolean} options.selectSpanishSection - Selects the section of Spanish text.
   * @param {boolean} options.selectFrenchSentence - Selects a French sentence.
   * @param {boolean} options.selectEnglishSentence - Selects an English sentence.
   * @param {boolean} options.selectSpanishSentence - Selects a Spanish sentence.
   * @param {boolean} options.openAtFrenchSection - Opens the context menu at the section of French text.
   * @param {boolean} options.openAtEnglishSection - Opens the context menu at the section of English text.
   * @param {boolean} options.openAtSpanishSection - Opens the context menu at the section of Spanish text.
   * @param {boolean} options.openAtFrenchSentence - Opens the context menu at a French sentence.
   * @param {boolean} options.openAtEnglishSentence - Opens the context menu at an English sentence.
   * @param {boolean} options.openAtSpanishSentence - Opens the context menu at a Spanish sentence.
   * @param {boolean} options.openAtFrenchHyperlink - Opens the context menu at a hyperlinked French text.
   * @param {boolean} options.openAtEnglishHyperlink - Opens the context menu at a hyperlinked English text.
   * @param {boolean} options.openAtSpanishHyperlink - Opens the context menu at a hyperlinked Spanish text.
   * @param {boolean} options.openAtURLHyperlink - Opens the context menu at a hyperlinked URL text.
   * @param {string} [message] - A message to log to info.
   * @throws Throws an error if the properties of the translate-selection item do not match the expected options.
   */
  static async assertContextMenuTranslateSelectionItem(
    runInPage,
    {
      expectMenuItemVisible,
      expectedTargetLanguage,
      selectH1,
      selectPdfSpan,
      selectFrenchSection,
      selectEnglishSection,
      selectSpanishSection,
      selectFrenchSentence,
      selectEnglishSentence,
      selectSpanishSentence,
      openAtH1,
      openAtPdfSpan,
      openAtFrenchSection,
      openAtEnglishSection,
      openAtSpanishSection,
      openAtFrenchSentence,
      openAtEnglishSentence,
      openAtSpanishSentence,
      openAtFrenchHyperlink,
      openAtEnglishHyperlink,
      openAtSpanishHyperlink,
      openAtURLHyperlink,
    },
    message
  ) {
    logAction();

    if (message) {
      info(message);
    }

    await closeAllOpenPanelsAndMenus();

    await SelectTranslationsTestUtils.openContextMenu(runInPage, {
      expectMenuItemVisible,
      expectedTargetLanguage,
      selectH1,
      selectPdfSpan,
      selectFrenchSection,
      selectEnglishSection,
      selectSpanishSection,
      selectFrenchSentence,
      selectEnglishSentence,
      selectSpanishSentence,
      openAtH1,
      openAtPdfSpan,
      openAtFrenchSection,
      openAtEnglishSection,
      openAtSpanishSection,
      openAtFrenchSentence,
      openAtEnglishSentence,
      openAtSpanishSentence,
      openAtFrenchHyperlink,
      openAtEnglishHyperlink,
      openAtSpanishHyperlink,
      openAtURLHyperlink,
    });

    const menuItem = maybeGetById(
      "context-translate-selection",
      /* ensureIsVisible */ false
    );

    if (expectMenuItemVisible !== undefined) {
      const visibility = expectMenuItemVisible ? "visible" : "hidden";
      assertVisibility({ [visibility]: { menuItem } });
    }

    if (expectMenuItemVisible === true) {
      if (expectedTargetLanguage) {
        // Target language expected, check for the data-l10n-id with a `{$language}` argument.
        const expectedL10nId =
          selectH1 ||
          selectPdfSpan ||
          selectFrenchSection ||
          selectEnglishSection ||
          selectSpanishSection ||
          selectFrenchSentence ||
          selectEnglishSentence ||
          selectSpanishSentence
            ? "main-context-menu-translate-selection-to-language"
            : "main-context-menu-translate-link-text-to-language";

        await waitForCondition(
          () =>
            TranslationsUtils.langTagsMatch(
              menuItem.getAttribute("target-language"),
              expectedTargetLanguage
            ),
          `Waiting for translate-selection context menu item to match the expected target language ${expectedTargetLanguage}`
        );
        await waitForCondition(
          () => menuItem.getAttribute("data-l10n-id") === expectedL10nId,
          `Waiting for translate-selection context menu item to have the correct data-l10n-id '${expectedL10nId}`
        );

        if (Services.locale.appLocaleAsBCP47 === "en-US") {
          // We only want to test the localized name in CI if the current app locale is the default (en-US).
          const expectedLanguageDisplayName = getIntlDisplayName(
            expectedTargetLanguage
          );
          await waitForCondition(() => {
            const l10nArgs = JSON.parse(
              menuItem.getAttribute("data-l10n-args")
            );
            return l10nArgs.language === expectedLanguageDisplayName;
          }, `Waiting for translate-selection context menu item to have the correct data-l10n-args '${expectedLanguageDisplayName}`);
        }
      } else {
        // No target language expected, check for the data-l10n-id that has no `{$language}` argument.
        const expectedL10nId =
          selectH1 ||
          selectPdfSpan ||
          selectFrenchSection ||
          selectEnglishSection ||
          selectSpanishSection ||
          selectFrenchSentence ||
          selectEnglishSentence ||
          selectSpanishSentence
            ? "main-context-menu-translate-selection"
            : "main-context-menu-translate-link-text";
        await waitForCondition(
          () => !menuItem.getAttribute("target-language"),
          "Waiting for translate-selection context menu item to remove its target-language attribute."
        );
        await waitForCondition(
          () => menuItem.getAttribute("data-l10n-id") === expectedL10nId,
          `Waiting for translate-selection context menu item to have the correct data-l10n-id '${expectedL10nId}`
        );
      }
    }
  }

  /**
   * Tests that the context menu displays the expected target language for translation based on
   * the provided configurations.
   *
   * @param {object} options - Options for configuring the test environment and expected language behavior.
   * @param {Array.<string>} options.runInPage - A content-exposed function to run within the context of the page.
   * @param {Array.<string>} [options.systemLocales=[]] - Locales to mock as system locales.
   * @param {Array.<string>} [options.appLocales=[]] - Locales to mock as application locales.
   * @param {Array.<string>} [options.webLanguages=[]] - Languages to mock as web languages.
   * @param {string} options.expectedTargetLanguage - The expected target language for the translate-selection item.
   */
  static async testContextMenuItemWithLocales({
    runInPage,
    systemLocales = [],
    appLocales = [],
    webLanguages = [],
    expectedTargetLanguage,
  }) {
    const cleanupLocales = await mockLocales({
      systemLocales,
      appLocales,
      webLanguages,
    });

    await SelectTranslationsTestUtils.assertContextMenuTranslateSelectionItem(
      runInPage,
      {
        selectSpanishSentence: true,
        openAtSpanishSentence: true,
        expectMenuItemVisible: true,
        expectedTargetLanguage,
      },
      `The translate-selection context menu item should match the expected target language '${expectedTargetLanguage}'`
    );

    await closeAllOpenPanelsAndMenus();
    await cleanupLocales();
  }

  /**
   * Asserts that for each provided expectation, the visible state of the corresponding
   * element in FullPageTranslationsPanel.elements both exists and matches the visibility expectation.
   *
   * @param {object} expectations
   *   A list of expectations for the visibility of any subset of SelectTranslationsPanel.elements
   */
  static #assertPanelElementVisibility(expectations = {}) {
    SharedTranslationsTestUtils._assertPanelElementVisibility(
      SelectTranslationsPanel.elements,
      {
        betaIcon: false,
        cancelButton: false,
        copyButton: false,
        doneButtonPrimary: false,
        doneButtonSecondary: false,
        fromLabel: false,
        fromMenuList: false,
        fromMenuPopup: false,
        header: false,
        initFailureContent: false,
        initFailureMessageBar: false,
        mainContent: false,
        settingsButton: false,
        textArea: false,
        toLabel: false,
        toMenuList: false,
        toMenuPopup: false,
        translateButton: false,
        translateFullPageButton: false,
        translationFailureMessageBar: false,
        tryAgainButton: false,
        tryAnotherSourceMenuList: false,
        tryAnotherSourceMenuPopup: false,
        unsupportedLanguageContent: false,
        unsupportedLanguageMessageBar: false,
        // Overwrite any of the above defaults with the passed in expectations.
        ...expectations,
      }
    );
  }

  /**
   * Waits for the panel's translation state to reach the given phase,
   * if it is not currently in that phase already.
   *
   * @param {string} phase - The phase of the panel's translation state to wait for.
   */
  static async waitForPanelState(phase) {
    const currentPhase = SelectTranslationsPanel.phase();
    if (currentPhase !== phase) {
      info(
        `Waiting for SelectTranslationsPanel to change state from "${currentPhase}" to "${phase}"`
      );
      await BrowserTestUtils.waitForEvent(
        document,
        "SelectTranslationsPanelStateChanged",
        false,
        event => event.detail.phase === phase
      );
    }
  }

  /**
   * Asserts that the SelectTranslationsPanel UI matches the expected
   * state when the panel has completed its translation.
   */
  static async assertPanelViewTranslated() {
    const {
      copyButton,
      doneButtonPrimary,
      fromMenuList,
      settingsButton,
      textArea,
      toMenuList,
      translateFullPageButton,
    } = SelectTranslationsPanel.elements;
    const sameLanguageSelected = fromMenuList.value === toMenuList.value;
    await SelectTranslationsTestUtils.waitForPanelState("translated");
    ok(
      !textArea.classList.contains("translating"),
      "The textarea should not have the translating class."
    );
    const isFullPageTranslationsRestrictedForPage =
      TranslationsParent.isFullPageTranslationsRestrictedForPage(gBrowser);
    SelectTranslationsTestUtils.#assertPanelElementVisibility({
      betaIcon: true,
      copyButton: true,
      doneButtonPrimary: true,
      fromLabel: true,
      fromMenuList: true,
      header: true,
      mainContent: true,
      settingsButton: true,
      textArea: true,
      toLabel: true,
      toMenuList: true,
      translateFullPageButton: !(
        isFullPageTranslationsRestrictedForPage ||
        isFullPageTranslationsActive()
      ),
    });
    SelectTranslationsTestUtils.#assertConditionalUIEnabled({
      copyButton: true,
      doneButtonPrimary: true,
      textArea: true,
      translateFullPageButton: !(
        sameLanguageSelected ||
        isFullPageTranslationsRestrictedForPage ||
        isFullPageTranslationsActive()
      ),
    });

    await waitForCondition(
      () =>
        !copyButton.classList.contains("copied") &&
        copyButton.getAttribute("data-l10n-id") ===
          "select-translations-panel-copy-button",
      "Waiting for copy button to match the not-copied state."
    );

    SelectTranslationsTestUtils.#assertPanelHasTranslatedText();
    SelectTranslationsTestUtils.#assertPanelTextAreaHeight();
    await SelectTranslationsTestUtils.#assertPanelTextAreaOverflow();

    let footerButtons;
    if (
      sameLanguageSelected ||
      isFullPageTranslationsRestrictedForPage ||
      isFullPageTranslationsActive()
    ) {
      footerButtons = [copyButton, doneButtonPrimary];
    } else {
      footerButtons =
        AppConstants.platform === "win"
          ? [copyButton, doneButtonPrimary, translateFullPageButton]
          : [copyButton, translateFullPageButton, doneButtonPrimary];
    }

    SharedTranslationsTestUtils._assertTabIndexOrder([
      settingsButton,
      fromMenuList,
      toMenuList,
      textArea,
      ...footerButtons,
    ]);
  }

  /**
   * Asserts that the SelectTranslationsPanel UI matches the expected
   * state when the language lists fail to initialize upon opening the panel.
   */
  static async assertPanelViewInitFailure() {
    const {
      cancelButton,
      initFailureMessageBar,
      settingsButton,
      tryAgainButton,
    } = SelectTranslationsPanel.elements;
    await SelectTranslationsTestUtils.waitForPanelState("init-failure");
    SelectTranslationsTestUtils.#assertPanelElementVisibility({
      header: true,
      betaIcon: true,
      cancelButton: true,
      initFailureContent: true,
      initFailureMessageBar: true,
      settingsButton: true,
      tryAgainButton: true,
    });
    SharedTranslationsTestUtils._assertTabIndexOrder([
      settingsButton,
      ...(AppConstants.platform === "win"
        ? [tryAgainButton, cancelButton]
        : [cancelButton, tryAgainButton]),
    ]);
    SharedTranslationsTestUtils._assertHasFocus(tryAgainButton);
    const ariaDescribedBy = tryAgainButton.getAttribute("aria-describedby");
    ok(ariaDescribedBy.includes(initFailureMessageBar.id));
  }

  /**
   * Asserts that the SelectTranslationsPanel UI matches the expected
   * state when a translation has failed to complete.
   */
  static async assertPanelViewTranslationFailure() {
    const {
      cancelButton,
      fromMenuList,
      settingsButton,
      toMenuList,
      translationFailureMessageBar,
      tryAgainButton,
    } = SelectTranslationsPanel.elements;
    await SelectTranslationsTestUtils.waitForPanelState("translation-failure");
    SelectTranslationsTestUtils.#assertPanelElementVisibility({
      header: true,
      betaIcon: true,
      cancelButton: true,
      fromLabel: true,
      fromMenuList: true,
      mainContent: true,
      settingsButton: true,
      toLabel: true,
      toMenuList: true,
      translationFailureMessageBar: true,
      tryAgainButton: true,
    });
    is(
      document.activeElement,
      tryAgainButton,
      "The try-again button should have focus."
    );
    is(
      translationFailureMessageBar.getAttribute("role"),
      "alert",
      "The translation failure message bar is an alert."
    );
    SharedTranslationsTestUtils._assertTabIndexOrder([
      settingsButton,
      fromMenuList,
      toMenuList,
      ...(AppConstants.platform === "win"
        ? [tryAgainButton, cancelButton]
        : [cancelButton, tryAgainButton]),
    ]);
    SharedTranslationsTestUtils._assertHasFocus(tryAgainButton);
    const ariaDescribedBy = tryAgainButton.getAttribute("aria-describedby");
    ok(ariaDescribedBy.includes(translationFailureMessageBar.id));
  }

  static #assertPanelTextAreaDirection(langTag = null) {
    const expectedTextDirection = langTag
      ? Services.intl.getScriptDirection(langTag)
      : null;
    const { textArea } = SelectTranslationsPanel.elements;
    const actualTextDirection = textArea.getAttribute("dir");

    is(
      actualTextDirection,
      expectedTextDirection,
      `The text direction should be ${expectedTextDirection}`
    );
  }

  /**
   * Asserts that the SelectTranslationsPanel UI matches the expected
   * state when the panel has completed its translation.
   */
  static async assertPanelViewUnsupportedLanguage() {
    await SelectTranslationsTestUtils.waitForPanelState("unsupported");
    const {
      doneButtonSecondary,
      settingsButton,
      translateButton,
      tryAnotherSourceMenuList,
      unsupportedLanguageMessageBar,
    } = SelectTranslationsPanel.elements;
    SelectTranslationsTestUtils.#assertPanelElementVisibility({
      betaIcon: true,
      doneButtonSecondary: true,
      header: true,
      settingsButton: true,
      translateButton: true,
      tryAnotherSourceMenuList: true,
      unsupportedLanguageContent: true,
      unsupportedLanguageMessageBar: true,
    });
    SelectTranslationsTestUtils.#assertConditionalUIEnabled({
      doneButtonSecondary: true,
      translateButton: false,
    });
    ok(
      translateButton.disabled,
      "The translate button should be disabled when first shown."
    );
    SharedTranslationsTestUtils._assertL10nId(
      unsupportedLanguageMessageBar,
      "select-translations-panel-unsupported-language-message-known"
    );
    SharedTranslationsTestUtils._assertHasFocus(tryAnotherSourceMenuList);
    SharedTranslationsTestUtils._assertTabIndexOrder([
      settingsButton,
      tryAnotherSourceMenuList,
      doneButtonSecondary,
    ]);
  }

  /**
   * Asserts that the SelectTranslationsPanel translated text area is
   * both scrollable and scrolled to the top.
   */
  static async #assertPanelTextAreaOverflow() {
    const { textArea } = SelectTranslationsPanel.elements;
    if (textArea.style.overflow !== "auto") {
      await BrowserTestUtils.waitForMutationCondition(
        textArea,
        { attributes: true, attributeFilter: ["style"] },
        () => textArea.style.overflow === "auto"
      );
    }
    if (textArea.scrollHeight > textArea.clientHeight) {
      info("Ensuring that the textarea is scrolled to the top.");
      await waitForCondition(() => textArea.scrollTop === 0);

      info("Ensuring that the textarea cursor is at the beginning.");
      await waitForCondition(
        () => textArea.selectionStart === 0 && textArea.selectionEnd === 0
      );
    }
  }

  /**
   * Asserts that the SelectTranslationsPanel translated text area is
   * the correct height for the length of the translated text.
   */
  static #assertPanelTextAreaHeight() {
    const { textArea } = SelectTranslationsPanel.elements;

    if (
      SelectTranslationsPanel.getSourceText().length <
      SelectTranslationsPanel.textLengthThreshold
    ) {
      is(
        textArea.style.height,
        SelectTranslationsPanel.shortTextHeight,
        "The panel text area should have the short-text height"
      );
    } else {
      is(
        textArea.style.height,
        SelectTranslationsPanel.longTextHeight,
        "The panel text area should have the long-text height"
      );
    }
  }

  /**
   * Asserts that the SelectTranslationsPanel UI matches the expected
   * state when the panel is actively translating text.
   */
  static async assertPanelViewActivelyTranslating() {
    const { textArea } = SelectTranslationsPanel.elements;
    const isFullPageTranslationsRestrictedForPage =
      TranslationsParent.isFullPageTranslationsRestrictedForPage(gBrowser);
    await SelectTranslationsTestUtils.waitForPanelState("translating");
    ok(
      textArea.classList.contains("translating"),
      "The textarea should have the translating class."
    );
    SelectTranslationsTestUtils.#assertPanelElementVisibility({
      betaIcon: true,
      copyButton: true,
      doneButtonPrimary: true,
      fromLabel: true,
      fromMenuList: true,
      header: true,
      mainContent: true,
      settingsButton: true,
      textArea: true,
      toLabel: true,
      toMenuList: true,
      translateFullPageButton: !(
        isFullPageTranslationsRestrictedForPage ||
        isFullPageTranslationsActive()
      ),
    });
    SelectTranslationsTestUtils.#assertPanelHasTranslatingPlaceholder();
  }

  /**
   * Asserts that the SelectTranslationsPanel UI contains the
   * translating placeholder text.
   */
  static async #assertPanelHasTranslatingPlaceholder() {
    const { textArea, fromMenuList, toMenuList } =
      SelectTranslationsPanel.elements;
    const expected = await document.l10n.formatValue(
      "select-translations-panel-translating-placeholder-text"
    );
    const isFullPageTranslationsRestrictedForPage =
      TranslationsParent.isFullPageTranslationsRestrictedForPage(gBrowser);
    is(
      textArea.value,
      expected,
      "Active translation text area should have the translating placeholder."
    );
    SelectTranslationsTestUtils.#assertPanelTextAreaDirection();
    SelectTranslationsTestUtils.#assertConditionalUIEnabled({
      textArea: true,
      copyButton: false,
      doneButtonPrimary: true,
      translateFullPageButton:
        fromMenuList.value !== toMenuList.value &&
        !isFullPageTranslationsRestrictedForPage &&
        !isFullPageTranslationsActive(),
    });
  }

  /**
   * Asserts that the SelectTranslationsPanel UI contains the
   * translated text.
   */
  static #assertPanelHasTranslatedText() {
    const { textArea, fromMenuList, toMenuList } =
      SelectTranslationsPanel.elements;
    const fromLanguage = fromMenuList.value;
    const toLanguage = toMenuList.value;
    const isFullPageTranslationsRestrictedForPage =
      TranslationsParent.isFullPageTranslationsRestrictedForPage(gBrowser);

    SelectTranslationsTestUtils.#assertPanelTextAreaDirection(toLanguage);
    SelectTranslationsTestUtils.#assertConditionalUIEnabled({
      textArea: true,
      copyButton: true,
      doneButtonPrimary: true,
      translateFullPageButton:
        fromLanguage !== toLanguage &&
        !isFullPageTranslationsRestrictedForPage &&
        !isFullPageTranslationsActive(),
    });

    if (fromLanguage === toLanguage) {
      is(
        SelectTranslationsPanel.getSourceText(),
        SelectTranslationsPanel.getTranslatedText(),
        "The source text should passthrough as the translated text."
      );
      return;
    }

    const translatedSuffix = ` [${fromLanguage} to ${toLanguage}]`;
    ok(
      textArea.value.endsWith(translatedSuffix),
      `Translated text should match ${fromLanguage} to ${toLanguage}`
    );
    is(
      SelectTranslationsPanel.getSourceText().length,
      SelectTranslationsPanel.getTranslatedText().length -
        translatedSuffix.length,
      "Expected translated text length to correspond to the source text length."
    );
  }

  /**
   * Asserts the enabled state of action buttons in the SelectTranslationsPanel.
   *
   * @param {Record<string, boolean>} enabledStates
   *  - An object that maps whether each element should be enabled (true) or disabled (false).
   */
  static #assertConditionalUIEnabled(enabledStates) {
    const elements = SelectTranslationsPanel.elements;

    for (const [elementName, expectEnabled] of Object.entries(enabledStates)) {
      const element = elements[elementName];
      if (!element) {
        throw new Error(
          `SelectTranslationsPanel element '${elementName}' not found.`
        );
      }
      is(
        element.disabled,
        !expectEnabled,
        `The element '${elementName} should be ${
          expectEnabled ? "enabled" : "disabled"
        }.`
      );
    }
  }

  /**
   * Asserts that the selected from-language matches the provided language tag.
   *
   * @param {string} langTag - A BCP-47 language tag.
   */
  static assertSelectedFromLanguage(langTag = null) {
    const { fromMenuList } = SelectTranslationsPanel.elements;
    SelectTranslationsTestUtils.#assertSelectedLanguage(fromMenuList, langTag);
  }

  /**
   * Asserts that the selected to-language matches the provided language tag.
   *
   * @param {string} langTag - A BCP-47 language tag.
   */
  static assertSelectedToLanguage(langTag = null) {
    const { toMenuList } = SelectTranslationsPanel.elements;
    SelectTranslationsTestUtils.#assertSelectedLanguage(toMenuList, langTag);
  }

  /**
   * Asserts the selected language in the given  menu list if a langTag is provided.
   * If no langTag is given, asserts that the menulist displays the localized placeholder.
   *
   * @param {object} menuList - The menu list object to check.
   * @param {string} [langTag] - The optional language tag to assert against.
   */
  static #assertSelectedLanguage(menuList, langTag) {
    if (langTag) {
      SharedTranslationsTestUtils._assertSelectedLanguage(menuList, {
        langTag,
      });
    } else {
      SharedTranslationsTestUtils._assertSelectedLanguage(menuList, {
        l10nId: "translations-panel-choose-language",
      });
      SharedTranslationsTestUtils._assertHasFocus(menuList);
    }
  }

  /**
   * Simulates clicking the done button and waits for the panel to close.
   */
  static async clickDoneButton() {
    logAction();
    const { doneButtonPrimary, doneButtonSecondary } =
      SelectTranslationsPanel.elements;
    let visibleDoneButton;
    let hiddenDoneButton;
    if (BrowserTestUtils.isVisible(doneButtonPrimary)) {
      visibleDoneButton = doneButtonPrimary;
      hiddenDoneButton = doneButtonSecondary;
    } else if (BrowserTestUtils.isVisible(doneButtonSecondary)) {
      visibleDoneButton = doneButtonSecondary;
      hiddenDoneButton = doneButtonPrimary;
    } else {
      throw new Error(
        "Expected either the primary or secondary done button to be visible."
      );
    }
    assertVisibility({
      visible: { visibleDoneButton },
      hidden: { hiddenDoneButton },
    });
    await SelectTranslationsTestUtils.waitForPanelPopupEvent(
      "popuphidden",
      () => {
        click(visibleDoneButton, "Clicking the done button");
      }
    );
  }

  /**
   * Simulates clicking the cancel button and waits for the panel to close.
   */
  static async clickCancelButton() {
    logAction();
    const { cancelButton } = SelectTranslationsPanel.elements;
    assertVisibility({ visible: { cancelButton } });
    await SelectTranslationsTestUtils.waitForPanelPopupEvent(
      "popuphidden",
      () => {
        click(cancelButton, "Clicking the cancel button");
      }
    );
  }

  /**
   * Simulates clicking the copy button and asserts that all relevant states are correctly updated.
   */
  static async clickCopyButton() {
    logAction();
    const { copyButton } = SelectTranslationsPanel.elements;

    assertVisibility({ visible: { copyButton } });
    is(
      SelectTranslationsPanel.phase(),
      "translated",
      'The copy button should only be clickable in the "translated" phase'
    );

    click(copyButton, "Clicking the copy button");
    await waitForCondition(
      () =>
        copyButton.classList.contains("copied") &&
        copyButton.getAttribute("data-l10n-id") ===
          "select-translations-panel-copy-button-copied",
      "Waiting for copy button to match the copied state."
    );

    const copiedText = SpecialPowers.getClipboardData("text/plain");
    is(
      // Because of differences in the clipboard code on Windows, we are going
      // to explicitly sanitize carriage returns here when checking equality.
      copiedText.replaceAll("\r", ""),
      SelectTranslationsPanel.getTranslatedText().replaceAll("\r", ""),
      "The clipboard should contain the translated text."
    );
  }

  /**
   * Simulates clicking the Translate button in the SelectTranslationsPanel,
   * then waits for any pending translation effects, based on the provided options.
   *
   * @param {object} config
   * @param {Function} [config.downloadHandler]
   *  - The function handle expected downloads, resolveDownloads() or rejectDownloads()
   *    Leave as null to test more granularly, such as testing opening the loading view,
   *    or allowing for the automatic downloading of files.
   * @param {boolean} [config.pivotTranslation]
   *  - True if the expected translation is a pivot translation, otherwise false.
   *    Affects the number of expected downloads.
   * @param {Function} [config.viewAssertion]
   *  - An optional callback function to execute for asserting the panel UI state.
   */
  static async clickTranslateButton({
    downloadHandler,
    pivotTranslation,
    viewAssertion,
  }) {
    logAction();
    const {
      doneButtonSecondary,
      settingsButton,
      translateButton,
      tryAnotherSourceMenuList,
    } = SelectTranslationsPanel.elements;
    assertVisibility({ visible: { doneButtonPrimary: translateButton } });

    ok(!translateButton.disabled, "The translate button should be enabled.");
    SharedTranslationsTestUtils._assertTabIndexOrder([
      settingsButton,
      tryAnotherSourceMenuList,
      ...(AppConstants.platform === "win"
        ? [translateButton, doneButtonSecondary]
        : [doneButtonSecondary, translateButton]),
    ]);

    const translatablePhasePromise =
      SelectTranslationsTestUtils.waitForPanelState("translatable");
    click(translateButton);
    await translatablePhasePromise;

    if (downloadHandler) {
      await this.handleDownloads({ downloadHandler, pivotTranslation });
    }
    if (viewAssertion) {
      await viewAssertion();
    }
  }

  /**
   * Simulates clicking the translate-full-page button.
   */
  static async clickTranslateFullPageButton() {
    logAction();
    const { translateFullPageButton } = SelectTranslationsPanel.elements;
    assertVisibility({ visible: { translateFullPageButton } });
    click(translateFullPageButton);
    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: true, icon: true },
      "The icon presents the locale."
    );
  }

  /**
   * Simulates clicking the try-again button.
   *
   * @param {object} config
   * @param {Function} [config.downloadHandler]
   *  - The function handle expected downloads, resolveDownloads() or rejectDownloads()
   *    Leave as null to test more granularly, such as testing opening the loading view,
   *    or allowing for the automatic downloading of files.
   * @param {boolean} [config.pivotTranslation]
   *  - True if the expected translation is a pivot translation, otherwise false.
   *    Affects the number of expected downloads.
   * @param {Function} [config.viewAssertion]
   *  - An optional callback function to execute for asserting the panel UI state.
   */
  static async clickTryAgainButton({
    downloadHandler,
    pivotTranslation,
    viewAssertion,
  } = {}) {
    logAction();
    const { tryAgainButton } = SelectTranslationsPanel.elements;
    assertVisibility({ visible: { tryAgainButton } });

    const translatablePhasePromise = downloadHandler
      ? SelectTranslationsTestUtils.waitForPanelState("translatable")
      : Promise.resolve();

    if (SelectTranslationsPanel.phase() === "init-failure") {
      // The try-again button reopens the panel from the "init-failure" phase.
      await SelectTranslationsTestUtils.waitForPanelPopupEvent(
        "popupshown",
        () => click(tryAgainButton, "Clicking the try-again button")
      );
    } else {
      // Otherwise the try-again button just attempts to re-translate.
      click(tryAgainButton, "Clicking the try-again button");
    }

    if (downloadHandler) {
      await translatablePhasePromise;
      await this.handleDownloads({ downloadHandler, pivotTranslation });
    }

    if (viewAssertion) {
      await viewAssertion();
    }
  }

  /**
   * Opens the SelectTranslationsPanel settings menu.
   * Requires that the translations panel is already open.
   */
  static async openPanelSettingsMenu() {
    logAction();
    const { settingsButton } = SelectTranslationsPanel.elements;
    assertVisibility({ visible: { settingsButton } });
    await SharedTranslationsTestUtils._waitForPopupEvent(
      "select-translations-panel-settings-menupopup",
      "popupshown",
      () => click(settingsButton, "Opening the settings menu")
    );
    const settingsPageMenuItem = document.getElementById(
      "select-translations-panel-open-settings-page-menuitem"
    );
    const aboutTranslationsMenuItem = document.getElementById(
      "select-translations-panel-about-translations-menuitem"
    );

    assertVisibility({
      visible: {
        settingsPageMenuItem,
        aboutTranslationsMenuItem,
      },
    });
  }

  /**
   * Clicks the SelectTranslationsPanel settings menu item
   * that leads to the Translations Settings in about:preferences.
   */
  static clickTranslationsSettingsPageMenuItem() {
    logAction();
    const settingsPageMenuItem = document.getElementById(
      "select-translations-panel-open-settings-page-menuitem"
    );
    assertVisibility({ visible: { settingsPageMenuItem } });
    click(settingsPageMenuItem);
  }

  /**
   * Opens the context menu at a specified element on the page, based on the provided options.
   *
   * @param {Function} runInPage - A content-exposed function to run within the context of the page.
   * @param {object} options - Options for opening the context menu.
   *
   * @param {boolean} options.expectMenuItemVisible - Whether the select-translations menu item should be present in the context menu.
   * @param {boolean} options.expectedTargetLanguage - The expected target language to be shown in the context menu.
   *
   * The following options will work on all test pages that have an <h1> element.
   *
   * @param {boolean} options.selectH1 - Selects the first H1 element of the page.
   * @param {boolean} options.openAtH1 - Opens the context menu at the first H1 element of the page.
   *
   * The following options will work only in the PDF_TEST_PAGE_URL.
   *
   * @param {boolean} options.selectPdfSpan - Selects the first span of text on the first page of a pdf.
   * @param {boolean} options.openAtPdfSpan - Opens the context menu at the first span of text on the first page of a pdf.
   *
   * The following options will only work when testing SELECT_TEST_PAGE_URL.
   *
   * @param {boolean} options.selectFrenchSection - Selects the section of French text.
   * @param {boolean} options.selectEnglishSection - Selects the section of English text.
   * @param {boolean} options.selectSpanishSection - Selects the section of Spanish text.
   * @param {boolean} options.selectFrenchSentence - Selects a French sentence.
   * @param {boolean} options.selectEnglishSentence - Selects an English sentence.
   * @param {boolean} options.selectSpanishSentence - Selects a Spanish sentence.
   * @param {boolean} options.openAtFrenchSection - Opens the context menu at the section of French text.
   * @param {boolean} options.openAtEnglishSection - Opens the context menu at the section of English text.
   * @param {boolean} options.openAtSpanishSection - Opens the context menu at the section of Spanish text.
   * @param {boolean} options.openAtFrenchSentence - Opens the context menu at a French sentence.
   * @param {boolean} options.openAtEnglishSentence - Opens the context menu at an English sentence.
   * @param {boolean} options.openAtSpanishSentence - Opens the context menu at a Spanish sentence.
   * @param {boolean} options.openAtFrenchHyperlink - Opens the context menu at a hyperlinked French text.
   * @param {boolean} options.openAtEnglishHyperlink - Opens the context menu at a hyperlinked English text.
   * @param {boolean} options.openAtSpanishHyperlink - Opens the context menu at a hyperlinked Spanish text.
   * @param {boolean} options.openAtURLHyperlink - Opens the context menu at a hyperlinked URL text.
   * @throws Throws an error if no valid option was provided for opening the menu.
   */
  static async openContextMenu(runInPage, options) {
    logAction();

    const maybeSelectContentFrom = async keyword => {
      const conditionVariableName = `select${keyword}`;
      const selectorFunctionName = `get${keyword}`;

      if (options[conditionVariableName]) {
        await runInPage(
          async (TranslationsTest, data) => {
            const selectorFunction =
              TranslationsTest.getSelectors()[data.selectorFunctionName];
            if (typeof selectorFunction === "function") {
              const element = await selectorFunction();
              TranslationsTest.selectContentElement(element);
            }
          },
          { selectorFunctionName }
        );
      }
    };

    await maybeSelectContentFrom("H1");
    await maybeSelectContentFrom("PdfSpan");
    await maybeSelectContentFrom("FrenchSection");
    await maybeSelectContentFrom("EnglishSection");
    await maybeSelectContentFrom("SpanishSection");
    await maybeSelectContentFrom("FrenchSentence");
    await maybeSelectContentFrom("EnglishSentence");
    await maybeSelectContentFrom("SpanishSentence");

    const maybeOpenContextMenuAt = async keyword => {
      const optionVariableName = `openAt${keyword}`;
      const selectorFunctionName = `get${keyword}`;

      if (options[optionVariableName]) {
        await SharedTranslationsTestUtils._waitForPopupEvent(
          "contentAreaContextMenu",
          "popupshown",
          async () => {
            await runInPage(
              async (TranslationsTest, data) => {
                const selectorFunction =
                  TranslationsTest.getSelectors()[data.selectorFunctionName];
                if (typeof selectorFunction === "function") {
                  const element = await selectorFunction();
                  await TranslationsTest.rightClickContentElement(element);
                }
              },
              { selectorFunctionName }
            );
          }
        );
      }
    };

    await maybeOpenContextMenuAt("H1");
    await maybeOpenContextMenuAt("PdfSpan");
    await maybeOpenContextMenuAt("FrenchSection");
    await maybeOpenContextMenuAt("EnglishSection");
    await maybeOpenContextMenuAt("SpanishSection");
    await maybeOpenContextMenuAt("FrenchSentence");
    await maybeOpenContextMenuAt("EnglishSentence");
    await maybeOpenContextMenuAt("SpanishSentence");
    await maybeOpenContextMenuAt("FrenchHyperlink");
    await maybeOpenContextMenuAt("EnglishHyperlink");
    await maybeOpenContextMenuAt("SpanishHyperlink");
    await maybeOpenContextMenuAt("URLHyperlink");
  }

  /**
   * Handles language-model downloads for the SelectTranslationsPanel, ensuring that expected
   * UI states match based on the resolved download state.
   *
   * @param {object} options - Configuration options for downloads.
   * @param {function(number): Promise<void>} options.downloadHandler - The function to resolve or reject the downloads.
   * @param {boolean} [options.pivotTranslation] - Whether to expect a pivot translation.
   *
   * @returns {Promise<void>}
   */
  static async handleDownloads({ downloadHandler, pivotTranslation }) {
    if (downloadHandler) {
      await SelectTranslationsTestUtils.assertPanelViewActivelyTranslating();
      await downloadHandler(pivotTranslation ? 2 : 1);
    }
  }

  /**
   * Switches the selected from-language to the provided language tags
   *
   * @param {string[]} langTags - An array of BCP-47 language tags.
   * @param {object} options - Configuration options for the language change.
   * @param {boolean} options.openDropdownMenu - Determines whether the language change should be made via a dropdown menu or directly.
   *
   * @returns {Promise<void>}
   */
  static async changeSelectedFromLanguage(langTags, options) {
    logAction(langTags);
    const { fromMenuList, fromMenuPopup } = SelectTranslationsPanel.elements;
    const { openDropdownMenu } = options;

    const switchFn = openDropdownMenu
      ? SelectTranslationsTestUtils.#changeSelectedLanguageViaDropdownMenu
      : SelectTranslationsTestUtils.#changeSelectedLanguageDirectly;

    await switchFn(
      langTags,
      { menuList: fromMenuList, menuPopup: fromMenuPopup },
      options
    );
  }

  /**
   * Change the selected language in the try-another-source-language dropdown.
   *
   * @param {string} langTag - A BCP-47 language tag.
   */
  static async changeSelectedTryAnotherSourceLanguage(langTag) {
    logAction(langTag);
    const { tryAnotherSourceMenuList, translateButton } =
      SelectTranslationsPanel.elements;
    await SelectTranslationsTestUtils.#changeSelectedLanguageDirectly(
      [langTag],
      { menuList: tryAnotherSourceMenuList },
      {
        onChangeLanguage: () =>
          ok(
            !translateButton.disabled,
            "The translate button should be enabled after selecting a language."
          ),
      }
    );
  }

  /**
   * Switches the selected to-language to the provided language tag.
   *
   * @param {string[]} langTags - An array of BCP-47 language tags.
   * @param {object} options - Options for selecting paragraphs and opening the context menu.
   * @param {boolean} options.openDropdownMenu - Determines whether the language change should be made via a dropdown menu or directly.
   * @param {Function} options.downloadHandler - Handler for initiating downloads post language change, if applicable.
   * @param {Function} options.onChangeLanguage - Callback function to be executed after the language change.
   *
   * @returns {Promise<void>}
   */
  static async changeSelectedToLanguage(langTags, options) {
    logAction(langTags);
    const { toMenuList, toMenuPopup } = SelectTranslationsPanel.elements;
    const { openDropdownMenu } = options;

    const switchFn = openDropdownMenu
      ? SelectTranslationsTestUtils.#changeSelectedLanguageViaDropdownMenu
      : SelectTranslationsTestUtils.#changeSelectedLanguageDirectly;

    await switchFn(
      langTags,
      { menuList: toMenuList, menuPopup: toMenuPopup },
      options
    );
  }

  /**
   * Directly changes the selected language to each provided language tag without using a dropdown menu.
   *
   * @param {string[]} langTags - An array of BCP-47 language tags for direct selection.
   * @param {object} elements - Elements required for changing the selected language.
   * @param {Element} elements.menuList - The menu list element where languages are directly changed.
   * @param {object} options - Configuration options for language change and additional actions.
   * @param {Function} options.downloadHandler - Handler for initiating downloads post language change, if applicable.
   * @param {Function} options.onChangeLanguage - Callback function to be executed after the language change.
   *
   * @returns {Promise<void>}
   */
  static async #changeSelectedLanguageDirectly(langTags, elements, options) {
    const { menuList } = elements;
    const { textArea } = SelectTranslationsPanel.elements;
    const { onChangeLanguage, downloadHandler } = options;

    for (const langTag of langTags) {
      const menuListUpdated = BrowserTestUtils.waitForMutationCondition(
        menuList,
        { attributes: true, attributeFilter: ["value"] },
        () => menuList.value === langTag
      );

      menuList.focus();
      menuList.value = langTag;
      menuList.dispatchEvent(new Event("command", { bubbles: true }));
      await menuListUpdated;
    }

    // Either of these events should trigger a translation after the selected
    // language has been changed directly.
    if (Math.random() < 0.5) {
      info("Attempting to trigger translation via text-area focus.");
      textArea.focus();
    } else {
      info("Attempting to trigger translation via pressing Enter.");
      EventUtils.synthesizeKey("KEY_Enter");
    }

    if (downloadHandler) {
      await SelectTranslationsTestUtils.handleDownloads(options);
    }

    if (onChangeLanguage) {
      await onChangeLanguage();
    }
  }

  /**
   * Changes the selected language by opening the dropdown menu for each provided language tag.
   *
   * @param {string[]} langTags - An array of BCP-47 language tags for selection via dropdown.
   * @param {object} elements - Elements involved in the dropdown language selection process.
   * @param {Element} elements.menuList - The element that triggers the dropdown menu.
   * @param {Element} elements.menuPopup - The dropdown menu element containing selectable languages.
   * @param {object} options - Configuration options for language change and additional actions.
   * @param {Function} options.downloadHandler - Handler for initiating downloads post language change, if applicable.
   * @param {Function} options.onChangeLanguage - Callback function to be executed after the language change.
   *
   * @returns {Promise<void>}
   */
  static async #changeSelectedLanguageViaDropdownMenu(
    langTags,
    elements,
    options
  ) {
    const { menuList, menuPopup } = elements;
    const { onChangeLanguage } = options;
    for (const langTag of langTags) {
      await SelectTranslationsTestUtils.waitForPanelPopupEvent(
        "popupshown",
        () => click(menuList)
      );

      const menuItem = menuPopup.querySelector(`[value="${langTag}"]`);
      await SelectTranslationsTestUtils.waitForPanelPopupEvent(
        "popuphidden",
        () => {
          click(menuItem);
          // Synthesizing a click on the menuitem isn't closing the popup
          // as a click normally would, so this tab keypress is added to
          // ensure the popup closes.
          EventUtils.synthesizeKey("KEY_Tab");
        }
      );

      await SelectTranslationsTestUtils.handleDownloads(options);
      if (onChangeLanguage) {
        await onChangeLanguage();
      }
    }
  }

  /**
   * Opens the Select Translations panel via the context menu based on specified options.
   *
   * @param {Function} runInPage - A content-exposed function to run within the context of the page.
   * @param {object} options - Options for selecting paragraphs and opening the context menu.
   *
   * The following options will only work when testing SELECT_TEST_PAGE_URL.
   *
   * @param {string}  options.expectedFromLanguage - The expected from-language tag.
   * @param {string}  options.expectedToLanguage - The expected to-language tag.
   * @param {boolean} options.selectFrenchSection - Selects the section of French text.
   * @param {boolean} options.selectEnglishSection - Selects the section of English text.
   * @param {boolean} options.selectSpanishSection - Selects the section of Spanish text.
   * @param {boolean} options.selectFrenchSentence - Selects a French sentence.
   * @param {boolean} options.selectEnglishSentence - Selects an English sentence.
   * @param {boolean} options.selectSpanishSentence - Selects a Spanish sentence.
   * @param {boolean} options.openAtFrenchSection - Opens the context menu at the section of French text.
   * @param {boolean} options.openAtEnglishSection - Opens the context menu at the section of English text.
   * @param {boolean} options.openAtSpanishSection - Opens the context menu at the section of Spanish text.
   * @param {boolean} options.openAtFrenchSentence - Opens the context menu at a French sentence.
   * @param {boolean} options.openAtEnglishSentence - Opens the context menu at an English sentence.
   * @param {boolean} options.openAtSpanishSentence - Opens the context menu at a Spanish sentence.
   * @param {boolean} options.openAtFrenchHyperlink - Opens the context menu at a hyperlinked French text.
   * @param {boolean} options.openAtEnglishHyperlink - Opens the context menu at a hyperlinked English text.
   * @param {boolean} options.openAtSpanishHyperlink - Opens the context menu at a hyperlinked Spanish text.
   * @param {boolean} options.openAtURLHyperlink - Opens the context menu at a hyperlinked URL text.
   * @param {Function} [options.onOpenPanel] - An optional callback function to execute after the panel opens.
   * @param {string|null} [message] - An optional message to log to info.
   * @throws Throws an error if the context menu could not be opened with the provided options.
   * @returns {Promise<void>}
   */
  static async openPanel(runInPage, options, message) {
    logAction();

    if (message) {
      info(message);
    }

    await SelectTranslationsTestUtils.assertContextMenuTranslateSelectionItem(
      runInPage,
      options,
      message
    );

    const menuItem = getById("context-translate-selection");

    await SelectTranslationsTestUtils.waitForPanelPopupEvent(
      "popupshown",
      async () => {
        click(menuItem);
        await closeContextMenuIfOpen();
      },
      async () => {
        const { onOpenPanel } = options;
        await SelectTranslationsTestUtils.handleDownloads(options);
        if (onOpenPanel) {
          await onOpenPanel();
        }
      }
    );

    const { expectedFromLanguage, expectedToLanguage } = options;
    if (expectedFromLanguage !== undefined) {
      SelectTranslationsTestUtils.assertSelectedFromLanguage(
        expectedFromLanguage
      );
    }
    if (expectedToLanguage !== undefined) {
      SelectTranslationsTestUtils.assertSelectedToLanguage(expectedToLanguage);
    }

    const { panel } = SelectTranslationsPanel.elements;

    const documentRoleElement = panel.querySelector('[role="document"]');
    ok(documentRoleElement, "The document-role element can be found.");

    const ariaDescription = document.getElementById(
      documentRoleElement.getAttribute("aria-describedby")
    );
    ok(ariaDescription, "The a11y description for the panel can be found.");

    const ariaLabelIds = documentRoleElement
      .getAttribute("aria-labelledby")
      .split(" ");
    for (const id of ariaLabelIds) {
      const ariaLabel = document.getElementById(id);
      ok(ariaLabel, `The a11y label element '${id}' can be found.`);
      assertVisibility({ visible: { ariaLabel } });
    }
  }

  /**
   * XUL popups will fire the popupshown and popuphidden events. These will fire for
   * any type of popup in the browser. This function waits for one of those events, and
   * checks that the viewId of the popup is PanelUI-profiler
   *
   * @param {"popupshown" | "popuphidden"} eventName
   * @param {Function} callback
   * @param {Function} postEventAssertion
   *   An optional assertion to be made immediately after the event occurs.
   * @returns {Promise<void>}
   */
  static async waitForPanelPopupEvent(
    eventName,
    callback,
    postEventAssertion = null
  ) {
    // De-lazify the panel elements.
    SelectTranslationsPanel.elements;
    await SharedTranslationsTestUtils._waitForPopupEvent(
      "select-translations-panel",
      eventName,
      callback,
      postEventAssertion
    );
  }
}

class TranslationsSettingsTestUtils {
  /**
   * Opens the Translation Settings page by clicking the settings button sent in the argument.
   *
   * @param  {HTMLElement} settingsButton
   * @returns {Element}
   */
  static async openAboutPreferencesTranslationsSettingsPane(settingsButton) {
    const document = gBrowser.selectedBrowser.contentDocument;

    const translationsPane =
      content.window.gCategoryModules.get("paneTranslations");
    const promise = BrowserTestUtils.waitForEvent(
      document,
      "paneshown",
      false,
      event => event.detail.category === "paneTranslations"
    );

    click(settingsButton, "Click settings button");
    await promise;

    return translationsPane.elements;
  }

  /**
   * Utility function to handle the click event for a `moz-button` element that controls
   * the Download/Remove Language functionality.
   *
   * The button's icon reflects the current state of the language (downloaded, loading, or removed),
   * which is represented by a corresponding CSS class.
   *
   * When this button is clicked for any language, the function waits for the button's state and icon
   * to update. It then checks whether the button's state and icon match the expected state as defined
   * by the test case, and logs the respective message provided by the test case.
   *
   * @param {Element} langButton - The `moz-button` element representing the download/remove button.
   * @param {string} buttonIcon - The expected CSS class representing the button's state/icon (e.g., download, loading, or remove icon).
   * @param {string} logMsg - A custom log message provided by the test case indicating the expected result.
   */

  static async downaloadButtonClick(langButton, buttonIcon, logMsg) {
    if (
      !langButton.parentNode
        .querySelector("moz-button")
        .classList.contains(buttonIcon)
    ) {
      await BrowserTestUtils.waitForMutationCondition(
        langButton.parentNode.querySelector("moz-button"),
        { attributes: true, attributeFilter: ["class"] },
        () =>
          langButton.parentNode
            .querySelector("moz-button")
            .classList.contains(buttonIcon)
      );
    }
    ok(
      langButton.parentNode
        .querySelector("moz-button")
        .classList.contains(buttonIcon),
      logMsg
    );
  }
}
