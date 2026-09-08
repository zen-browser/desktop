/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { Resource } = ChromeUtils.importESModule(
  "resource://services-sync/resource.sys.mjs"
);

var httpServer = new HttpServer();
httpServer.registerPathHandler("/content", contentHandler);
httpServer.start(-1);

const HTTP_PORT = httpServer.identity.primaryPort;
const TEST_URL = "http://localhost:" + HTTP_PORT + "/content";
const BODY = "response body";

// Keep headers for later inspection.
var auth = null;
var foo = null;
function contentHandler(metadata, response) {
  _("Handling request.");
  auth = metadata.getHeader("Authorization");
  foo = metadata.getHeader("X-Foo");

  _("Extracted headers. " + auth + ", " + foo);

  response.setHeader("Content-Type", "text/plain");
  response.bodyOutputStream.write(BODY, BODY.length);
}

// Set a proxy function to cause an internal redirect.
function triggerRedirect() {
  const PROXY_FUNCTION =
    "function FindProxyForURL(url, host) {" +
    "  return 'PROXY a_non_existent_domain_x7x6c572v:80; " +
    "PROXY localhost:" +
    HTTP_PORT +
    "';" +
    "}";

  let prefs = Services.prefs.getBranch("network.proxy.");
  prefs.setIntPref("type", 2);
  prefs.setStringPref("autoconfig_url", "data:text/plain," + PROXY_FUNCTION);
}

add_task(async function test_headers_copied() {
  triggerRedirect();

  _("Issuing request.");
  let resource = new Resource(TEST_URL);
  resource.setHeader("Authorization", "Basic foobar");
  resource.setHeader("X-Foo", "foofoo");

  let result = await resource.get(TEST_URL);
  _("Result: " + result.data);

  Assert.equal(result.data, BODY);
  Assert.equal(auth, "Basic foobar");
  Assert.equal(foo, "foofoo");

  await promiseStopServer(httpServer);
});
