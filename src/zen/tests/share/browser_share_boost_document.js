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

add_task(async function test_shared_css_cannot_load_resources() {
  const blocked = [
    "a { background: url(https://evil.example/t.png) }",
    'a { background: u\\72l("resource://gre/x.svg") }',
    "a { background: \\75 rl(https://evil.example/t.png) }",
    "a { background: U\\52 L(https://evil.example/t.png) }",
    'a { background: im\\61ge-set("https://evil.example/t.png" 1x) }',
    'a { background: -webkit-image-set("https://evil.example/t.png" 1x) }',
    '@\\69mport "https://evil.example/x.css";',
    'a { content: "\n; background: url(https://evil.example/t.png); x: " }',
    "a { background: 1e+url(https://evil.example/t.png) }",
    "@font-face { font-family: x; src: url(https://evil.example/f.woff) }",
  ];
  for (const css of [
    ...blocked,
    'a { background: u@import "x";rl(https://evil.example/t.png) }',
    '@im@import "x";port "https://evil.example/x.css";',
  ]) {
    const sanitized = gZenBoostsManager.sanitizeSharedCSS(css);
    Assert.ok(
      !/\\|@import|\b(?:url|src|image-set|image)\s*\(/i.test(sanitized),
      `the load is removed from ${JSON.stringify(css)}`
    );
  }

  const kept = [
    "body { color: red; }",
    'a { content: "@imported"; color: var(--url); }',
    "a { margin: calc(1px + 2px) }",
  ];
  for (const css of kept) {
    Assert.equal(
      gZenBoostsManager.sanitizeSharedCSS(css),
      css,
      `${JSON.stringify(css)} is left alone`
    );
  }
});

add_task(async function test_shared_selectors_cannot_add_rules() {
  const data = gZenBoostsManager.boostDataFromShared({
    zapSelectors: [
      ".ad",
      "div:not(.a, .b) > [data-x='y']",
      "a {} b { background: url(https://evil.example/t.png) } c",
      "a }",
      " ",
    ],
    focusSelectors: ["main", "x) { color: red } :is(y"],
  });
  Assert.deepEqual(
    data.zapSelectors,
    [".ad", "div:not(.a, .b) > [data-x='y']"],
    "zap selectors that are more than a selector are dropped"
  );
  Assert.deepEqual(
    data.focusSelectors,
    ["main"],
    "focus selectors that are more than a selector are dropped"
  );
});

add_task(async function test_shared_slider_strings_are_numbers() {
  const data = gZenBoostsManager.boostDataFromShared({
    contrast: "0.9",
    brightness: "nope",
    saturation: "",
  });
  const defaults = gZenBoostsManager.getEmptyBoostEntry().boostData;
  Assert.strictEqual(data.contrast, 0.9, "numeric strings become numbers");
  Assert.strictEqual(
    data.brightness,
    defaults.brightness,
    "other strings keep the default"
  );
  Assert.strictEqual(
    data.saturation,
    defaults.saturation,
    "empty strings keep the default"
  );
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
