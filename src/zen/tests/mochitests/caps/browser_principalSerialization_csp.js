/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/*
 * Within Bug 965637 we move the CSP away from the Principal. Serialized Principals however
 * might still have CSPs serialized within them. This tests ensures that we do not
 * encounter a memory corruption when deserializing. It's fine that the deserialized
 * CSP is null, but the Principal itself should deserialize correctly.
 */

add_task(async function test_deserialize_principal_with_csp() {
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
      testData.output.cspJSON = principal.cspJSON;

      tests.push(testData);
    }
    return tests;
  }
  printHistory(); // Copy this into: serializedPrincipalsFromFirefox
  */

  let serializedPrincipalsFromFirefox = [
    {
      input:
        "ZT4OTT7kRfqycpfCC8AeuAAAAAAAAAAAwAAAAAAAAEYB3pRy0IA0EdOTmQAQS6D9QJIHOlRteE8wkTq4cYEyCMYAAAAC/////wAAAbsBAAAAHmh0dHBzOi8vd3d3Lm1vemlsbGEub3JnL2VuLVVTLwAAAAAAAAAFAAAACAAAAA8AAAAA/////wAAAAD/////AAAACAAAAA8AAAAXAAAABwAAABcAAAAHAAAAFwAAAAcAAAAeAAAAAAAAAAD/////AAAAAP////8AAAAA/////wAAAAD/////AQAAAAAAAAAAAAAAAQnZ7Rrl1EAEv+Anzrkj2ayzxMCuvV5MrYfgjSENuz+fAd6UctCANBHTk5kAEEug/UCSBzpUbXhPMJE6uHGBMgjGAAAAAv////8AAAG7AQAAAB5odHRwczovL3d3dy5tb3ppbGxhLm9yZy9lbi1VUy8AAAAAAAAABQAAAAgAAAAPAAAAAP////8AAAAA/////wAAAAgAAAAPAAAAFwAAAAcAAAAXAAAABwAAABcAAAAHAAAAHgAAAAAAAAAA/////wAAAAD/////AAAAAP////8AAAAA/////wEAAAAAAAAAAAABAAAFtgBzAGMAcgBpAHAAdAAtAHMAcgBjACAAJwBzAGUAbABmACcAIABoAHQAdABwAHMAOgAvAC8AKgAuAG0AbwB6AGkAbABsAGEALgBuAGUAdAAgAGgAdAB0AHAAcwA6AC8ALwAqAC4AbQBvAHoAaQBsAGwAYQAuAG8AcgBnACAAaAB0AHQAcABzADoALwAvACoALgBtAG8AegBpAGwAbABhAC4AYwBvAG0AIAAnAHUAbgBzAGEAZgBlAC0AaQBuAGwAaQBuAGUAJwAgACcAdQBuAHMAYQBmAGUALQBlAHYAYQBsACcAIABoAHQAdABwAHMAOgAvAC8AdwB3AHcALgBnAG8AbwBnAGwAZQB0AGEAZwBtAGEAbgBhAGcAZQByAC4AYwBvAG0AIABoAHQAdABwAHMAOgAvAC8AdwB3AHcALgBnAG8AbwBnAGwAZQAtAGEAbgBhAGwAeQB0AGkAYwBzAC4AYwBvAG0AIABoAHQAdABwAHMAOgAvAC8AdABhAGcAbQBhAG4AYQBnAGUAcgAuAGcAbwBvAGcAbABlAC4AYwBvAG0AIABoAHQAdABwAHMAOgAvAC8AdwB3AHcALgB5AG8AdQB0AHUAYgBlAC4AYwBvAG0AIABoAHQAdABwAHMAOgAvAC8AcwAuAHkAdABpAG0AZwAuAGMAbwBtADsAIABpAG0AZwAtAHMAcgBjACAAJwBzAGUAbABmACcAIABoAHQAdABwAHMAOgAvAC8AKgAuAG0AbwB6AGkAbABsAGEALgBuAGUAdAAgAGgAdAB0AHAAcwA6AC8ALwAqAC4AbQBvAHoAaQBsAGwAYQAuAG8AcgBnACAAaAB0AHQAcABzADoALwAvACoALgBtAG8AegBpAGwAbABhAC4AYwBvAG0AIABkAGEAdABhADoAIABoAHQAdABwAHMAOgAvAC8AbQBvAHoAaQBsAGwAYQAuAG8AcgBnACAAaAB0AHQAcABzADoALwAvAHcAdwB3AC4AZwBvAG8AZwBsAGUAdABhAGcAbQBhAG4AYQBnAGUAcgAuAGMAbwBtACAAaAB0AHQAcABzADoALwAvAHcAdwB3AC4AZwBvAG8AZwBsAGUALQBhAG4AYQBsAHkAdABpAGMAcwAuAGMAbwBtACAAaAB0AHQAcABzADoALwAvAGEAZABzAGUAcgB2AGkAYwBlAC4AZwBvAG8AZwBsAGUALgBjAG8AbQAgAGgAdAB0AHAAcwA6AC8ALwBhAGQAcwBlAHIAdgBpAGMAZQAuAGcAbwBvAGcAbABlAC4AZABlACAAaAB0AHQAcABzADoALwAvAGEAZABzAGUAcgB2AGkAYwBlAC4AZwBvAG8AZwBsAGUALgBkAGsAIABoAHQAdABwAHMAOgAvAC8AYwByAGUAYQB0AGkAdgBlAGMAbwBtAG0AbwBuAHMALgBvAHIAZwAgAGgAdAB0AHAAcwA6AC8ALwBhAGQALgBkAG8AdQBiAGwAZQBjAGwAaQBjAGsALgBuAGUAdAA7ACAAZABlAGYAYQB1AGwAdAAtAHMAcgBjACAAJwBzAGUAbABmACcAIABoAHQAdABwAHMAOgAvAC8AKgAuAG0AbwB6AGkAbABsAGEALgBuAGUAdAAgAGgAdAB0AHAAcwA6AC8ALwAqAC4AbQBvAHoAaQBsAGwAYQAuAG8AcgBnACAAaAB0AHQAcABzADoALwAvACoALgBtAG8AegBpAGwAbABhAC4AYwBvAG0AOwAgAGYAcgBhAG0AZQAtAHMAcgBjACAAaAB0AHQAcABzADoALwAvAHcAdwB3AC4AZwBvAG8AZwBsAGUAdABhAGcAbQBhAG4AYQBnAGUAcgAuAGMAbwBtACAAaAB0AHQAcABzADoALwAvAHcAdwB3AC4AZwBvAG8AZwBsAGUALQBhAG4AYQBsAHkAdABpAGMAcwAuAGMAbwBtACAAaAB0AHQAcABzADoALwAvAHcAdwB3AC4AeQBvAHUAdAB1AGIAZQAtAG4AbwBjAG8AbwBrAGkAZQAuAGMAbwBtACAAaAB0AHQAcABzADoALwAvAHQAcgBhAGMAawBlAHIAdABlAHMAdAAuAG8AcgBnACAAaAB0AHQAcABzADoALwAvAHcAdwB3AC4AcwB1AHIAdgBlAHkAZwBpAHoAbQBvAC4AYwBvAG0AIABoAHQAdABwAHMAOgAvAC8AYQBjAGMAbwB1AG4AdABzAC4AZgBpAHIAZQBmAG8AeAAuAGMAbwBtACAAaAB0AHQAcABzADoALwAvAGEAYwBjAG8AdQBuAHQAcwAuAGYAaQByAGUAZgBvAHgALgBjAG8AbQAuAGMAbgAgAGgAdAB0AHAAcwA6AC8ALwB3AHcAdwAuAHkAbwB1AHQAdQBiAGUALgBjAG8AbQA7ACAAcwB0AHkAbABlAC0AcwByAGMAIAAnAHMAZQBsAGYAJwAgAGgAdAB0AHAAcwA6AC8ALwAqAC4AbQBvAHoAaQBsAGwAYQAuAG4AZQB0ACAAaAB0AHQAcABzADoALwAvACoALgBtAG8AegBpAGwAbABhAC4AbwByAGcAIABoAHQAdABwAHMAOgAvAC8AKgAuAG0AbwB6AGkAbABsAGEALgBjAG8AbQAgACcAdQBuAHMAYQBmAGUALQBpAG4AbABpAG4AZQAnADsAIABjAG8AbgBuAGUAYwB0AC0AcwByAGMAIAAnAHMAZQBsAGYAJwAgAGgAdAB0AHAAcwA6AC8ALwAqAC4AbQBvAHoAaQBsAGwAYQAuAG4AZQB0ACAAaAB0AHQAcABzADoALwAvACoALgBtAG8AegBpAGwAbABhAC4AbwByAGcAIABoAHQAdABwAHMAOgAvAC8AKgAuAG0AbwB6AGkAbABsAGEALgBjAG8AbQAgAGgAdAB0AHAAcwA6AC8ALwB3AHcAdwAuAGcAbwBvAGcAbABlAHQAYQBnAG0AYQBuAGEAZwBlAHIALgBjAG8AbQAgAGgAdAB0AHAAcwA6AC8ALwB3AHcAdwAuAGcAbwBvAGcAbABlAC0AYQBuAGEAbAB5AHQAaQBjAHMALgBjAG8AbQAgAGgAdAB0AHAAcwA6AC8ALwBhAGMAYwBvAHUAbgB0AHMALgBmAGkAcgBlAGYAbwB4AC4AYwBvAG0ALwAgAGgAdAB0AHAAcwA6AC8ALwBhAGMAYwBvAHUAbgB0AHMALgBmAGkAcgBlAGYAbwB4AC4AYwBvAG0ALgBjAG4ALwA7ACAAYwBoAGkAbABkAC0AcwByAGMAIABoAHQAdABwAHMAOgAvAC8AdwB3AHcALgBnAG8AbwBnAGwAZQB0AGEAZwBtAGEAbgBhAGcAZQByAC4AYwBvAG0AIABoAHQAdABwAHMAOgAvAC8AdwB3AHcALgBnAG8AbwBnAGwAZQAtAGEAbgBhAGwAeQB0AGkAYwBzAC4AYwBvAG0AIABoAHQAdABwAHMAOgAvAC8AdwB3AHcALgB5AG8AdQB0AHUAYgBlAC0AbgBvAGMAbwBvAGsAaQBlAC4AYwBvAG0AIABoAHQAdABwAHMAOgAvAC8AdAByAGEAYwBrAGUAcgB0AGUAcwB0AC4AbwByAGcAIABoAHQAdABwAHMAOgAvAC8AdwB3AHcALgBzAHUAcgB2AGUAeQBnAGkAegBtAG8ALgBjAG8AbQAgAGgAdAB0AHAAcwA6AC8ALwBhAGMAYwBvAHUAbgB0AHMALgBmAGkAcgBlAGYAbwB4AC4AYwBvAG0AIABoAHQAdABwAHMAOgAvAC8AYQBjAGMAbwB1AG4AdABzAC4AZgBpAHIAZQBmAG8AeAAuAGMAbwBtAC4AYwBuACAAaAB0AHQAcABzADoALwAvAHcAdwB3AC4AeQBvAHUAdAB1AGIAZQAuAGMAbwBtAAA=",
      output: {
        // Within Bug 965637 we removed CSP from Principals. Already serialized Principals however should still deserialize correctly (just without the CSP).
        // "cspJSON": "{\"csp-policies\":[{\"child-src\":[\"https://www.googletagmanager.com\",\"https://www.google-analytics.com\",\"https://www.youtube-nocookie.com\",\"https://trackertest.org\",\"https://www.surveygizmo.com\",\"https://accounts.firefox.com\",\"https://accounts.firefox.com.cn\",\"https://www.youtube.com\"],\"connect-src\":[\"'self'\",\"https://*.mozilla.net\",\"https://*.mozilla.org\",\"https://*.mozilla.com\",\"https://www.googletagmanager.com\",\"https://www.google-analytics.com\",\"https://accounts.firefox.com/\",\"https://accounts.firefox.com.cn/\"],\"default-src\":[\"'self'\",\"https://*.mozilla.net\",\"https://*.mozilla.org\",\"https://*.mozilla.com\"],\"frame-src\":[\"https://www.googletagmanager.com\",\"https://www.google-analytics.com\",\"https://www.youtube-nocookie.com\",\"https://trackertest.org\",\"https://www.surveygizmo.com\",\"https://accounts.firefox.com\",\"https://accounts.firefox.com.cn\",\"https://www.youtube.com\"],\"img-src\":[\"'self'\",\"https://*.mozilla.net\",\"https://*.mozilla.org\",\"https://*.mozilla.com\",\"data:\",\"https://mozilla.org\",\"https://www.googletagmanager.com\",\"https://www.google-analytics.com\",\"https://adservice.google.com\",\"https://adservice.google.de\",\"https://adservice.google.dk\",\"https://creativecommons.org\",\"https://ad.doubleclick.net\"],\"report-only\":false,\"script-src\":[\"'self'\",\"https://*.mozilla.net\",\"https://*.mozilla.org\",\"https://*.mozilla.com\",\"'unsafe-inline'\",\"'unsafe-eval'\",\"https://www.googletagmanager.com\",\"https://www.google-analytics.com\",\"https://tagmanager.google.com\",\"https://www.youtube.com\",\"https://s.ytimg.com\"],\"style-src\":[\"'self'\",\"https://*.mozilla.net\",\"https://*.mozilla.org\",\"https://*.mozilla.com\",\"'unsafe-inline'\"]}]}",
        URISpec: "https://www.mozilla.org/en-US/",
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
        "ZT4OTT7kRfqycpfCC8AeuAAAAAAAAAAAwAAAAAAAAEYB3pRy0IA0EdOTmQAQS6D9QJIHOlRteE8wkTq4cYEyCMYAAAAC/////wAAAbsBAAAAL2h0dHBzOi8vd3d3Lm1vemlsbGEub3JnL2VuLVVTL2ZpcmVmb3gvYWNjb3VudHMvAAAAAAAAAAUAAAAIAAAADwAAAAj/////AAAACP////8AAAAIAAAADwAAABcAAAAYAAAAFwAAABgAAAAXAAAAGAAAAC8AAAAAAAAAL/////8AAAAA/////wAAABf/////AAAAF/////8BAAAAAAAAAAAAAAABCdntGuXUQAS/4CfOuSPZrLPEwK69Xkyth+CNIQ27P58B3pRy0IA0EdOTmQAQS6D9QJIHOlRteE8wkTq4cYEyCMYAAAAC/////wAAAbsBAAAAL2h0dHBzOi8vd3d3Lm1vemlsbGEub3JnL2VuLVVTL2ZpcmVmb3gvYWNjb3VudHMvAAAAAAAAAAUAAAAIAAAADwAAAAj/////AAAACP////8AAAAIAAAADwAAABcAAAAYAAAAFwAAABgAAAAXAAAAGAAAAC8AAAAAAAAAL/////8AAAAA/////wAAABf/////AAAAF/////8BAAAAAAAAAAAAAQAABbYAcwBjAHIAaQBwAHQALQBzAHIAYwAgACcAcwBlAGwAZgAnACAAaAB0AHQAcABzADoALwAvACoALgBtAG8AegBpAGwAbABhAC4AbgBlAHQAIABoAHQAdABwAHMAOgAvAC8AKgAuAG0AbwB6AGkAbABsAGEALgBvAHIAZwAgAGgAdAB0AHAAcwA6AC8ALwAqAC4AbQBvAHoAaQBsAGwAYQAuAGMAbwBtACAAJwB1AG4AcwBhAGYAZQAtAGkAbgBsAGkAbgBlACcAIAAnAHUAbgBzAGEAZgBlAC0AZQB2AGEAbAAnACAAaAB0AHQAcABzADoALwAvAHcAdwB3AC4AZwBvAG8AZwBsAGUAdABhAGcAbQBhAG4AYQBnAGUAcgAuAGMAbwBtACAAaAB0AHQAcABzADoALwAvAHcAdwB3AC4AZwBvAG8AZwBsAGUALQBhAG4AYQBsAHkAdABpAGMAcwAuAGMAbwBtACAAaAB0AHQAcABzADoALwAvAHQAYQBnAG0AYQBuAGEAZwBlAHIALgBnAG8AbwBnAGwAZQAuAGMAbwBtACAAaAB0AHQAcABzADoALwAvAHcAdwB3AC4AeQBvAHUAdAB1AGIAZQAuAGMAbwBtACAAaAB0AHQAcABzADoALwAvAHMALgB5AHQAaQBtAGcALgBjAG8AbQA7ACAAaQBtAGcALQBzAHIAYwAgACcAcwBlAGwAZgAnACAAaAB0AHQAcABzADoALwAvACoALgBtAG8AegBpAGwAbABhAC4AbgBlAHQAIABoAHQAdABwAHMAOgAvAC8AKgAuAG0AbwB6AGkAbABsAGEALgBvAHIAZwAgAGgAdAB0AHAAcwA6AC8ALwAqAC4AbQBvAHoAaQBsAGwAYQAuAGMAbwBtACAAZABhAHQAYQA6ACAAaAB0AHQAcABzADoALwAvAG0AbwB6AGkAbABsAGEALgBvAHIAZwAgAGgAdAB0AHAAcwA6AC8ALwB3AHcAdwAuAGcAbwBvAGcAbABlAHQAYQBnAG0AYQBuAGEAZwBlAHIALgBjAG8AbQAgAGgAdAB0AHAAcwA6AC8ALwB3AHcAdwAuAGcAbwBvAGcAbABlAC0AYQBuAGEAbAB5AHQAaQBjAHMALgBjAG8AbQAgAGgAdAB0AHAAcwA6AC8ALwBhAGQAcwBlAHIAdgBpAGMAZQAuAGcAbwBvAGcAbABlAC4AYwBvAG0AIABoAHQAdABwAHMAOgAvAC8AYQBkAHMAZQByAHYAaQBjAGUALgBnAG8AbwBnAGwAZQAuAGQAZQAgAGgAdAB0AHAAcwA6AC8ALwBhAGQAcwBlAHIAdgBpAGMAZQAuAGcAbwBvAGcAbABlAC4AZABrACAAaAB0AHQAcABzADoALwAvAGMAcgBlAGEAdABpAHYAZQBjAG8AbQBtAG8AbgBzAC4AbwByAGcAIABoAHQAdABwAHMAOgAvAC8AYQBkAC4AZABvAHUAYgBsAGUAYwBsAGkAYwBrAC4AbgBlAHQAOwAgAGQAZQBmAGEAdQBsAHQALQBzAHIAYwAgACcAcwBlAGwAZgAnACAAaAB0AHQAcABzADoALwAvACoALgBtAG8AegBpAGwAbABhAC4AbgBlAHQAIABoAHQAdABwAHMAOgAvAC8AKgAuAG0AbwB6AGkAbABsAGEALgBvAHIAZwAgAGgAdAB0AHAAcwA6AC8ALwAqAC4AbQBvAHoAaQBsAGwAYQAuAGMAbwBtADsAIABmAHIAYQBtAGUALQBzAHIAYwAgAGgAdAB0AHAAcwA6AC8ALwB3AHcAdwAuAGcAbwBvAGcAbABlAHQAYQBnAG0AYQBuAGEAZwBlAHIALgBjAG8AbQAgAGgAdAB0AHAAcwA6AC8ALwB3AHcAdwAuAGcAbwBvAGcAbABlAC0AYQBuAGEAbAB5AHQAaQBjAHMALgBjAG8AbQAgAGgAdAB0AHAAcwA6AC8ALwB3AHcAdwAuAHkAbwB1AHQAdQBiAGUALQBuAG8AYwBvAG8AawBpAGUALgBjAG8AbQAgAGgAdAB0AHAAcwA6AC8ALwB0AHIAYQBjAGsAZQByAHQAZQBzAHQALgBvAHIAZwAgAGgAdAB0AHAAcwA6AC8ALwB3AHcAdwAuAHMAdQByAHYAZQB5AGcAaQB6AG0AbwAuAGMAbwBtACAAaAB0AHQAcABzADoALwAvAGEAYwBjAG8AdQBuAHQAcwAuAGYAaQByAGUAZgBvAHgALgBjAG8AbQAgAGgAdAB0AHAAcwA6AC8ALwBhAGMAYwBvAHUAbgB0AHMALgBmAGkAcgBlAGYAbwB4AC4AYwBvAG0ALgBjAG4AIABoAHQAdABwAHMAOgAvAC8AdwB3AHcALgB5AG8AdQB0AHUAYgBlAC4AYwBvAG0AOwAgAHMAdAB5AGwAZQAtAHMAcgBjACAAJwBzAGUAbABmACcAIABoAHQAdABwAHMAOgAvAC8AKgAuAG0AbwB6AGkAbABsAGEALgBuAGUAdAAgAGgAdAB0AHAAcwA6AC8ALwAqAC4AbQBvAHoAaQBsAGwAYQAuAG8AcgBnACAAaAB0AHQAcABzADoALwAvACoALgBtAG8AegBpAGwAbABhAC4AYwBvAG0AIAAnAHUAbgBzAGEAZgBlAC0AaQBuAGwAaQBuAGUAJwA7ACAAYwBvAG4AbgBlAGMAdAAtAHMAcgBjACAAJwBzAGUAbABmACcAIABoAHQAdABwAHMAOgAvAC8AKgAuAG0AbwB6AGkAbABsAGEALgBuAGUAdAAgAGgAdAB0AHAAcwA6AC8ALwAqAC4AbQBvAHoAaQBsAGwAYQAuAG8AcgBnACAAaAB0AHQAcABzADoALwAvACoALgBtAG8AegBpAGwAbABhAC4AYwBvAG0AIABoAHQAdABwAHMAOgAvAC8AdwB3AHcALgBnAG8AbwBnAGwAZQB0AGEAZwBtAGEAbgBhAGcAZQByAC4AYwBvAG0AIABoAHQAdABwAHMAOgAvAC8AdwB3AHcALgBnAG8AbwBnAGwAZQAtAGEAbgBhAGwAeQB0AGkAYwBzAC4AYwBvAG0AIABoAHQAdABwAHMAOgAvAC8AYQBjAGMAbwB1AG4AdABzAC4AZgBpAHIAZQBmAG8AeAAuAGMAbwBtAC8AIABoAHQAdABwAHMAOgAvAC8AYQBjAGMAbwB1AG4AdABzAC4AZgBpAHIAZQBmAG8AeAAuAGMAbwBtAC4AYwBuAC8AOwAgAGMAaABpAGwAZAAtAHMAcgBjACAAaAB0AHQAcABzADoALwAvAHcAdwB3AC4AZwBvAG8AZwBsAGUAdABhAGcAbQBhAG4AYQBnAGUAcgAuAGMAbwBtACAAaAB0AHQAcABzADoALwAvAHcAdwB3AC4AZwBvAG8AZwBsAGUALQBhAG4AYQBsAHkAdABpAGMAcwAuAGMAbwBtACAAaAB0AHQAcABzADoALwAvAHcAdwB3AC4AeQBvAHUAdAB1AGIAZQAtAG4AbwBjAG8AbwBrAGkAZQAuAGMAbwBtACAAaAB0AHQAcABzADoALwAvAHQAcgBhAGMAawBlAHIAdABlAHMAdAAuAG8AcgBnACAAaAB0AHQAcABzADoALwAvAHcAdwB3AC4AcwB1AHIAdgBlAHkAZwBpAHoAbQBvAC4AYwBvAG0AIABoAHQAdABwAHMAOgAvAC8AYQBjAGMAbwB1AG4AdABzAC4AZgBpAHIAZQBmAG8AeAAuAGMAbwBtACAAaAB0AHQAcABzADoALwAvAGEAYwBjAG8AdQBuAHQAcwAuAGYAaQByAGUAZgBvAHgALgBjAG8AbQAuAGMAbgAgAGgAdAB0AHAAcwA6AC8ALwB3AHcAdwAuAHkAbwB1AHQAdQBiAGUALgBjAG8AbQAA",
      output: {
        URISpec: "https://www.mozilla.org/en-US/firefox/accounts/",
        originAttributes: {
          firstPartyDomain: "",
          inIsolatedMozBrowser: false,
          privateBrowsingId: 0,
          userContextId: 0,
          geckoViewSessionContextId: "",
          partitionKey: "",
        },
        // Within Bug 965637 we removed CSP from Principals. Already serialized Principals however should still deserialize correctly (just without the CSP).
        // "cspJSON": "{\"csp-policies\":[{\"child-src\":[\"https://www.googletagmanager.com\",\"https://www.google-analytics.com\",\"https://www.youtube-nocookie.com\",\"https://trackertest.org\",\"https://www.surveygizmo.com\",\"https://accounts.firefox.com\",\"https://accounts.firefox.com.cn\",\"https://www.youtube.com\"],\"connect-src\":[\"'self'\",\"https://*.mozilla.net\",\"https://*.mozilla.org\",\"https://*.mozilla.com\",\"https://www.googletagmanager.com\",\"https://www.google-analytics.com\",\"https://accounts.firefox.com/\",\"https://accounts.firefox.com.cn/\"],\"default-src\":[\"'self'\",\"https://*.mozilla.net\",\"https://*.mozilla.org\",\"https://*.mozilla.com\"],\"frame-src\":[\"https://www.googletagmanager.com\",\"https://www.google-analytics.com\",\"https://www.youtube-nocookie.com\",\"https://trackertest.org\",\"https://www.surveygizmo.com\",\"https://accounts.firefox.com\",\"https://accounts.firefox.com.cn\",\"https://www.youtube.com\"],\"img-src\":[\"'self'\",\"https://*.mozilla.net\",\"https://*.mozilla.org\",\"https://*.mozilla.com\",\"data:\",\"https://mozilla.org\",\"https://www.googletagmanager.com\",\"https://www.google-analytics.com\",\"https://adservice.google.com\",\"https://adservice.google.de\",\"https://adservice.google.dk\",\"https://creativecommons.org\",\"https://ad.doubleclick.net\"],\"report-only\":false,\"script-src\":[\"'self'\",\"https://*.mozilla.net\",\"https://*.mozilla.org\",\"https://*.mozilla.com\",\"'unsafe-inline'\",\"'unsafe-eval'\",\"https://www.googletagmanager.com\",\"https://www.google-analytics.com\",\"https://tagmanager.google.com\",\"https://www.youtube.com\",\"https://s.ytimg.com\"],\"style-src\":[\"'self'\",\"https://*.mozilla.net\",\"https://*.mozilla.org\",\"https://*.mozilla.com\",\"'unsafe-inline'\"]}]}",
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
