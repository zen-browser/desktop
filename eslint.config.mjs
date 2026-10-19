/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import sdl from "@microsoft/eslint-plugin-sdl";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import html from "eslint-plugin-html";
import importPlugin from "eslint-plugin-import";
import json from "@eslint/json";
import lit from "eslint-plugin-lit";
import mozilla from "eslint-plugin-mozilla";
import reactHooks from "eslint-plugin-react-hooks";
import zenGlobals from "./src/zen/zen.globals.mjs";

import globals from "globals";
import path from "path";

import globalIgnores from "./engine/eslint-ignores.config.mjs";
import testPathsConfig from "./engine/eslint-test-paths.config.mjs";
import repositoryGlobals from "./engine/eslint-file-globals.config.mjs";
import rollouts from "./engine/eslint-rollouts.config.mjs";
import subdirConfigs from "./engine/eslint-subdirs.config.mjs";
import { globalIgnores as globalIgnoresPath } from "eslint/config";

const testPaths = testPathsConfig.testPaths;

const httpTestingPaths = [
  `**/*mixedcontent*.{${mozilla.allFileExtensions.join(",")}}`,
  `**/*CrossOrigin*.{${mozilla.allFileExtensions.join(",")}}`,
  `**/*crossorigin*.{${mozilla.allFileExtensions.join(",")}}`,
  `**/*cors*.{${mozilla.allFileExtensions.join(",")}}`,
  `**/*downgrade*.{${mozilla.allFileExtensions.join(",")}}`,
  `**/*Downgrade*.{${mozilla.allFileExtensions.join(",")}}`,
];

globals.browser = {
  ...globals.browser,
  ...zenGlobals.reduce((obj, key) => {
    obj[key] = "readonly";
    return obj;
  }, {}),
};

testPaths.browser = testPaths.browser.concat("src/zen/tests/");

/**
 * Takes each path in the paths array, and expands it with the list of extensions
 * that ESLint is watching.
 *
 * @param {object} options
 * @param {string[]} options.paths
 *   The list of paths to wrap.
 * @param {string[]} [options.excludedExtensions]
 *   The list of extensions to be excluded from the wrapping.
 */
function wrapPaths({ paths, excludedExtensions }) {
  let extensions = excludedExtensions
    ? mozilla.allFileExtensions.filter((f) => !excludedExtensions.includes(f))
    : mozilla.allFileExtensions;
  return paths.map((p) => {
    if (p.endsWith("**")) {
      return p + `/*.{${extensions.join(",")}}`;
    }
    if (p.endsWith("/")) {
      return p + `**/*.{${extensions.join(",")}}`;
    }
    if (p.endsWith("*")) {
      return p + `.{${extensions.join(",")}}`;
    }
    return p;
  });
}

/**
 * Wraps the paths listed in the files section of a configuration with the
 * file extensions that ESLint is watching.
 *
 * @param {object} configs
 */
function wrapPathsInConfig(configs) {
  for (let config of configs) {
    // add "engine/" to the paths in the files section.
    config.files = wrapPaths({ paths: config.files.map((p) => "engine/" + p) });
  }
  return configs;
}
let config = [
  {
    name: "import-plugin-settings",
    settings: {
      "import/extensions": [".mjs"],
      "import/resolver": {
        [path.resolve(import.meta.dirname, "engine", "srcdir-resolver.js")]: {},
        node: {},
      },
    },
  },
  {
    name: "ignores",
    ignores: [...globalIgnores, "src/zen/vendor/*"],
  },
  {
    name: "all-files",
    files: wrapPaths({ paths: ["**"] }),
    linterOptions: {
      // With this option on, if an inline comment disables a rule, and the
      // rule is able to be automatically fixed, then ESLint will remove the
      // inline comment and apply the fix. We don't want this because we have
      // some rules that intentionally need to be turned off in specific cases,
      // e.g. @microsoft/sdl/no-insecure-url.
      reportUnusedDisableDirectives: "off",
    },
    plugins: { lit },
    rules: {
      "lit/quoted-expressions": ["error", "never"],
      "lit/no-invalid-html": "error",
      "lit/no-value-attribute": "error",
    },
  },
  {
    name: "source-type-script",
    files: ["**/*.{js,json,html,sjs,xhtml}"],
    languageOptions: {
      sourceType: "script",
    },
  },
  ...mozilla.configs["flat/recommended"],
  {
    name: "json-recommended-with-comments",
    files: ["**/*.json"],
    language: "json/jsonc",
    ...json.configs.recommended,
  },
  {
    name: "json-recommended-no-comments",
    files: ["**/package.json"],
    language: "json/json",
    ...json.configs.recommended,
  },
  {
    name: "json-empty-keys-off-for-image_builder",
    files: ["taskcluster/docker/image_builder/policy.json"],
    rules: {
      "json/no-empty-keys": "off",
    },
  },
  {
    name: "eslint-plugin-html",
    files: ["**/*.html", "**/*.xhtml"],
    plugins: { html },
  },

  {
    name: "define-globals-for-browser-env",
    // Not available for sjs files.
    files: wrapPaths({ paths: ["**"], excludedExtensions: ["sjs"] }),
    ignores: [
      // Also not available for various other scopes and tools.
      "**/*.sys.mjs",
      "**/?(*.)worker.?(m)js",
      "**/?(*.)serviceworker.?(m)js",
      ...wrapPaths({
        paths: testPaths.xpcshell,
        excludedExtensions: ["mjs", "sjs"],
      }),
      "tools/lint/eslint/**",
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Generally we assume that all files, except mjs ones are in our
    // privileged and specific environment. mjs are handled separately by
    // the recommended configuration in eslint-plugin-mozilla.
    name: "define-privileged-and-specific-globals-for-most-files",
    files: wrapPaths({ paths: ["**"], excludedExtensions: ["json"] }),
    ignores: ["browser/components/storybook/**", "tools"],
    languageOptions: {
      globals: {
        ...mozilla.environments.privileged.globals,
        ...mozilla.environments.specific.globals,
      },
    },
  },
  {
    name: "define-globals-for-node-files",
    files: [
      // All .eslintrc.mjs files are in the node environment, so turn that
      // on here.
      "**/.eslintrc*.mjs",
      // .js files in the top-level are generally assumed to be node.
      "\.*.js",
      // *.config.js files are generally assumed to be configuration files
      // based for node.
      "**/*.config.js",
      // The resolver for moz-src for eslint, vscode etc.
      "engine/srcdir-resolver.js",
    ],
    languageOptions: {
      globals: { ...globals.node, ...mozilla.turnOff(globals.browser) },
    },
  },

  {
    name: "browser-no-more-globals",
    files: ["browser/base/content/browser.js"],
    rules: {
      "mozilla/no-more-globals": "error",
    },
  },
  {
    name: "jsx-files",
    files: ["**/*.jsx", "browser/components/storybook/.storybook/**/*.mjs"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    name: "eslint-plugin-import-rules",
    files: ["**/*.mjs"],
    plugins: { import: importPlugin },
    rules: {
      "import/default": "error",
      "import/export": "error",
      "import/named": "error",
      "import/namespace": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      "import/no-absolute-path": "error",
      "import/no-named-default": "error",
      "import/no-named-as-default": "error",
      "import/no-named-as-default-member": "error",
      "import/no-self-import": "error",
      "import/no-unassigned-import": "error",
      "import/no-unresolved": [
        "error",
        // Bug 1773473 - Ignore resolver URLs for chrome and resource as we
        // do not yet have a resolver for them.
        { ignore: ["chrome://", "resource://"] },
      ],
      "import/no-useless-path-segments": "error",
    },
  },
  {
    name: "turn-off-unassigned-import-for-stories",
    // Turn off no-unassigned-import for files that typically test our
    // custom elements, which are imported for the side effects (ie
    // the custom element being registered) rather than any particular
    // export:
    files: ["**/*.stories.mjs"],
    plugins: { import: importPlugin },
    rules: {
      "import/no-unassigned-import": "off",
    },
  },
  {
    ...mozilla.configs["flat/general-test"],
    files: wrapPaths({ paths: ["**/test/**", "**/tests/**"] }),
  },
  {
    ...mozilla.configs["flat/xpcshell-test"],
    files: wrapPaths({
      paths: testPaths.xpcshell,
      excludedExtensions: ["mjs", "sjs"],
    }),
  },
  {
    name: "no-unused-vars-disable-on-headjs",
    // If it is an xpcshell head file, we turn off global unused variable checks, as it
    // would require searching the other test files to know if they are used or not.
    // This would be expensive and slow, and it isn't worth it for head files.
    // We could get developers to declare as exported, but that doesn't seem worth it.
    files: testPaths.xpcshell.map((filePath) => `${filePath}head*.js`),
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          vars: "local",
        },
      ],
    },
  },
  {
    name: "no-unused-vars-for-xpcshell",
    // This section enables errors of no-unused-vars globally for all test*.js
    // files in xpcshell test paths.
    // This is not done in the xpcshell-test configuration as we cannot pull
    // in overrides from there. We should at some stage, aim to enable this
    // for all files in xpcshell-tests.
    files: testPaths.xpcshell.map((filePath) => `${filePath}test*.js`),
    rules: {
      // No declaring variables that are never used
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          vars: "all",
        },
      ],
    },
  },
  {
    ...mozilla.configs["flat/browser-test"],
    files: wrapPaths({
      paths: testPaths.browser,
      excludedExtensions: ["mjs", "sjs"],
    }),
  },
  {
    ...mozilla.configs["flat/mochitest-test"],
    files: wrapPaths({
      paths: testPaths.mochitest,
      excludedExtensions: ["mjs"],
    }),
    ignores: ["security/manager/ssl/tests/mochitest/browser/**"],
  },
  {
    ...mozilla.configs["flat/chrome-test"],
    files: wrapPaths({
      paths: testPaths.chrome,
      excludedExtensions: ["mjs", "sjs"],
    }),
  },
  {
    name: "simpletest",
    languageOptions: {
      globals: {
        ...mozilla.environments.simpletest.globals,
      },
    },
    files: [
      ...testPaths.mochitest.map((filePath) => `${filePath}/**/*.js`),
      ...testPaths.chrome.map((filePath) => `${filePath}/**/*.js`),
    ],
  },
  {
    name: "multiple-test-kinds",
    // Some directories have multiple kinds of tests, and some rules
    // don't work well for HTML-based mochitests, so disable those.
    files: testPaths.xpcshell
      .concat(testPaths.browser)
      .map((filePath) => [`${filePath}/**/*.html`, `${filePath}/**/*.xhtml`])
      .flat(),
    rules: {
      // plain/chrome mochitests don't automatically include Assert, so
      // autofixing `ok()` to Assert.something is bad.
      "mozilla/no-comparison-or-assignment-inside-ok": "off",
    },
  },
  {
    name: "test-file-reuse",
    // Some directories reuse `test_foo.js` files between mochitest-plain and
    // unit tests, or use custom postMessage-based assertion propagation into
    // browser tests. Ignore those too:
    files: wrapPaths({
      paths: [
        // Reuses xpcshell unit test scripts in mochitest-plain HTML files.
        "dom/indexedDB/test/**",
        // Dispatches functions to the webpage in ways that are hard to detect.
        "toolkit/components/antitracking/test/**",
      ],
    }),
    rules: {
      "mozilla/no-comparison-or-assignment-inside-ok": "off",
    },
  },
  {
    // Rules of Hooks broadly checks for camelCase "use" identifiers, so
    // enable only for paths actually using React to avoid false positives.
    name: "react-hooks",
    files: [
      "browser/components/aboutwelcome/**",
      "browser/components/asrouter/**",
      "browser/extensions/newtab/**",
      "devtools/**",
    ],
    ...reactHooks.configs["recommended-latest"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      // react-hooks/recommended has exhaustive-deps as a warning, we prefer
      // errors, so that raised issues get addressed one way or the other.
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    name: "disable-no-insecure-url-for-http-testing",
    // Exempt files with these paths since they have to use http for full coverage
    files: httpTestingPaths,
    plugins: { "@microsoft/sdl": sdl },
    rules: {
      "@microsoft/sdl/no-insecure-url": "off",
    },
  },
  {
    name: "mozilla/valid-jsdoc",
    files: wrapPaths({ paths: ["**"] }),
    ...mozilla.configs["flat/valid-jsdoc"],
  },
  {
    name: "rollout-no-browser-refs-in-toolkit",
    files: ["toolkit/**"],
    ignores: ["toolkit/**/test/**", "toolkit/**/tests/**"],
    plugins: { mozilla },
    rules: {
      "mozilla/no-browser-refs-in-toolkit": "error",
    },
  },
  {
    name: "no-newtab-refs-outside-newtab",
    files: ["**/*.mjs", "**/*.js", "**/*.sys.mjs"],
    ignores: [
      "tools/@types/generated/**",
      "tools/lint/eslint/eslint-plugin-mozilla/lib/rules/no-newtab-refs-outside-newtab.mjs",
      "tools/lint/eslint/eslint-plugin-mozilla/tests/no-newtab-refs-outside-newtab.mjs",
    ],
    plugins: { mozilla },
    rules: {
      "mozilla/no-newtab-refs-outside-newtab": "error",
    },
  },
  ...wrapPathsInConfig(subdirConfigs),
  ...wrapPathsInConfig(repositoryGlobals),

  /**
   * The items below should always be the last items in this order:
   *
   * - Enable eslint-config-prettier.
   * - Enable curly.
   * - Rollouts
   */

  // Turn off rules that conflict with Prettier.
  { name: "eslint-config-prettier", ...eslintConfigPrettier },
  {
    name: "enable-curly",
    files: wrapPaths({ paths: ["**/"] }),
    rules: {
      // Require braces around blocks that start a new line. This must be
      // configured after eslint-config-prettier is included, as otherwise
      // eslint-config-prettier disables the curly rule. Hence, we do
      // not include it in
      // `tools/lint/eslint/eslint-plugin-mozilla/lib/configs/recommended.js`.
      curly: ["error", "all"],
    },
  },
  ...wrapPathsInConfig(rollouts),
  globalIgnoresPath(["src/zen/tests/"]),
];

// The various places we get our globals from use true/false rather than
// the strings required by ESLint, so translate those here.
config.map((entry) => {
  if (entry.languageOptions?.globals) {
    let newGlobals = {};
    for (let [key, value] of Object.entries(entry.languageOptions.globals)) {
      if (typeof entry.languageOptions.globals[key] == "boolean") {
        newGlobals[key] = value ? "writable" : "readonly";
      } else {
        newGlobals[key] = value;
      }
    }
  }
  return entry;
});

export default config;
