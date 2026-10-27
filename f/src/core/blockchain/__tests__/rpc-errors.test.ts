import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyRpcError,
  extractRpcErrorMessage,
  isRetryableRpcError,
} from "@core/blockchain/rpc-errors";

/**
 * The first message below is the exact response reproduced against the
 * configured Chainstack Sepolia endpoint for eth_getLogs on old blocks.
 */
const CHAINSTACK_PLAN_LIMIT =
  "Archive, Debug and Trace requests are not available on your current plan. " +
  "Visit https://console.chainstack.com/user/settings/billing to upgrade..";

describe("classifyRpcError", () => {
  it("recognizes the Chainstack plan limit as a permanent PLAN_LIMIT", () => {
    assert.equal(classifyRpcError(new Error(CHAINSTACK_PLAN_LIMIT)), "PLAN_LIMIT");
    assert.equal(isRetryableRpcError(new Error(CHAINSTACK_PLAN_LIMIT)), false);
  });

  it("reads nested ethers error payloads", () => {
    const ethersError = {
      code: "CALL_EXCEPTION",
      shortMessage: "could not coalesce error",
      info: { error: { code: -32002, message: CHAINSTACK_PLAN_LIMIT } },
    };

    assert.equal(classifyRpcError(ethersError), "PLAN_LIMIT");
    assert.match(extractRpcErrorMessage(ethersError), /Archive, Debug and Trace/);
  });

  it("classifies block-range rejections so the range can be split", () => {
    assert.equal(
      classifyRpcError(new Error("block range is too large, max 5000")),
      "RANGE_TOO_LARGE"
    );
    assert.equal(
      classifyRpcError(new Error("query returned more than 10000 results")),
      "RANGE_TOO_LARGE"
    );
    assert.equal(
      classifyRpcError({ error: { code: -32005, message: "limit exceeded" } }),
      "RANGE_TOO_LARGE"
    );
  });

  it("classifies rate limits and transient failures as retryable", () => {
    assert.equal(classifyRpcError(new Error("429 too many requests")), "RATE_LIMITED");
    assert.equal(classifyRpcError(new Error("socket hang up")), "TRANSIENT");
    assert.equal(classifyRpcError(new Error("ETIMEDOUT")), "TRANSIENT");
    assert.equal(isRetryableRpcError(new Error("429 too many requests")), true);
    assert.equal(isRetryableRpcError(new Error("socket hang up")), true);
  });

  it("does not retry a range that must be split", () => {
    assert.equal(
      isRetryableRpcError(new Error("block range is too large")),
      false
    );
  });

  it("falls back to UNKNOWN for unrecognized errors", () => {
    assert.equal(classifyRpcError(new Error("boom")), "UNKNOWN");
    assert.equal(classifyRpcError(undefined), "UNKNOWN");
  });
});
