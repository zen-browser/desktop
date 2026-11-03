// This url must sync with the table, url in SafeBrowsing.sys.mjs addMozEntries
const PHISH_TABLE = "moztest-phish-simple";
const PHISH_URL = "https://www.itisatrap.org/firefox/its-a-trap.html";

// This function is mostly ported from classifierCommon.js
// under toolkit/components/url-classifier/tests/mochitest.
function waitForDBInit(callback) {
  // Since there are two cases that may trigger the callback,
  // we have to carefully avoid multiple callbacks and observer
  // leaking.
  let didCallback = false;
  function callbackOnce() {
    if (!didCallback) {
      Services.obs.removeObserver(obsFunc, "mozentries-update-finished");
      callback();
    }
    didCallback = true;
  }

  // The first part: listen to internal event.
  function obsFunc() {
    ok(true, "Received internal event!");
    callbackOnce();
  }
  Services.obs.addObserver(obsFunc, "mozentries-update-finished");

  // The second part: we might have missed the event. Just do
  // an internal database lookup to confirm if the url has been
  // added.
  let principal = Services.scriptSecurityManager.createContentPrincipal(
    Services.io.newURI(PHISH_URL),
    {}
  );

  let dbService = Cc["@mozilla.org/url-classifier/dbservice;1"].getService(
    Ci.nsIUrlClassifierDBService
  );
  dbService.lookup(principal, PHISH_TABLE, value => {
    if (value === PHISH_TABLE) {
      ok(true, "DB lookup success!");
      callbackOnce();
    }
  });
}

Services.prefs.setCharPref(
  "urlclassifier.malwareTable",
  "moztest-malware-simple,moztest-unwanted-simple,moztest-harmful-simple"
);
Services.prefs.setCharPref("urlclassifier.phishTable", "moztest-phish-simple");
Services.prefs.setCharPref(
  "urlclassifier.blockedTable",
  "moztest-block-simple"
);
SafeBrowsing.init();
