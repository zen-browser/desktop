/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { inspectConsent } = ChromeUtils.importESModule(
  "resource:///modules/zen/cookieconsent/ZenCookieConsentEngine.sys.mjs"
);

async function fixture(name) {
  const url = `${getRootDirectory(gTestPath)}fixtures/${name}`;
  const html = await (await fetch(url)).text();
  return new DOMParser().parseFromString(html, "text/html");
}

add_task(async function test_onetrust_fixture_rejects() {
  const doc = await fixture("onetrust.html");
  const decision = inspectConsent(doc);
  Assert.equal(decision.action, "click", "OneTrust is refused");
  Assert.equal(decision.control.id, "onetrust-reject-all-handler");
  Assert.equal(decision.final, true, "the reject click finishes the rule");
});

add_task(async function test_onetrust_opens_settings_then_rejects() {
  const doc = await fixture("onetrust-settings.html");
  let decision = inspectConsent(doc);
  Assert.equal(
    decision.control.id,
    "onetrust-pc-btn-handler",
    "settings open when reject is not on the first screen"
  );
  Assert.ok(!decision.final, "opening settings is not the refusal");
  decision.root.setAttribute("data-zen-cookie-step", String(decision.step));
  const refuse = doc.createElement("button");
  refuse.className = "ot-pc-refuse-all-handler";
  refuse.id = "refuse-all";
  refuse.textContent = "Reject All";
  decision.root.appendChild(refuse);
  decision = inspectConsent(doc);
  Assert.equal(decision.control.id, "refuse-all", "the preference center is refused");
  Assert.equal(decision.final, true, "the second step is the refusal");
});

add_task(async function test_sourcepoint_fixture_rejects_in_frame() {
  const doc = await fixture("sourcepoint.html");
  const decision = inspectConsent(doc, { topFrame: false });
  Assert.equal(decision.action, "click", "Sourcepoint is refused");
  Assert.equal(decision.control.title, "Reject All");
});

add_task(async function test_didomi_fixture_disagrees() {
  const doc = await fixture("didomi.html");
  const decision = inspectConsent(doc);
  Assert.equal(decision.action, "click", "Didomi is refused");
  Assert.equal(decision.control.id, "didomi-notice-disagree-button");
});

add_task(async function test_quantcast_fixture_rejects() {
  const doc = await fixture("quantcast.html");
  const decision = inspectConsent(doc);
  Assert.equal(decision.action, "click", "Quantcast is refused");
  Assert.equal(decision.control.id, "qc-reject");
});

add_task(function test_usercentrics_closed_shadow_is_refused() {
  const doc = new DOMParser().parseFromString(
    "<!DOCTYPE html><html><body><div id='usercentrics-root'></div></body></html>",
    "text/html"
  );
  const host = doc.getElementById("usercentrics-root");
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML =
    "<button data-testid='uc-deny-all-button' type='button'>Deny</button>";
  const decision = inspectConsent(doc);
  Assert.equal(decision.action, "click", "a closed shadow banner is refused");
  Assert.equal(
    decision.control?.getAttribute("data-testid"),
    "uc-deny-all-button"
  );
  Assert.equal(host.shadowRoot, null, "the shadow stays closed to the page");
});
