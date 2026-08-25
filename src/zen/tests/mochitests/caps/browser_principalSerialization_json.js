"use strict";

/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/*
  This test file exists to ensure whenever changes to principal serialization happens,
  we guarantee that the data can be restored and generated into a new principal.

  The tests are written to be brittle so we encode all versions of the changes into the tests.
*/

add_task(async function test_nullPrincipal() {
  const nullId = "0";
  // fields
  const uri = 0;
  const suffix = 1;

  const nullReplaceRegex =
    /moz-nullprincipal:{[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}}/;
  const NULL_REPLACE = "NULL_PRINCIPAL_URL";

  /*
   This test should NOT be resilient to changes in versioning,
   however it exists purely to verify the code doesn't unintentionally change without updating versioning and migration code.
  */
  let tests = [
    {
      input: { OA: {} },
      expected: `{"${nullId}":{"${uri}":"${NULL_REPLACE}"}}`,
    },
    {
      input: { OA: {} },
      expected: `{"${nullId}":{"${uri}":"${NULL_REPLACE}"}}`,
    },
    {
      input: { OA: { userContextId: 0 } },
      expected: `{"${nullId}":{"${uri}":"${NULL_REPLACE}"}}`,
    },
    {
      input: { OA: { userContextId: 2 } },
      expected: `{"${nullId}":{"${uri}":"${NULL_REPLACE}","${suffix}":"^userContextId=2"}}`,
    },
    {
      input: { OA: { privateBrowsingId: 1 } },
      expected: `{"${nullId}":{"${uri}":"${NULL_REPLACE}","${suffix}":"^privateBrowsingId=1"}}`,
    },
    {
      input: { OA: { privateBrowsingId: 0 } },
      expected: `{"${nullId}":{"${uri}":"${NULL_REPLACE}"}}`,
    },
  ];

  for (let test of tests) {
    let p = Services.scriptSecurityManager.createNullPrincipal(test.input.OA);
    let sp = E10SUtils.serializePrincipal(p);
    // Not sure why cppjson is adding a \n here
    let spr = sp.replace(nullReplaceRegex, NULL_REPLACE);
    is(
      test.expected,
      spr,
      "Expected serialized object for " + JSON.stringify(test.input)
    );
    let dp = E10SUtils.deserializePrincipal(sp);

    // Check all the origin attributes
    for (let key in test.input.OA) {
      is(
        dp.originAttributes[key],
        test.input.OA[key],
        "Ensure value of " + key + " is " + test.input.OA[key]
      );
    }
  }
});

add_task(async function test_contentPrincipal() {
  const contentId = "1";
  // fields
  const content = 0;
  // const domain = 1;
  const suffix = 2;
  // const csp = 3;

  /*
   This test should NOT be resilient to changes in versioning,
   however it exists purely to verify the code doesn't unintentionally change without updating versioning and migration code.
  */
  let tests = [
    {
      // eslint-disable-next-line @microsoft/sdl/no-insecure-url
      input: { uri: "http://example.com/", OA: {} },
      expected: `{"${contentId}":{"${content}":"http://example.com/"}}`,
    },
    {
      // eslint-disable-next-line @microsoft/sdl/no-insecure-url
      input: { uri: "http://mozilla1.com/", OA: {} },
      expected: `{"${contentId}":{"${content}":"http://mozilla1.com/"}}`,
    },
    {
      // eslint-disable-next-line @microsoft/sdl/no-insecure-url
      input: { uri: "http://mozilla2.com/", OA: { userContextId: 0 } },
      expected: `{"${contentId}":{"${content}":"http://mozilla2.com/"}}`,
    },
    {
      // eslint-disable-next-line @microsoft/sdl/no-insecure-url
      input: { uri: "http://mozilla3.com/", OA: { userContextId: 2 } },
      expected: `{"${contentId}":{"${content}":"http://mozilla3.com/","${suffix}":"^userContextId=2"}}`,
    },
    {
      // eslint-disable-next-line @microsoft/sdl/no-insecure-url
      input: { uri: "http://mozilla4.com/", OA: { privateBrowsingId: 1 } },
      expected: `{"${contentId}":{"${content}":"http://mozilla4.com/","${suffix}":"^privateBrowsingId=1"}}`,
    },
    {
      // eslint-disable-next-line @microsoft/sdl/no-insecure-url
      input: { uri: "http://mozilla5.com/", OA: { privateBrowsingId: 0 } },
      expected: `{"${contentId}":{"${content}":"http://mozilla5.com/"}}`,
    },
  ];

  for (let test of tests) {
    let uri = Services.io.newURI(test.input.uri);
    let p = Services.scriptSecurityManager.createContentPrincipal(
      uri,
      test.input.OA
    );
    let sp = E10SUtils.serializePrincipal(p);
    is(test.expected, sp, "Expected serialized object for " + test.input.uri);
    let dp = E10SUtils.deserializePrincipal(sp);
    is(dp.URI.spec, test.input.uri, "Ensure spec is the same");

    // Check all the origin attributes
    for (let key in test.input.OA) {
      is(
        dp.originAttributes[key],
        test.input.OA[key],
        "Ensure value of " + key + " is " + test.input.OA[key]
      );
    }
  }
});

add_task(async function test_systemPrincipal() {
  const systemId = "3";
  /*
   This test should NOT be resilient to changes in versioning,
   however it exists purely to verify the code doesn't unintentionally change without updating versioning and migration code.
  */
  const expected = `{"${systemId}":{}}`;

  let p = Services.scriptSecurityManager.getSystemPrincipal();
  let sp = E10SUtils.serializePrincipal(p);
  is(expected, sp, "Expected serialized object for system principal");
  let dp = E10SUtils.deserializePrincipal(sp);
  is(
    dp,
    Services.scriptSecurityManager.getSystemPrincipal(),
    "Deserialized the system principal"
  );
});
