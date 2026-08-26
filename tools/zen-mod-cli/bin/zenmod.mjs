#!/usr/bin/env node

process.env.NODE_ENV ??= "production";

const { main } = await import("../src/cli.mjs");
process.exitCode = await main();
