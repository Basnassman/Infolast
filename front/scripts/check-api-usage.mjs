#!/usr/bin/env node
/**
 * =============================================================
 * API USAGE GUARD
 * =============================================================
 *
 * Fails the build if a page/helper hardcodes the backend host or the
 * `/api/v1` prefix. That is exactly what produced:
 *
 *   GET https://infolast-l5j6.onrender.com/api/v1/api/v1/vesting/status/0x…  → 404
 *
 * All backend URLs must go through `src/config/api.ts`.
 *
 * Run manually: npm run verify:api
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const srcDir = join(projectRoot, "src");

/** The only file allowed to know the prefix/host. */
const ALLOWED = new Set(["src/config/api.ts"]);

const RULES = [
  {
    pattern: /["'`][^"'`]*\/api\/v1/,
    message:
      "hardcoded /api/v1 prefix — use apiUrl() / API_BASE_URL from @/config/api",
  },
  {
    pattern: /infolast(-l5j6)?\.onrender\.com/,
    message:
      "hardcoded backend host — use NEXT_PUBLIC_API_URL via @/config/api",
  },
];

const walk = (dir) => {
  const files = [];

  for (const entry of readdirSync(dir)) {
    const absolute = join(dir, entry);
    const stats = statSync(absolute);

    if (stats.isDirectory()) {
      files.push(...walk(absolute));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      files.push(absolute);
    }
  }

  return files;
};

const violations = [];

for (const file of walk(srcDir)) {
  const relativePath = relative(projectRoot, file).split(sep).join("/");

  if (ALLOWED.has(relativePath)) continue;

  const content = readFileSync(file, "utf8");

  content.split("\n").forEach((line, index) => {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        violations.push({
          file: relativePath,
          line: index + 1,
          message: rule.message,
          source: line.trim(),
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error("[api-guard] Forbidden API URL construction found:\n");

  for (const violation of violations) {
    console.error(
      `  ${violation.file}:${violation.line} — ${violation.message}\n    ${violation.source}`
    );
  }

  console.error(
    `\n[api-guard] ${violations.length} violation(s). Import from "@/config/api" instead.`
  );
  process.exit(1);
}

console.log("[api-guard] OK — no hardcoded API prefix or backend host in src/.");
