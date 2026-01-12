/**
 * @file Remove macros from SpiderMonkey's self-hosted JS.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const path = require("path");
const fs = require("fs");

const selfHostedRegex = /js\/src\/builtin\/.*?\.js$/;
const macroRegex =
  /\s*\#(if|ifdef|else|elif|endif|include|define|undef|error).*/;

function isSelfHostedFile(filename) {
  if (path.win32) {
    filename = filename.split(path.sep).join("/");
  }
  return selfHostedRegex.test(filename);
}

function tryReadFile(filePath) {
  if (!path.isAbsolute(filePath)) {
    return "";
  }
  if (!fs.existsSync(filePath)) {
    // Safely handle the case when the file wasn't found, because throwing
    // errors can lead to confusing result when used with ESLint.
    return "";
  }
  return fs.readFileSync(filePath, "utf-8");
}

// Adjust the range of fixes to match the original source code.
function createFix(lines, message) {
  let { line, column, fix } = message;

  // Line and column are 1-based. Make sure we got a valid input.
  if (line <= 0 || column <= 0) {
    return null;
  }

  // Reject to create a fix when the line is out of range for some reason.
  if (line > lines.length) {
    return null;
  }

  // Find the absolute start position of the line in the original file.
  let startOfLine = 0;
  for (let i = 0; i < line - 1; ++i) {
    // Add the length of the line, including its line separator.
    startOfLine += lines[i].length + "\n".length;
  }

  // Add the 1-based column to the start of line to get the start position.
  let start = startOfLine + (column - 1);

  // Add the fix range to get the end position.
  let end = start + (fix.range[1] - fix.range[0]);

  // And finally return the new fix object.
  return { text: fix.text, range: [start, end] };
}

module.exports = {
  preprocess(text, filename) {
    if (!isSelfHostedFile(filename)) {
      return [text];
    }

    let lines = text.split(/\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!macroRegex.test(lines[i])) {
        // No macro here, nothing to do.
        continue;
      }

      for (; i < lines.length; i++) {
        // The macro isn't correctly indented, so we need to instruct
        // prettier to ignore them.
        lines[i] = "// prettier-ignore -- " + lines[i];

        // If the line ends with a backslash (\), the next line
        // is also part of part of the macro.
        if (!lines[i].endsWith("\\")) {
          break;
        }
      }
    }

    return [lines.join("\n")];
  },

  postprocess(messages, filename) {
    // Don't attempt to create fixes for any non-selfhosted files.
    if (!isSelfHostedFile(filename)) {
      return [].concat(...messages);
    }

    let lines = null;

    let result = [];
    for (let message of messages.flat()) {
      if (message.fix) {
        if (lines === null) {
          lines = tryReadFile(filename).split(/\n/);
        }

        let fix = createFix(lines, message);
        if (fix) {
          message.fix = fix;
        } else {
          // We couldn't create a fix, so we better remove the passed in fix,
          // because its range points to the preprocessor output, but the post-
          // processor must translate it into a range of the original source.
          delete message.fix;
        }
      }

      result.push(message);
    }
    return result;
  },

  supportsAutofix: true,
};
