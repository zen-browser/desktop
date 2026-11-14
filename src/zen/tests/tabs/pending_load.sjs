/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { setTimeout } = ChromeUtils.importESModule(
  "resource://gre/modules/Timer.sys.mjs"
);

// Nothing is sent until the delay ends, so the load stays uncommitted and the
// tab keeps its initial about:blank document meanwhile.
async function handleRequest(request, response) {
  response.seizePower();

  await new Promise(r => setTimeout(r, 2000));

  const body = "<title>pending load</title><body>ok</body>";
  response.write("HTTP/1.1 200 OK\r\n");
  response.write("Content-Type: text/html\r\n");
  response.write(`Content-Length: ${body.length}\r\n`);
  response.write("\r\n");
  response.write(body);
  response.finish();
}
