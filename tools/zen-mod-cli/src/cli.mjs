import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCliArgs, parsePreferenceOverrides } from "./args.mjs";
import { readMod } from "./mod.mjs";
import {
  DEFAULT_PROFILE_PARENT,
  DEFAULT_ZEN_PATH,
  ZenModSession,
} from "./session.mjs";

const DEFAULT_STYLES = [
  "background-color",
  "color",
  "display",
  "height",
  "opacity",
  "visibility",
  "width",
];

const HELP = `Usage:
  zenmod doctor [options]
  zenmod load <mod-directory> [options]
  zenmod inspect <mod-directory> --selector <css> [--styles a,b] [options]
  zenmod eval <mod-directory> --file <function.js> [options]
  zenmod test <mod-directory> --file <function.js> [options]
  zenmod console <mod-directory> [options]
  zenmod screenshot <mod-directory> --output <image.png> [options]

Options:
  --headed                    Show the isolated Zen window
  --height <pixels>           Browser height (default: 900)
  --pref <name=value>         Override a Zen preference; repeatable
  --profile-parent <path>     Isolated profile parent (default: ~/.zenmod)
  --wait <milliseconds>       Wait after mod injection (default: 500)
  --width <pixels>            Browser width (default: 1440)
  --zen-path <path>           Zen executable
  --help                      Show this help

JavaScript files passed to eval and test must contain a function expression.
The function executes in chrome://browser/content/browser.xhtml and may be async.`;

let activeSession = null;

function print(value, stream = process.stdout) {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

function commandModPath(positionals) {
  if (positionals.length !== 1) {
    throw new Error("This command requires exactly one mod directory");
  }
  return positionals[0];
}

function testPassed(result) {
  if (typeof result === "boolean") {
    return result;
  }
  if (!result || typeof result !== "object") {
    throw new Error(
      "A test function must return a boolean or an object containing pass/assertions"
    );
  }
  if (typeof result.pass === "boolean") {
    return result.pass;
  }
  if (Array.isArray(result.assertions)) {
    return result.assertions.every(assertion => assertion?.pass === true);
  }
  throw new Error(
    "A test result object must contain pass or an assertions array"
  );
}

async function readFunction(filePath) {
  if (!filePath) {
    throw new Error("--file is required");
  }
  const source = (await readFile(path.resolve(filePath), "utf8")).trim();
  if (!source) {
    throw new Error(`Function file is empty: ${filePath}`);
  }
  return source;
}

async function runDoctor(options) {
  const zenPath = path.resolve(
    options.zenPath ?? process.env.ZEN_PATH ?? DEFAULT_ZEN_PATH
  );
  const profileParent = path.resolve(
    options.profileParent ??
      process.env.ZENMOD_PROFILE_PARENT ??
      DEFAULT_PROFILE_PARENT
  );
  const checks = {
    node: {
      ok: Number(process.versions.node.split(".")[0]) >= 20,
      version: process.versions.node,
    },
    profile: {
      ok: true,
      parent: profileParent,
      resolved: path.join(profileParent, "zen_devtools_mcp_profile"),
    },
    zen: {
      ok: existsSync(zenPath),
      path: zenPath,
    },
  };
  print({
    checks,
    ok: Object.values(checks).every(check => check.ok),
  });
  return Object.values(checks).every(check => check.ok) ? 0 : 1;
}

async function withLoadedMod(parsed, operation) {
  const mod = await readMod(commandModPath(parsed.positionals));
  const session = new ZenModSession({
    headless: !parsed.options.headed,
    height: parsed.options.height,
    prefs: parsePreferenceOverrides(parsed.options.prefs),
    profileParent: parsed.options.profileParent,
    width: parsed.options.width,
    zenPath: parsed.options.zenPath,
  });
  activeSession = session;

  try {
    await session.start();
    const loaded = await session.loadMod(mod);
    if (parsed.options.wait > 0) {
      await new Promise(resolve => setTimeout(resolve, parsed.options.wait));
    }
    return await operation({ loaded, mod, session });
  } finally {
    await session.close();
    activeSession = null;
  }
}

async function runBrowserCommand(parsed) {
  return withLoadedMod(parsed, async ({ loaded, session }) => {
    switch (parsed.command) {
      case "load":
        print({ loaded, ok: true });
        return 0;
      case "inspect": {
        if (!parsed.options.selector) {
          throw new Error("--selector is required");
        }
        const styleNames = parsed.options.styles
          ? parsed.options.styles.split(",").map(name => name.trim())
          : DEFAULT_STYLES;
        const elements = await session.inspect(
          parsed.options.selector,
          styleNames.filter(Boolean)
        );
        print({
          count: elements.length,
          elements,
          loaded,
          ok: true,
          selector: parsed.options.selector,
        });
        return 0;
      }
      case "eval": {
        const result = await session.evaluateFunction(
          await readFunction(parsed.options.file)
        );
        print({ loaded, ok: true, result });
        return 0;
      }
      case "test": {
        const result = await session.evaluateFunction(
          await readFunction(parsed.options.file)
        );
        const passed = testPassed(result);
        print({ loaded, ok: passed, result });
        return passed ? 0 : 1;
      }
      case "console": {
        const messages = await session.consoleMessages();
        print({ loaded, messages, ok: true });
        return 0;
      }
      case "screenshot": {
        if (!parsed.options.output) {
          throw new Error("--output is required");
        }
        const output = path.resolve(parsed.options.output);
        await mkdir(path.dirname(output), { recursive: true });
        const image = Buffer.from(await session.screenshot(), "base64");
        await writeFile(output, image);
        print({ bytes: image.length, loaded, ok: true, output });
        return 0;
      }
      default:
        throw new Error(`Unsupported browser command: ${parsed.command}`);
    }
  });
}

async function cleanupAndExit(signal) {
  await activeSession?.close();
  print({ error: `Interrupted by ${signal}`, ok: false }, process.stderr);
  process.exit(130);
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const parsed = parseCliArgs(argv);
    if (parsed.options.help || !parsed.command) {
      process.stdout.write(`${HELP}\n`);
      return 0;
    }
    if (parsed.command === "doctor") {
      return runDoctor(parsed.options);
    }
    return runBrowserCommand(parsed);
  } catch (error) {
    print(
      {
        error: error instanceof Error ? error.message : String(error),
        ok: false,
      },
      process.stderr
    );
    return 1;
  }
}

process.once("SIGINT", () => void cleanupAndExit("SIGINT"));
process.once("SIGTERM", () => void cleanupAndExit("SIGTERM"));
