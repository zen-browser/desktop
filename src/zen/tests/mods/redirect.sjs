/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function handleRequest(request, response) {
  response.setStatusLine(request.httpVersion, 302, "Found");
  response.setHeader(
    "Location",
    "http://example.com/browser/zen/tests/mods/store/b/chrome.css",
    false
  );
}
