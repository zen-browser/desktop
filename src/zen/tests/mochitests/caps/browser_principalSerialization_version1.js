"use strict";

/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/*
  This test file exists to ensure whenever changes to principal serialization happens,
  we guarantee that the data can be restored and generated into a new principal.

  The tests are written to be brittle so we encode all versions of the changes into the tests.
*/

add_task(function test_nullPrincipal() {
  /*
   As Null principals are designed to be non deterministic we just need to ensure that
   a previous serialized version matches what it was generated as.

   This test should be resilient to changes in versioning, however it should also be duplicated for a new serialization change.
  */
  // Principal created with: E10SUtils.serializePrincipal(Services.scriptSecurityManager.createNullPrincipal({ }));
  let p = E10SUtils.deserializePrincipal(
    "vQZuXxRvRHKDMXv9BbHtkAAAAAAAAAAAwAAAAAAAAEYAAAA4bW96LW51bGxwcmluY2lwYWw6ezU2Y2FjNTQwLTg2NGQtNDdlNy04ZTI1LTE2MTRlYWI1MTU1ZX0AAAAA"
  );
  is(
    "moz-nullprincipal:{56cac540-864d-47e7-8e25-1614eab5155e}",
    p.URI.spec,
    "Deserialized principal doesn't have the correct URI"
  );

  // Principal created with: E10SUtils.serializePrincipal(Services.scriptSecurityManager.createNullPrincipal({ userContextId: 2 }));
  let p2 = E10SUtils.deserializePrincipal(
    "vQZuXxRvRHKDMXv9BbHtkAAAAAAAAAAAwAAAAAAAAEYAAAA4bW96LW51bGxwcmluY2lwYWw6ezA1ZjllN2JhLWIwODMtNDJhMi1iNDdkLTZiODRmNmYwYTM3OX0AAAAQXnVzZXJDb250ZXh0SWQ9Mg=="
  );
  is(
    "moz-nullprincipal:{05f9e7ba-b083-42a2-b47d-6b84f6f0a379}",
    p2.URI.spec,
    "Deserialized principal doesn't have the correct URI"
  );
  is(p2.originAttributes.userContextId, 2, "Expected a userContextId of 2");
});

add_task(async function test_realHistoryCheck() {
  /*
  This test should be resilient to changes in principal serialization, if these are failing then it's likely the code will break session storage.
  To recreate this for another version, copy the function into the browser console, browse some pages and printHistory.

  Generated with:
  function printHistory() {
    let tests = [];
    let entries = SessionStore.getSessionHistory(gBrowser.selectedTab).entries.map((entry) => { return entry.triggeringPrincipal_base64 });
    entries.push(E10SUtils.serializePrincipal(gBrowser.selectedTab.linkedBrowser._contentPrincipal));
    for (let entry of entries) {
      console.log(entry);
      let testData = {};
      testData.input = entry;
      let principal = E10SUtils.deserializePrincipal(testData.input);
      testData.output = {};
      if (principal.URI === null) {
        testData.output.URI = false;
      } else {
        testData.output.URISpec = principal.URI.spec;
      }
      testData.output.originAttributes = principal.originAttributes;

      tests.push(testData);
    }
    return tests;
  }
  printHistory(); // Copy this into: serializedPrincipalsFromFirefox
  */

  let serializedPrincipalsFromFirefox = [
    {
      input: "SmIS26zLEdO3ZQBgsLbOywAAAAAAAAAAwAAAAAAAAEY=",
      output: {
        URI: false,
        originAttributes: {
          firstPartyDomain: "",
          inIsolatedMozBrowser: false,
          privateBrowsingId: 0,
          userContextId: 0,
          geckoViewSessionContextId: "",
          partitionKey: "",
        },
      },
    },
    {
      input:
        "ZT4OTT7kRfqycpfCC8AeuAAAAAAAAAAAwAAAAAAAAEYB3pRy0IA0EdOTmQAQS6D9QJIHOlRteE8wkTq4cYEyCMYAAAAC/////wAAAbsBAAAAe2h0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTLz91dG1fc291cmNlPXd3dy5tb3ppbGxhLm9yZyZ1dG1fbWVkaXVtPXJlZmVycmFsJnV0bV9jYW1wYWlnbj1uYXYmdXRtX2NvbnRlbnQ9ZGV2ZWxvcGVycwAAAAAAAAAFAAAACAAAABUAAAAA/////wAAAAD/////AAAACAAAABUAAAAdAAAAXgAAAB0AAAAHAAAAHQAAAAcAAAAkAAAAAAAAAAD/////AAAAAP////8AAAAlAAAAVgAAAAD/////AQAAAAAAAAAAAAAAAA==",
      output: {
        URISpec:
          "https://developer.mozilla.org/en-US/?utm_source=www.mozilla.org&utm_medium=referral&utm_campaign=nav&utm_content=developers",
        originAttributes: {
          firstPartyDomain: "",
          inIsolatedMozBrowser: false,
          privateBrowsingId: 0,
          userContextId: 0,
          geckoViewSessionContextId: "",
          partitionKey: "",
        },
      },
    },
    {
      input: "SmIS26zLEdO3ZQBgsLbOywAAAAAAAAAAwAAAAAAAAEY=",
      output: {
        URI: false,
        originAttributes: {
          firstPartyDomain: "",
          inIsolatedMozBrowser: false,
          privateBrowsingId: 0,
          userContextId: 0,
          geckoViewSessionContextId: "",
          partitionKey: "",
        },
      },
    },
    {
      input:
        "vQZuXxRvRHKDMXv9BbHtkAAAAAAAAAAAwAAAAAAAAEYAAAA4bW96LW51bGxwcmluY2lwYWw6ezA0NWNhMThkLTQzNmMtNDc0NC1iYmI2LWIxYTE1MzY2ZGY3OX0AAAAA",
      output: {
        URISpec: "moz-nullprincipal:{045ca18d-436c-4744-bbb6-b1a15366df79}",
        originAttributes: {
          firstPartyDomain: "",
          inIsolatedMozBrowser: false,
          privateBrowsingId: 0,
          userContextId: 0,
          geckoViewSessionContextId: "",
          partitionKey: "",
        },
      },
    },
  ];

  for (let test of serializedPrincipalsFromFirefox) {
    let principal = E10SUtils.deserializePrincipal(test.input);

    for (let key in principal.originAttributes) {
      is(
        principal.originAttributes[key],
        test.output.originAttributes[key],
        `Ensure value of ${key} is ${test.output.originAttributes[key]}`
      );
    }

    if ("URI" in test.output && test.output.URI === false) {
      is(
        principal.isContentPrincipal,
        false,
        "Should have not have a URI for system"
      );
    } else {
      is(
        principal.spec,
        test.output.URISpec,
        `Should have spec ${test.output.URISpec}`
      );
    }
  }
});
