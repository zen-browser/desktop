/* Any copyright is dedicated to the Public Domain.
 * https://creativecommons.org/publicdomain/zero/1.0/ */

let gContentPrefs = Cc["@mozilla.org/content-pref/service;1"].getService(
  Ci.nsIContentPrefService2
);

let gLoadContext = Cu.createLoadContext();

registerCleanupFunction(async function () {
  await new Promise(resolve => {
    gContentPrefs.removeByName(window.FullZoom.name, gLoadContext, {
      handleResult() {},
      handleCompletion() {
        resolve();
      },
    });
  });
});

var FullZoomHelper = {
  async changeDefaultZoom(newZoom) {
    let nonPrivateLoadContext = Cu.createLoadContext();
    /* Because our setGlobal function takes in a browsing context, and
     * because we want to keep this property consistent across both private
     * and non-private contexts, we crate a non-private context and use that
     * to set the property, regardless of our actual context.
     */

    let parsedZoomValue = parseFloat((parseInt(newZoom) / 100).toFixed(2));
    await new Promise(resolve => {
      gContentPrefs.setGlobal(
        FullZoom.name,
        parsedZoomValue,
        nonPrivateLoadContext,
        {
          handleCompletion() {
            resolve();
          },
        }
      );
    });
    // The zoom level is used to update the commands associated with
    // increasing, decreasing or resetting the Zoom levels. There are
    // a series of async things we need to wait for (writing the content
    // pref to the database, and then reading that content pref back out
    // again and reacting to it), so waiting for the zoom level to reach
    // the expected level is actually simplest to make sure we're okay to
    // proceed.
    await TestUtils.waitForCondition(() => {
      return ZoomManager.zoom == parsedZoomValue;
    });
  },

  async getGlobalValue() {
    return new Promise(resolve => {
      let cachedVal = parseFloat(
        gContentPrefs.getCachedGlobal(FullZoom.name, gLoadContext)
      );
      if (cachedVal) {
        // We've got cached information, though it may be we've cached
        // an undefined value, or the cached info is invalid. To ensure
        // a valid return, we opt to return the default 1.0 in the
        // undefined and invalid cases.
        resolve(parseFloat(cachedVal.value) || 1.0);
        return;
      }
      let value = 1.0;
      gContentPrefs.getGlobal(FullZoom.name, gLoadContext, {
        handleResult(pref) {
          if (pref.value) {
            value = parseFloat(pref.value);
          }
        },
        handleCompletion() {
          resolve(value);
        },
        handleError(error) {
          console.error(error);
        },
      });
    });
  },

  waitForLocationChange: function waitForLocationChange() {
    return new Promise(resolve => {
      Services.obs.addObserver(function obs(subj, topic) {
        Services.obs.removeObserver(obs, topic);
        resolve();
      }, "browser-fullZoom:location-change");
    });
  },

  selectTabAndWaitForLocationChange: function selectTabAndWaitForLocationChange(
    tab
  ) {
    if (!tab) {
      throw new Error("tab must be given.");
    }
    if (gBrowser.selectedTab == tab) {
      return Promise.resolve();
    }

    return Promise.all([
      BrowserTestUtils.switchTab(gBrowser, tab),
      this.waitForLocationChange(),
    ]);
  },

  removeTabAndWaitForLocationChange: function removeTabAndWaitForLocationChange(
    tab
  ) {
    tab = tab || gBrowser.selectedTab;
    let selected = gBrowser.selectedTab == tab;
    gBrowser.removeTab(tab);
    if (selected) {
      return this.waitForLocationChange();
    }
    return Promise.resolve();
  },

  load: function load(tab, url) {
    return new Promise(resolve => {
      let didLoad = false;
      let didZoom = false;

      BrowserTestUtils.loadURIString({
        browser: tab.linkedBrowser,
        uriString: url,
      }).then(() => {
        didLoad = true;
        if (didZoom) {
          resolve();
        }
      }, true);

      this.waitForLocationChange().then(function () {
        didZoom = true;
        if (didLoad) {
          resolve();
        }
      });
    });
  },

  zoomTest: function zoomTest(tab, val, msg) {
    is(ZoomManager.getZoomForBrowser(tab.linkedBrowser), val, msg);
  },

  BACK: 0,
  FORWARD: 1,
  navigate: function navigate(direction) {
    return new Promise(resolve => {
      let didPs = false;
      let didZoom = false;

      BrowserTestUtils.waitForContentEvent(
        gBrowser.selectedBrowser,
        "pageshow",
        true
      ).then(() => {
        didPs = true;
        if (didZoom) {
          resolve();
        }
      });

      if (direction == this.BACK) {
        gBrowser.goBack(false);
      } else if (direction == this.FORWARD) {
        gBrowser.goForward();
      }

      this.waitForLocationChange().then(function () {
        didZoom = true;
        if (didPs) {
          resolve();
        }
      });
    });
  },

  failAndContinue: function failAndContinue(func) {
    return function (err) {
      console.error(err);
      ok(false, err);
      func();
    };
  },
};
