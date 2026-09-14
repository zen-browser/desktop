/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { HttpServer } = ChromeUtils.importESModule(
  "resource://testing-common/httpd.sys.mjs"
);

const VALID_DOC = {
  version: "1",
  shared: {
    type: "space",
    name: "Test",
    items: [{ type: "tab", url: "https://example.com/", label: "T" }],
  },
};

let server;
let base;

let lastRequest = null;
let nextResponse = null;

function readBody(request) {
  return NetUtil.readInputStreamToString(
    request.bodyInputStream,
    request.bodyInputStream.available()
  );
}

add_setup(async function () {
  server = new HttpServer();
  server.registerPathHandler("/api/shares", (request, response) => {
    lastRequest = {
      method: request.method,
      query: request.queryString,
      apiKey: request.hasHeader("x-api-key")
        ? request.getHeader("x-api-key")
        : null,
      secretKey: request.hasHeader("x-secret-key")
        ? request.getHeader("x-secret-key")
        : null,
      body: readBody(request),
    };
    if (nextResponse) {
      response.setStatusLine(request.httpVersion, nextResponse.status, "Err");
      response.setHeader("Content-Type", "application/json");
      response.write(nextResponse.body);
      nextResponse = null;
      return;
    }
    response.setStatusLine(request.httpVersion, 201, "Created");
    response.setHeader("Content-Type", "application/json");
    response.write(
      JSON.stringify({
        id: SHARE_ID,
        name: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
        size: 10,
        url: `/api/shares/${SHARE_ID}`,
        webUrl: `/space/${SHARE_ID}`,
      })
    );
  });
  server.registerPrefixHandler("/api/shares/", (request, response) => {
    if (request.path.endsWith("/GONE-GONE-GONE-GONE")) {
      response.setStatusLine(request.httpVersion, 404, "Not Found");
      response.setHeader("Content-Type", "application/json");
      response.write(JSON.stringify({ error: "share not found" }));
      return;
    }
    response.setStatusLine(request.httpVersion, 200, "OK");
    response.setHeader("Content-Type", "application/json");
    response.write(
      JSON.stringify({
        id: SHARE_ID,
        name: "John Zen",
        createdAt: new Date().toISOString(),
        expiresAt: null,
        size: 10,
        data: request.path.endsWith("/BADD-BADD-BADD-BADD")
          ? { shared: [] }
          : VALID_DOC,
      })
    );
  });
  server.start(-1);
  base = `http://localhost:${server.identity.primaryPort}`;
  await SpecialPowers.pushPrefEnv({
    set: [["zen.share.base-url", base]],
  });
  registerCleanupFunction(() => new Promise(resolve => server.stop(resolve)));
});

add_task(async function test_create_share() {
  const created = await ZenShareClient.createShare(VALID_DOC, {
    name: "John Zen",
  });
  Assert.equal(lastRequest.secretKey, null, "no secret key by default");
  Assert.deepEqual(
    JSON.parse(lastRequest.body),
    VALID_DOC,
    "the body is the bare document"
  );
  Assert.equal(
    created.link,
    `${base}/space/${SHARE_ID}`,
    "link is the absolute public page url"
  );
});

add_task(async function test_secret_key_replaces_api_key() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.share.secret-key", "shhh"]],
  });
  await ZenShareClient.createShare(VALID_DOC);
  Assert.equal(lastRequest.secretKey, "shhh", "secret key is sent");
  Assert.equal(
    lastRequest.apiKey,
    null,
    "the api key is never sent next to a secret key"
  );
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_invalid_document_never_uploads() {
  lastRequest = null;
  await Assert.rejects(
    ZenShareClient.createShare({ shared: [] }),
    e => e.code === "invalid-document",
    "an array shared value fails the schema"
  );
  await Assert.rejects(
    ZenShareClient.createShare({
      shared: { type: "space", name: "x", items: [], extra: true },
    }),
    e => e.code === "invalid-document",
    "additionalProperties are rejected locally"
  );
  Assert.equal(lastRequest, null, "invalid documents never hit the server");
});

add_task(async function test_fetch_share_preview() {
  const preview = await ZenShareClient.fetchSharePreview({ id: SHARE_ID });
  Assert.equal(preview.name, "John Zen", "the sharer name comes back");
  Assert.deepEqual(preview.doc, VALID_DOC, "the document comes back");

  await Assert.rejects(
    ZenShareClient.fetchSharePreview({ id: "GONE-GONE-GONE-GONE" }),
    e => e.code === "not-found",
    "dead shares map to not-found"
  );
  await Assert.rejects(
    ZenShareClient.fetchSharePreview({ id: "BADD-BADD-BADD-BADD" }),
    e => e.code === "invalid-document",
    "downloaded documents are validated too"
  );
});
