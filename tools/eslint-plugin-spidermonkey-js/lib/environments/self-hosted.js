/**
 * @file Add environment defaults to SpiderMonkey's self-hosted JS.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const path = require("path");
const fs = require("fs");

let gRootDir = null;

/**
 * Gets the root directory of the repository by walking up directories from
 * this file until the top-level mozilla-central package.json file is found.
 * If this fails, the same procedure will be attempted from the current
 * working dir.
 * Copied from `tools/lint/eslint/eslint-plugin-mozilla/lib/helpers.js`.
 *
 * @returns {string} The absolute path of the repository directory
 */
function getRootDir() {
  if (!gRootDir) {
    function searchUpForPackage(dirName) {
      let parsed = path.parse(dirName);
      while (parsed.root !== dirName) {
        let possibleFile = path.join(dirName, "package.json");
        if (fs.existsSync(possibleFile)) {
          let packageData = require(possibleFile);
          if (packageData.name == "mozilla-central") {
            return dirName;
          }
        }
        // Move up a level
        dirName = parsed.dir;
        parsed = path.parse(dirName);
      }
      return null;
    }
    let possibleRoot = searchUpForPackage(path.dirname(module.filename));
    if (!possibleRoot) {
      possibleRoot = searchUpForPackage(path.resolve());
    }
    if (!possibleRoot) {
      // We've couldn't find a root from the module or CWD, so lets just go
      // for the CWD. We really don't want to throw if possible, as that
      // tends to give confusing results when used with ESLint.
      possibleRoot = process.cwd();
    }

    gRootDir = possibleRoot;
  }

  return gRootDir;
}

function tryReadFile(filePath) {
  let absPath = path.join(getRootDir(), filePath);
  if (!fs.existsSync(absPath)) {
    // Safely handle the case when the file wasn't found, because throwing
    // errors can lead to confusing result when used with ESLint.
    return "";
  }
  return fs.readFileSync(absPath, "utf-8");
}

// Search for top-level declarations, #defines, and #includes.
function addGlobalsFrom(dirName, fileName, globals) {
  let filePath = path.join(dirName, fileName);

  // Definitions are separated by line.
  let lines = tryReadFile(filePath).split("\n");

  // We don't have to fully parse the source code, because it's formatted
  // through "prettier", which means we know the exact code structure.
  //
  // |class| is disallowed in self-hosted code, so we don't have to handle it.
  for (let line of lines) {
    if (
      line.startsWith("function") ||
      line.startsWith("function*") ||
      line.startsWith("async function") ||
      line.startsWith("async function*")
    ) {
      let m = line.match(/^(?:async )?function(?:\*)?\s+([\w\$]+)\s*\(/);
      if (m) {
        globals[m[1]] = "readonly";
      }
    } else if (
      line.startsWith("var") ||
      line.startsWith("let") ||
      line.startsWith("const")
    ) {
      let m = line.match(/^(?:var|let|const)\s+([\w\$]+)\s*[;=]/);
      if (m) {
        globals[m[1]] = "readonly";
      }
    } else if (line.startsWith("#define")) {
      let m = line.match(/^#define (\w+)/);
      if (m) {
        globals[m[1]] = "readonly";
      }
    } else if (line.startsWith("#include")) {
      let m = line.match(/^#include \"([\w\.]+)\"$/);
      if (m) {
        // Also process definitions from includes.
        addGlobalsFrom(dirName, m[1], globals);
      }
    }
  }
}

function selfHostingDefines(dirName = "js/src/builtin/") {
  let absDir = path.join(getRootDir(), dirName);
  if (!fs.existsSync(absDir)) {
    // See |tryReadFile| for why we avoid to throw any errors.
    return {};
  }

  // Search sub-directories and js-files within |dirName|.
  let dirs = [];
  let jsFiles = [];
  for (let name of fs.readdirSync(absDir)) {
    let stat = fs.statSync(path.join(absDir, name));
    if (stat.isDirectory()) {
      dirs.push(name);
    } else if (stat.isFile() && name.endsWith(".js")) {
      jsFiles.push(name);
    }
  }

  let globals = Object.create(null);

  // Process each js-file.
  for (let jsFile of jsFiles) {
    addGlobalsFrom(dirName, jsFile, globals);
  }

  // Recursively traverse all sub-directories.
  for (let dir of dirs) {
    globals = { ...globals, ...selfHostingDefines(path.join(dirName, dir)) };
  }

  return globals;
}

function selfHostingFunctions() {
  // Definitions can be spread across multiple lines and may have extra
  // whitespace, so we simply remove all whitespace and match over the complete
  // file.
  let content = tryReadFile("js/src/vm/SelfHosting.cpp").replace(/\s+/g, "");

  let globals = Object.create(null);
  let re = /(?:JS_FN|JS_INLINABLE_FN|JS_TRAMPOLINE_FN)\("(\w+)"/g;
  for (let m of content.matchAll(re)) {
    globals[m[1]] = "readonly";
  }
  return globals;
}

function errorNumbers() {
  // Definitions are separated by line.
  let lines = tryReadFile("js/public/friend/ErrorNumbers.msg").split("\n");

  let globals = Object.create(null);
  for (let line of lines) {
    let m = line.match(/^MSG_DEF\((\w+),/);
    if (m) {
      globals[m[1]] = "readonly";
    }
  }
  return globals;
}

const globals = {
  ...selfHostingDefines(),
  ...selfHostingFunctions(),
  ...errorNumbers(),
};

module.exports = {
  globals,
};
