/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { Observers } = ChromeUtils.importESModule(
  "resource://services-common/observers.sys.mjs"
);
const { Resource } = ChromeUtils.importESModule(
  "resource://services-sync/resource.sys.mjs"
);
const { SyncAuthManager } = ChromeUtils.importESModule(
  "resource://services-sync/sync_auth.sys.mjs"
);

var fetched = false;
function server_open(metadata, response) {
  let body;
  if (metadata.method == "GET") {
    fetched = true;
    body = "This path exists";
    response.setStatusLine(metadata.httpVersion, 200, "OK");
  } else {
    body = "Wrong request method";
    response.setStatusLine(metadata.httpVersion, 405, "Method Not Allowed");
  }
  response.bodyOutputStream.write(body, body.length);
}

function server_protected(metadata, response) {
  let body;

  if (has_hawk_header(metadata)) {
    body = "This path exists and is protected";
    response.setStatusLine(metadata.httpVersion, 200, "OK, authorized");
    response.setHeader("WWW-Authenticate", 'Basic realm="secret"', false);
  } else {
    body = "This path exists and is protected - failed";
    response.setStatusLine(metadata.httpVersion, 401, "Unauthorized");
    response.setHeader("WWW-Authenticate", 'Basic realm="secret"', false);
  }

  response.bodyOutputStream.write(body, body.length);
}

function server_404(metadata, response) {
  let body = "File not found";
  response.setStatusLine(metadata.httpVersion, 404, "Not Found");
  response.bodyOutputStream.write(body, body.length);
}

var pacFetched = false;
function server_pac(metadata, response) {
  _("Invoked PAC handler.");
  pacFetched = true;
  let body = 'function FindProxyForURL(url, host) { return "DIRECT"; }';
  response.setStatusLine(metadata.httpVersion, 200, "OK");
  response.setHeader(
    "Content-Type",
    "application/x-ns-proxy-autoconfig",
    false
  );
  response.bodyOutputStream.write(body, body.length);
}

var sample_data = {
  some: "sample_data",
  injson: "format",
  number: 42,
};

function server_upload(metadata, response) {
  let body;

  let input = readBytesFromInputStream(metadata.bodyInputStream);
  if (input == JSON.stringify(sample_data)) {
    body = "Valid data upload via " + metadata.method;
    response.setStatusLine(metadata.httpVersion, 200, "OK");
  } else {
    body = "Invalid data upload via " + metadata.method + ": " + input;
    response.setStatusLine(metadata.httpVersion, 500, "Internal Server Error");
  }

  response.bodyOutputStream.write(body, body.length);
}

function server_delete(metadata, response) {
  let body;
  if (metadata.method == "DELETE") {
    body = "This resource has been deleted";
    response.setStatusLine(metadata.httpVersion, 200, "OK");
  } else {
    body = "Wrong request method";
    response.setStatusLine(metadata.httpVersion, 405, "Method Not Allowed");
  }
  response.bodyOutputStream.write(body, body.length);
}

function server_json(metadata, response) {
  let body = JSON.stringify(sample_data);
  response.setStatusLine(metadata.httpVersion, 200, "OK");
  response.bodyOutputStream.write(body, body.length);
}

const TIMESTAMP = 1274380461;

function server_timestamp(metadata, response) {
  let body = "Thank you for your request";
  response.setHeader("X-Weave-Timestamp", "" + TIMESTAMP, false);
  response.setStatusLine(metadata.httpVersion, 200, "OK");
  response.bodyOutputStream.write(body, body.length);
}

function server_backoff(metadata, response) {
  let body = "Hey, back off!";
  response.setHeader("X-Weave-Backoff", "600", false);
  response.setStatusLine(metadata.httpVersion, 200, "OK");
  response.bodyOutputStream.write(body, body.length);
}

function server_quota_notice(request, response) {
  let body = "You're approaching quota.";
  response.setHeader("X-Weave-Quota-Remaining", "1048576", false);
  response.setStatusLine(request.httpVersion, 200, "OK");
  response.bodyOutputStream.write(body, body.length);
}

function server_quota_error(request, response) {
  let body = "14";
  response.setHeader("X-Weave-Quota-Remaining", "-1024", false);
  response.setStatusLine(request.httpVersion, 400, "OK");
  response.bodyOutputStream.write(body, body.length);
}

function server_headers(metadata, response) {
  let ignore_headers = [
    "host",
    "user-agent",
    "accept-language",
    "accept-encoding",
    "accept-charset",
    "keep-alive",
    "connection",
    "pragma",
    "origin",
    "cache-control",
    "content-length",
  ];
  let headers = metadata.headers;
  let header_names = [];
  while (headers.hasMoreElements()) {
    let header = headers.getNext().toString();
    if (!ignore_headers.includes(header)) {
      header_names.push(header);
    }
  }
  header_names = header_names.sort();

  headers = {};
  for (let header of header_names) {
    headers[header] = metadata.getHeader(header);
  }
  let body = JSON.stringify(headers);
  response.setStatusLine(metadata.httpVersion, 200, "OK");
  response.bodyOutputStream.write(body, body.length);
}

var quotaValue;
Observers.add("weave:service:quota:remaining", function (subject) {
  quotaValue = subject;
});

function run_test() {
  Log.repository.rootLogger.addAppender(new Log.DumpAppender());

  Svc.PrefBranch.setIntPref("network.numRetries", 1); // speed up test
  run_next_test();
}

// This apparently has to come first in order for our PAC URL to be hit.
// Don't put any other HTTP requests earlier in the file!
add_task(async function test_proxy_auth_redirect() {
  _(
    "Ensure that a proxy auth redirect (which switches out our channel) " +
      "doesn't break Resource."
  );
  let server = httpd_setup({
    "/open": server_open,
    "/pac2": server_pac,
  });

  PACSystemSettings.PACURI = server.baseURI + "/pac2";
  installFakePAC();
  let res = new Resource(server.baseURI + "/open");
  let result = await res.get();
  Assert.ok(pacFetched);
  Assert.ok(fetched);
  Assert.equal("This path exists", result.data);
  pacFetched = fetched = false;
  uninstallFakePAC();
  await promiseStopServer(server);
});

add_task(async function test_new_channel() {
  _("Ensure a redirect to a new channel is handled properly.");

  let resourceRequested = false;
  function resourceHandler(metadata, response) {
    resourceRequested = true;

    let body = "Test";
    response.setHeader("Content-Type", "text/plain");
    response.bodyOutputStream.write(body, body.length);
  }

  let locationURL;
  function redirectHandler(metadata, response) {
    let body = "Redirecting";
    response.setStatusLine(metadata.httpVersion, 307, "TEMPORARY REDIRECT");
    response.setHeader("Location", locationURL);
    response.bodyOutputStream.write(body, body.length);
  }

  let server = httpd_setup({
    "/resource": resourceHandler,
    "/redirect": redirectHandler,
  });
  locationURL = server.baseURI + "/resource";

  let request = new Resource(server.baseURI + "/redirect");
  let content = await request.get();
  Assert.ok(resourceRequested);
  Assert.equal(200, content.status);
  Assert.ok("content-type" in content.headers);
  Assert.equal("text/plain", content.headers["content-type"]);

  await promiseStopServer(server);
});

var server;

add_test(function setup() {
  server = httpd_setup({
    "/open": server_open,
    "/protected": server_protected,
    "/404": server_404,
    "/upload": server_upload,
    "/delete": server_delete,
    "/json": server_json,
    "/timestamp": server_timestamp,
    "/headers": server_headers,
    "/backoff": server_backoff,
    "/pac2": server_pac,
    "/quota-notice": server_quota_notice,
    "/quota-error": server_quota_error,
  });

  run_next_test();
});

add_test(function test_members() {
  _("Resource object members");
  let uri = server.baseURI + "/open";
  let res = new Resource(uri);
  Assert.ok(res.uri instanceof Ci.nsIURI);
  Assert.equal(res.uri.spec, uri);
  Assert.equal(res.spec, uri);
  Assert.equal(typeof res.headers, "object");
  Assert.equal(typeof res.authenticator, "object");

  run_next_test();
});

add_task(async function test_get() {
  _("GET a non-password-protected resource");
  let res = new Resource(server.baseURI + "/open");
  let content = await res.get();
  Assert.equal(content.data, "This path exists");
  Assert.equal(content.status, 200);
  Assert.ok(content.success);

  // Observe logging messages.
  let resLogger = res._log;
  let dbg = resLogger.debug;
  let debugMessages = [];
  resLogger.debug = function (msg, extra) {
    debugMessages.push(`${msg}: ${JSON.stringify(extra)}`);
    dbg.call(this, msg);
  };

  // Since we didn't receive proper JSON data, accessing content.obj
  // will result in a SyntaxError from JSON.parse
  let didThrow = false;
  try {
    content.obj;
  } catch (ex) {
    didThrow = true;
  }
  Assert.ok(didThrow);
  Assert.equal(debugMessages.length, 1);
  Assert.equal(
    debugMessages[0],
    'Parse fail: Response body starts: "This path exists"'
  );
  resLogger.debug = dbg;
});

add_test(function test_basicauth() {
  _("Test that the BasicAuthenticator doesn't screw up header case.");
  let res1 = new Resource(server.baseURI + "/foo");
  res1.setHeader("Authorization", "Basic foobar");
  Assert.equal(res1._headers.authorization, "Basic foobar");
  Assert.equal(res1.headers.authorization, "Basic foobar");

  run_next_test();
});

add_task(async function test_get_protected_fail() {
  _(
    "GET a password protected resource (test that it'll fail w/o pass, no throw)"
  );
  let res2 = new Resource(server.baseURI + "/protected");
  let content = await res2.get();
  Assert.equal(content.data, "This path exists and is protected - failed");
  Assert.equal(content.status, 401);
  Assert.ok(!content.success);
});

add_task(async function test_get_protected_success() {
  _("GET a password protected resource");
  let identityConfig = makeIdentityConfig();
  let syncAuthManager = new SyncAuthManager();
  configureFxAccountIdentity(syncAuthManager, identityConfig);
  let auth = syncAuthManager.getResourceAuthenticator();
  let res3 = new Resource(server.baseURI + "/protected");
  res3.authenticator = auth;
  Assert.equal(res3.authenticator, auth);
  let content = await res3.get();
  Assert.equal(content.data, "This path exists and is protected");
  Assert.equal(content.status, 200);
  Assert.ok(content.success);
});

add_task(async function test_get_404() {
  _("GET a non-existent resource (test that it'll fail, but not throw)");
  let res4 = new Resource(server.baseURI + "/404");
  let content = await res4.get();
  Assert.equal(content.data, "File not found");
  Assert.equal(content.status, 404);
  Assert.ok(!content.success);

  // Check some headers of the 404 response
  Assert.equal(content.headers.connection, "close");
  Assert.equal(content.headers.server, "httpd.js");
  Assert.equal(content.headers["content-length"], 14);
});

add_task(async function test_put_string() {
  _("PUT to a resource (string)");
  let res_upload = new Resource(server.baseURI + "/upload");
  let content = await res_upload.put(JSON.stringify(sample_data));
  Assert.equal(content.data, "Valid data upload via PUT");
  Assert.equal(content.status, 200);
});

add_task(async function test_put_object() {
  _("PUT to a resource (object)");
  let res_upload = new Resource(server.baseURI + "/upload");
  let content = await res_upload.put(sample_data);
  Assert.equal(content.data, "Valid data upload via PUT");
  Assert.equal(content.status, 200);
});

add_task(async function test_post_string() {
  _("POST to a resource (string)");
  let res_upload = new Resource(server.baseURI + "/upload");
  let content = await res_upload.post(JSON.stringify(sample_data));
  Assert.equal(content.data, "Valid data upload via POST");
  Assert.equal(content.status, 200);
});

add_task(async function test_post_object() {
  _("POST to a resource (object)");
  let res_upload = new Resource(server.baseURI + "/upload");
  let content = await res_upload.post(sample_data);
  Assert.equal(content.data, "Valid data upload via POST");
  Assert.equal(content.status, 200);
});

add_task(async function test_delete() {
  _("DELETE a resource");
  let res6 = new Resource(server.baseURI + "/delete");
  let content = await res6.delete();
  Assert.equal(content.data, "This resource has been deleted");
  Assert.equal(content.status, 200);
});

add_task(async function test_json_body() {
  _("JSON conversion of response body");
  let res7 = new Resource(server.baseURI + "/json");
  let content = await res7.get();
  Assert.equal(content.data, JSON.stringify(sample_data));
  Assert.equal(content.status, 200);
  Assert.equal(JSON.stringify(content.obj), JSON.stringify(sample_data));
});

add_task(async function test_weave_timestamp() {
  _("X-Weave-Timestamp header updates Resource.serverTime");
  // Before having received any response containing the
  // X-Weave-Timestamp header, Resource.serverTime is null.
  Assert.equal(Resource.serverTime, null);
  let res8 = new Resource(server.baseURI + "/timestamp");
  await res8.get();
  Assert.equal(Resource.serverTime, TIMESTAMP);
});

add_task(async function test_get_default_headers() {
  _("GET: Accept defaults to application/json");
  let res_headers = new Resource(server.baseURI + "/headers");
  let content = JSON.parse((await res_headers.get()).data);
  Assert.equal(content.accept, "application/json;q=0.9,*/*;q=0.2");
});

add_task(async function test_put_default_headers() {
  _(
    "PUT: Accept defaults to application/json, Content-Type defaults to text/plain"
  );
  let res_headers = new Resource(server.baseURI + "/headers");
  let content = JSON.parse((await res_headers.put("data")).data);
  Assert.equal(content.accept, "application/json;q=0.9,*/*;q=0.2");
  Assert.equal(content["content-type"], "text/plain");
});

add_task(async function test_post_default_headers() {
  _(
    "POST: Accept defaults to application/json, Content-Type defaults to text/plain"
  );
  let res_headers = new Resource(server.baseURI + "/headers");
  let content = JSON.parse((await res_headers.post("data")).data);
  Assert.equal(content.accept, "application/json;q=0.9,*/*;q=0.2");
  Assert.equal(content["content-type"], "text/plain");
});

add_task(async function test_setHeader() {
  _("setHeader(): setting simple header");
  let res_headers = new Resource(server.baseURI + "/headers");
  res_headers.setHeader("X-What-Is-Weave", "awesome");
  Assert.equal(res_headers.headers["x-what-is-weave"], "awesome");
  let content = JSON.parse((await res_headers.get()).data);
  Assert.equal(content["x-what-is-weave"], "awesome");
});

add_task(async function test_setHeader_overwrite() {
  _("setHeader(): setting multiple headers, overwriting existing header");
  let res_headers = new Resource(server.baseURI + "/headers");
  res_headers.setHeader("X-WHAT-is-Weave", "more awesomer");
  res_headers.setHeader("X-Another-Header", "hello world");
  Assert.equal(res_headers.headers["x-what-is-weave"], "more awesomer");
  Assert.equal(res_headers.headers["x-another-header"], "hello world");
  let content = JSON.parse((await res_headers.get()).data);
  Assert.equal(content["x-what-is-weave"], "more awesomer");
  Assert.equal(content["x-another-header"], "hello world");
});

add_task(async function test_put_override_content_type() {
  _("PUT: override default Content-Type");
  let res_headers = new Resource(server.baseURI + "/headers");
  res_headers.setHeader("Content-Type", "application/foobar");
  Assert.equal(res_headers.headers["content-type"], "application/foobar");
  let content = JSON.parse((await res_headers.put("data")).data);
  Assert.equal(content["content-type"], "application/foobar");
});

add_task(async function test_post_override_content_type() {
  _("POST: override default Content-Type");
  let res_headers = new Resource(server.baseURI + "/headers");
  res_headers.setHeader("Content-Type", "application/foobar");
  let content = JSON.parse((await res_headers.post("data")).data);
  Assert.equal(content["content-type"], "application/foobar");
});

add_task(async function test_weave_backoff() {
  _("X-Weave-Backoff header notifies observer");
  let backoffInterval;
  function onBackoff(subject) {
    backoffInterval = subject;
  }
  Observers.add("weave:service:backoff:interval", onBackoff);

  let res10 = new Resource(server.baseURI + "/backoff");
  await res10.get();
  Assert.equal(backoffInterval, 600);
});

add_task(async function test_quota_error() {
  _("X-Weave-Quota-Remaining header notifies observer on successful requests.");
  let res10 = new Resource(server.baseURI + "/quota-error");
  let content = await res10.get();
  Assert.equal(content.status, 400);
  Assert.equal(quotaValue, undefined); // HTTP 400, so no observer notification.
});

add_task(async function test_quota_notice() {
  let res10 = new Resource(server.baseURI + "/quota-notice");
  let content = await res10.get();
  Assert.equal(content.status, 200);
  Assert.equal(quotaValue, 1048576);
});

add_task(async function test_preserve_exceptions() {
  _("Error handling preserves exception information");
  let res11 = new Resource("http://localhost:12345/does/not/exist");
  await Assert.rejects(res11.get(), error => {
    Assert.notEqual(error, null);
    Assert.equal(error.result, Cr.NS_ERROR_CONNECTION_REFUSED);
    Assert.equal(error.name, "NS_ERROR_CONNECTION_REFUSED");
    return true;
  });
});

add_task(async function test_timeout() {
  _("Ensure channel timeouts are thrown appropriately.");
  let res19 = new Resource(server.baseURI + "/json");
  res19.ABORT_TIMEOUT = 0;
  await Assert.rejects(res19.get(), error => {
    Assert.equal(error.result, Cr.NS_ERROR_NET_TIMEOUT);
    return true;
  });
});

add_test(function test_uri_construction() {
  _("Testing URI construction.");
  let args = [];
  args.push("newer=" + 1234);
  args.push("limit=" + 1234);
  args.push("sort=" + 1234);

  let query = "?" + args.join("&");

  let uri1 = CommonUtils.makeURI("http://foo/" + query).QueryInterface(
    Ci.nsIURL
  );
  let uri2 = CommonUtils.makeURI("http://foo/").QueryInterface(Ci.nsIURL);
  uri2 = uri2.mutate().setQuery(query).finalize().QueryInterface(Ci.nsIURL);
  Assert.equal(uri1.query, uri2.query);

  run_next_test();
});

/**
 * End of tests that rely on a single HTTP server.
 * All tests after this point must begin and end their own.
 */
add_test(function eliminate_server() {
  server.stop(run_next_test);
});
