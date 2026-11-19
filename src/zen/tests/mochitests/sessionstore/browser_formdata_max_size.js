/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const URL =
  "http://mochi.test:8888/browser/browser/components/" +
  "sessionstore/test/browser_formdata_sample.html";

const SHORT_VALUE = "abc";
const LONG_VALUE = "abcdef";

add_task(async function test_form_limit() {
  await SpecialPowers.pushPrefEnv({
    set: [
      // "browser.sessionstore.dom_form_limit" limits the length of values in
      // forms to 5. Here we have that SHORT_VALUE is less than 5 and
      // LONG_VALUE is greater than 5.
      ["browser.sessionstore.dom_form_limit", 5],
      ["browser.sessionstore.debug.no_auto_updates", true],
    ],
  });

  await BrowserTestUtils.withNewTab({ gBrowser, url: URL }, async browser => {
    await setPropertyOfFormField(browser, "#txt", "value", SHORT_VALUE);
    await TabStateFlusher.flush(browser);

    let tab = gBrowser.getTabForBrowser(browser);
    let state = JSON.parse(ss.getTabState(tab));
    is(
      state.formdata.id.txt,
      SHORT_VALUE,
      "values shorter than browser.sessionstore.dom_form_limit is ok."
    );

    await setPropertyOfFormField(browser, "#txt", "value", LONG_VALUE);
    await TabStateFlusher.flush(browser);

    state = JSON.parse(ss.getTabState(tab));
    ok(
      !state?.formdata?.id?.txt,
      "values shorter than browser.sessionstore.dom_form_limit isn't ok."
    );
  });

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_form_max_limit() {
  await SpecialPowers.pushPrefEnv({
    set: [
      // "browser.sessionstore.dom_form_max_limit" limits the total length
      // of values AND length id/xpath collected from a form. Here we have
      // that SHORT_VALUE + 'txt' is less than 7 and LONG_VALUE + 'txt' is
      // greater than 7.
      ["browser.sessionstore.dom_form_max_limit", 7],
      ["browser.sessionstore.debug.no_auto_updates", true],
    ],
  });

  await BrowserTestUtils.withNewTab({ gBrowser, url: URL }, async browser => {
    await setPropertyOfFormField(browser, "#txt", "value", SHORT_VALUE);
    await TabStateFlusher.flush(browser);

    let tab = gBrowser.getTabForBrowser(browser);
    let state = JSON.parse(ss.getTabState(tab));
    is(
      state.formdata.id.txt,
      SHORT_VALUE,
      "total length shorter than browser.sessionstore.dom_form_max_limit is ok."
    );

    await setPropertyOfFormField(browser, "#txt", "value", LONG_VALUE);
    await TabStateFlusher.flush(browser);

    state = JSON.parse(ss.getTabState(tab));
    is(
      state.formdata.id.txt,
      SHORT_VALUE,
      "total length shorter than browser.sessionstore.dom_form_max_limit isn't ok."
    );
  });

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_form_max_limit_many_fields() {
  await SpecialPowers.pushPrefEnv({
    set: [
      // "browser.sessionstore.dom_form_max_limit" limits the total length
      // of values AND length id/xpath collected from a form. Here we have
      // that SHORT_VALUE * 2 + 'text' + 'txt' is less than 15 and LONG_VALUE
      // + SHORT_VALUE + 'text' + 'txt' is greater than 15.
      ["browser.sessionstore.dom_form_max_limit", 15],
      ["browser.sessionstore.debug.no_auto_updates", true],
    ],
  });

  await BrowserTestUtils.withNewTab({ gBrowser, url: URL }, async browser => {
    await SpecialPowers.spawn(browser, [], () => {
      let element = content.document.createElement("input");
      element.id = "text";
      element.type = "text";
      content.document.body.appendChild(element);
    });

    await setPropertyOfFormField(browser, "#txt", "value", SHORT_VALUE);
    await setPropertyOfFormField(browser, "#text", "value", SHORT_VALUE);
    await TabStateFlusher.flush(browser);

    let tab = gBrowser.getTabForBrowser(browser);
    let state = JSON.parse(ss.getTabState(tab));
    is(
      state.formdata.id.txt,
      SHORT_VALUE,
      "total length shorter than browser.sessionstore.dom_form_max_limit is ok."
    );

    await setPropertyOfFormField(browser, "#txt", "value", LONG_VALUE);
    await TabStateFlusher.flush(browser);

    state = JSON.parse(ss.getTabState(tab));
    is(
      state.formdata.id.txt,
      SHORT_VALUE,
      "total length shorter than browser.sessionstore.dom_form_max_limit isn't ok."
    );
  });

  await SpecialPowers.popPrefEnv();
});
