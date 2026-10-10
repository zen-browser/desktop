/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const DELAY_MS = "2000";

let timer;

function handleRequest(req, resp) {
  resp.processAsync();
  resp.setHeader("Cache-Control", "no-cache", false);
  resp.setHeader("Content-Type", "text/html;charset=utf-8", false);

  timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  timer.init(
    () => {
      resp.write("hi");
      resp.finish();
    },
    DELAY_MS,
    Ci.nsITimer.TYPE_ONE_SHOT
  );
}
