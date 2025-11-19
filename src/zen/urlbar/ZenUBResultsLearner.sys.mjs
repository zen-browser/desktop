/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from 'resource://gre/modules/XPCOMUtils.sys.mjs';

const lazy = {};

const DEFAULT_DB_DATA = '{}';
const DEPRIORITIZE_MAX = -5;
const PRIORITIZE_MAX = 5;

function addDataToLazy(data) {
  try {
    lazy.databaseData = JSON.parse(data);
  } catch {
    lazy.databaseData = {};
  }
}

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  'rawDatabase',
  'zen.urlbar.suggestions-learner',
  DEFAULT_DB_DATA,
  (_aPreference, _previousValue, newValue) => {
    addDataToLazy(newValue);
  }
);

/**
 * A class that manages the learning of URL bar results for commands,
 * can be used for any ID that can be executed in the URL bar.
 *
 * The schema would be something like:
 * {
 *   "<command id>": <priority number>,
 * }
 *
 * If the current command is not on the list is because the user
 * has *seen* the command but never executed it. If the number is
 * less than -2, that means the user will most likely never use it.
 *
 * The priority number is incremented each time the command is executed.
 */
class ZenUrlbarResultsLearner {
  constructor() {
    addDataToLazy(lazy.rawDatabase);
  }

  get database() {
    return lazy.databaseData;
  }

  saveDatabase(db) {
    Services.prefs.setStringPref(
      'zen.urlbar.suggestions-learner',
      JSON.stringify(db || DEFAULT_DB_DATA)
    );
  }

  recordExecution(commandId, seenCommands = []) {
    const db = this.database;
    if (commandId) {
      const numberOfUsages = Math.min((db[commandId] || 0) + 1, PRIORITIZE_MAX);
      db[commandId] = numberOfUsages;
    }
    for (const cmd of seenCommands) {
      if (cmd !== commandId) {
        if (!db[cmd]) {
          db[cmd] = -1;
        } else {
          const newIndex = Math.max(db[cmd] - 1, DEPRIORITIZE_MAX);
          db[cmd] = newIndex;
          if (newIndex === 0) {
            // Save some space by deleting commands that are not used
            // and have a neutral score.
            delete db[cmd];
          }
        }
      }
    }
    this.saveDatabase(db);
  }

  shouldPrioritize(commandId) {
    if (!commandId) {
      return false;
    }
    const db = this.database;
    return !!db[commandId] && db[commandId] > 0;
  }

  getDeprioritizeIndex(commandId) {
    if (!commandId) {
      return 1;
    }
    const db = this.database;
    if (db[commandId] < 0) {
      return Math.abs(db[commandId]);
    }
    // This will most likely never run, since
    // positive commands are prioritized.
    return 1;
  }

  /**
   * Sorts the given commands by their priority in the database.
   * @param {*} commands
   */
  sortCommandsByPriority(commands) {
    const db = this.database;
    return commands.sort((a, b) => (db[b.commandId] || 0) - (db[a.commandId] || 0));
  }
}

export const zenUrlbarResultsLearner = new ZenUrlbarResultsLearner();
