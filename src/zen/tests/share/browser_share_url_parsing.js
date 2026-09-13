/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_slugs_and_types() {
  for (const [slug, type] of [
    ["space", "space"],
    ["folder", "folder"],
    ["split-view", "split-view"],
    // "split" is the canonical server slug for split views.
    ["split", "split-view"],
  ]) {
    const share = ZenShareClient.parseShareUrl(
      `${SHARE_BASE}/${slug}/${SHARE_ID}`
    );
    Assert.equal(share?.type, type, `${slug} maps to ${type}`);
    Assert.equal(share?.id, SHARE_ID, `${slug} keeps the id`);
  }
});

add_task(async function test_id_normalization() {
  const share = ZenShareClient.parseShareUrl(
    `${SHARE_BASE}/space/aaaa-bbbb-cccc-dddd`
  );
  Assert.equal(share?.id, SHARE_ID, "ids are matched case-insensitively");
});

add_task(async function test_query_and_fragment_tolerated() {
  Assert.ok(
    ZenShareClient.parseShareUrl(`${SHARE_BASE}/space/${SHARE_ID}/`),
    "trailing slash is accepted"
  );
  Assert.ok(
    ZenShareClient.parseShareUrl(`${SHARE_BASE}/space/${SHARE_ID}?utm=x`),
    "query strings are ignored"
  );
  Assert.ok(
    ZenShareClient.parseShareUrl(`${SHARE_BASE}/space/${SHARE_ID}#frag`),
    "fragments are ignored"
  );
});

add_task(async function test_rejections() {
  for (const spec of [
    `https://not-the-server.com/space/${SHARE_ID}`,
    `${SHARE_BASE}/space/aRO9GBjhTOTZ`, // the old 12-char id format
    `${SHARE_BASE}/space/AAAA-BBBB-CCCC`, // too few groups
    `${SHARE_BASE}/nonsense/${SHARE_ID}`,
    `${SHARE_BASE}/space/${SHARE_ID}/extra`,
    `${SHARE_BASE}/space/`,
    "not a url",
  ]) {
    Assert.equal(ZenShareClient.parseShareUrl(spec), null, `rejects ${spec}`);
  }
});
