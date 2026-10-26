/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_boost_document_validates() {
  Assert.ok(
    (await ZenShareClient.validateDocument(BOOST_DOC)).valid,
    "a boost share passes the schema"
  );

  const extra = structuredClone(BOOST_DOC);
  extra.shared.extra = 1;
  Assert.ok(
    !(await ZenShareClient.validateDocument(extra)).valid,
    "unknown fields on a boost are rejected"
  );

  const noDomain = structuredClone(BOOST_DOC);
  delete noDomain.shared.domain;
  Assert.ok(
    !(await ZenShareClient.validateDocument(noDomain)).valid,
    "a boost without a domain is rejected"
  );
});

add_task(async function test_shared_domain_validation() {
  for (const domain of ["example.com", "sub.example.co.uk", "EXAMPLE.com"]) {
    Assert.ok(
      gZenBoostsManager.isValidSharedDomain(domain),
      `${domain} is a bare host`
    );
  }
  for (const domain of [
    "trusted.example@attacker.example",
    "example.com:8080",
    "example.com/path",
    "https://example.com",
    "",
    42,
    undefined,
  ]) {
    Assert.ok(
      !gZenBoostsManager.isValidSharedDomain(domain),
      `${String(domain)} is not a bare host`
    );
  }
});

add_task(async function test_shared_boost_data_is_sanitized() {
  const data = gZenBoostsManager.boostDataFromShared(
    BOOST_DOC.shared.boostData,
    BOOST_DOC.shared.name
  );

  Assert.equal(data.boostName, "Shared Boost", "the share's name wins");
  Assert.ok(data.changeWasMade, "the imported boost counts as edited");
  Assert.ok(!/@import/i.test(data.customCSS), "imports are stripped");
  Assert.ok(!/url\s*\(/i.test(data.customCSS), "url() values are stripped");
  Assert.ok(
    data.customCSS.includes("color: red"),
    "harmless declarations survive"
  );
  Assert.equal(data.fontFamily, "", "a font family with CSS in it is dropped");
  Assert.equal(data.textCaseOverride, "none", "unknown text cases reset");
  Assert.deepEqual(data.zapSelectors, [".ad"], "only string selectors stay");
  Assert.equal(data.dotPos.x, 0.2, "matching nested numbers are taken");
  Assert.equal(data.dotPos.y, 0.66, "mistyped nested values keep the default");
  Assert.ok(!("extra" in data.dotPos), "unknown nested fields are dropped");
  Assert.equal(data.sizeOverride, 1, "non-numeric numbers keep the default");
  Assert.equal(data.smartInvert, true, "booleans are taken");
});
