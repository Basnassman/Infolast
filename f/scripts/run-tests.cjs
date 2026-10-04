#!/usr/bin/env node
/**
 * Minimal CommonJS test runner for the Telegram Verification Module.
 *
 * Uses Node's built-in `node:test` (via ts-node) — no additional framework
 * dependency. Seeds only the Telegram Verification test suite.
 *
 * The CHILD process is started with, in order:
 *   -r scripts/test-preload.cjs    → fakes Redis + Telegram client (no network)
 *   -r ts-node/register            → transpile TypeScript on the fly
 *   -r tsconfig-paths/register     → resolve @core/*, @modules/*, ... aliases
 *   --test                         → Node's built-in test runner
 */

const { spawnSync } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const testFiles = [
  "src/modules/verification/__tests__/verification.token.service.test.ts",
  "src/modules/verification/__tests__/account-linking.service.test.ts",
  "src/modules/verification/__tests__/verification.provider.test.ts",
  "src/modules/verification/__tests__/verification.service.test.ts",
  "src/modules/verification/__tests__/eligibility.service.test.ts",
  "src/modules/verification/__tests__/reverification.service.test.ts",
].map((f) => path.resolve(projectRoot, f));

console.log(`[TestRunner] Running ${testFiles.length} verification test file(s)...\n`);

const result = spawnSync(process.execPath, [
  "-r", path.resolve(projectRoot, "scripts", "test-preload.cjs"),
  "-r", "ts-node/register",
  "-r", "tsconfig-paths/register",
  "--test",
  ...testFiles,
], {
  stdio: "inherit",
  env: process.env,
  cwd: projectRoot,
});

process.exit(result.status === null ? 1 : result.status);
