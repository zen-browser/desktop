const VALUE_OPTIONS = new Map([
  ["--file", "file"],
  ["--output", "output"],
  ["--profile-parent", "profileParent"],
  ["--selector", "selector"],
  ["--styles", "styles"],
  ["--wait", "wait"],
  ["--width", "width"],
  ["--height", "height"],
  ["--zen-path", "zenPath"],
]);

const BOOLEAN_OPTIONS = new Map([
  ["--headed", "headed"],
  ["--help", "help"],
]);

export const COMMANDS = new Set([
  "console",
  "doctor",
  "eval",
  "inspect",
  "load",
  "screenshot",
  "test",
]);

function readNumber(name, value, minimum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    throw new Error(`${name} must be a number greater than or equal to ${minimum}`);
  }
  return parsed;
}

export function parseCliArgs(argv) {
  const options = {
    headed: false,
    height: 900,
    help: false,
    prefs: [],
    wait: 500,
    width: 1440,
  };
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith("--")) {
      positionals.push(argument);
      continue;
    }

    if (argument === "--pref") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--pref requires name=value");
      }
      options.prefs.push(value);
      index += 1;
      continue;
    }

    const booleanName = BOOLEAN_OPTIONS.get(argument);
    if (booleanName) {
      options[booleanName] = true;
      continue;
    }

    const valueName = VALUE_OPTIONS.get(argument);
    if (!valueName) {
      throw new Error(`Unknown option: ${argument}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value`);
    }
    options[valueName] = value;
    index += 1;
  }

  if (options.help && positionals.length === 0) {
    return { command: null, options, positionals: [] };
  }

  const [command, ...rest] = positionals;
  if (!command) {
    throw new Error("A command is required");
  }
  if (!COMMANDS.has(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  options.wait = readNumber("--wait", options.wait, 0);
  options.width = readNumber("--width", options.width, 320);
  options.height = readNumber("--height", options.height, 240);

  return { command, options, positionals: rest };
}

export function parsePreferenceOverrides(values) {
  return Object.fromEntries(
    values.map(value => {
      const separator = value.indexOf("=");
      if (separator < 1) {
        throw new Error(`Invalid preference override: ${value}`);
      }

      const name = value.slice(0, separator);
      const rawValue = value.slice(separator + 1);
      if (rawValue === "true" || rawValue === "false") {
        return [name, rawValue === "true"];
      }
      if (rawValue !== "" && Number.isFinite(Number(rawValue))) {
        return [name, Number(rawValue)];
      }
      return [name, rawValue];
    })
  );
}
