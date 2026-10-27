import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isOriginAllowed,
  normalizeOrigin,
  parseOriginList,
} from "@core/security/origin";

/**
 * Regression tests for the production CORS failure:
 * the live backend had CORS_ORIGIN configured WITH a trailing slash, so the
 * browser's Origin header (which never has one) did not match and the
 * response carried no Access-Control-Allow-Origin header.
 */

describe("normalizeOrigin", () => {
  it("strips trailing slashes and trims whitespace", () => {
    assert.equal(
      normalizeOrigin("  https://frontendco.netlify.app/  "),
      "https://frontendco.netlify.app"
    );
  });

  it("lowercases the origin", () => {
    assert.equal(
      normalizeOrigin("HTTPS://FrontendCO.Netlify.App"),
      "https://frontendco.netlify.app"
    );
  });
});

describe("parseOriginList", () => {
  it("returns null for empty and wildcard values", () => {
    assert.equal(parseOriginList(undefined), null);
    assert.equal(parseOriginList(""), null);
    assert.equal(parseOriginList("   "), null);
    assert.equal(parseOriginList("*"), null);
  });

  it("splits comma-separated origins and removes duplicates", () => {
    assert.deepEqual(
      parseOriginList(
        "https://a.example, https://b.example/,https://A.example"
      ),
      ["https://a.example", "https://b.example"]
    );
  });
});

describe("isOriginAllowed", () => {
  const allowlist = parseOriginList(
    "https://frontendco.netlify.app/,https://superb-alpaca-9fed79.netlify.app"
  );

  it("matches the browser Origin even when the allowlist entry has a trailing slash", () => {
    assert.equal(
      isOriginAllowed("https://frontendco.netlify.app", allowlist),
      true
    );
    assert.equal(
      isOriginAllowed("https://superb-alpaca-9fed79.netlify.app", allowlist),
      true
    );
  });

  it("rejects unknown origins", () => {
    assert.equal(isOriginAllowed("https://evil.example", allowlist), false);
  });

  it("allows requests without an Origin header (server-to-server)", () => {
    assert.equal(isOriginAllowed(undefined, allowlist), true);
  });

  it("reflects any origin only when the allowlist is null", () => {
    assert.equal(isOriginAllowed("https://anything.example", null), true);
  });
});
