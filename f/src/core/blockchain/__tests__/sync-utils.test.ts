import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampRangeToFloor,
  computeBackoffDelay,
  mergeGap,
  queryableFloor,
  resolveStartBlock,
  splitRange,
  GAP_REASON_PROVIDER_WINDOW,
} from "@core/blockchain/sync-utils";

/**
 * These tests lock in the behaviour that fixes the endless
 * "batch failed / restart from block 1" loop.
 */

describe("resolveStartBlock", () => {
  it("resumes from the checkpoint instead of rescanning from block 1", () => {
    const result = resolveStartBlock({
      checkpoint: 11_000_000,
      configuredStartBlock: 10_000_000,
      head: 11_993_389,
      safeLookbackBlocks: 100,
      startBlockEnvName: "SALE_START_BLOCK",
    });

    assert.equal(result.fromBlock, 11_000_001);
    assert.equal(result.gap, null);
  });

  it("uses the configured deployment block on the first run", () => {
    const result = resolveStartBlock({
      checkpoint: 0,
      configuredStartBlock: 11_800_000,
      head: 11_993_389,
      safeLookbackBlocks: 100,
      startBlockEnvName: "SALE_START_BLOCK",
    });

    assert.equal(result.fromBlock, 11_800_000);
    assert.equal(result.gap, null);
  });

  it("clamps to the provider window and records an explicit gap when no start block is configured", () => {
    const result = resolveStartBlock({
      checkpoint: 0,
      configuredStartBlock: null,
      head: 11_993_389,
      safeLookbackBlocks: 100,
      startBlockEnvName: "VESTING_START_BLOCK",
    });

    assert.equal(result.fromBlock, 11_993_290);
    assert.ok(result.gap);
    assert.equal(result.gap?.fromBlock, 1);
    assert.equal(result.gap?.toBlock, 11_993_289);
    assert.match(result.gap?.reason ?? "", /VESTING_START_BLOCK/);
  });

  it("does not report a gap when the chain is shorter than the window", () => {
    const result = resolveStartBlock({
      checkpoint: 0,
      configuredStartBlock: null,
      head: 50,
      safeLookbackBlocks: 100,
      startBlockEnvName: "SALE_START_BLOCK",
    });

    assert.equal(result.fromBlock, 1);
    assert.equal(result.gap, null);
  });

  it("never starts above the head", () => {
    const result = resolveStartBlock({
      checkpoint: 0,
      configuredStartBlock: 99_999_999,
      head: 1_000,
      safeLookbackBlocks: 100,
      startBlockEnvName: "SALE_START_BLOCK",
    });

    assert.equal(result.fromBlock, 1_000);
  });
});

describe("clampRangeToFloor", () => {
  const floor = 11_993_290;

  it("skips a batch that is entirely older than the provider window", () => {
    const result = clampRangeToFloor({
      fromBlock: 1,
      toBlock: 5_000,
      floor,
    });

    assert.equal(result.range, null);
    assert.deepEqual(result.gap, {
      fromBlock: 1,
      toBlock: 5_000,
      reason: GAP_REASON_PROVIDER_WINDOW,
    });
  });

  it("clamps the current batch to the floor and reports the skipped prefix", () => {
    const result = clampRangeToFloor({
      fromBlock: 11_993_000,
      toBlock: 11_993_400,
      floor,
    });

    assert.deepEqual(result.range, { fromBlock: floor, toBlock: 11_993_400 });
    assert.deepEqual(result.gap, {
      fromBlock: 11_993_000,
      toBlock: floor - 1,
      reason: GAP_REASON_PROVIDER_WINDOW,
    });
  });

  it("leaves an in-window batch untouched", () => {
    const result = clampRangeToFloor({
      fromBlock: 11_993_300,
      toBlock: 11_993_350,
      floor,
    });

    assert.deepEqual(result.range, {
      fromBlock: 11_993_300,
      toBlock: 11_993_350,
    });
    assert.equal(result.gap, null);
  });
});

describe("queryableFloor", () => {
  it("returns the head minus the lookback (inclusive)", () => {
    assert.equal(queryableFloor(1_000, 100), 901);
  });

  it("never goes below block 1", () => {
    assert.equal(queryableFloor(10, 100), 1);
  });
});

describe("splitRange", () => {
  it("splits a range into two contiguous halves", () => {
    assert.deepEqual(splitRange(1, 10), [
      { fromBlock: 1, toBlock: 5 },
      { fromBlock: 6, toBlock: 10 },
    ]);
  });

  it("cannot split a single block", () => {
    assert.equal(splitRange(7, 7), null);
    assert.equal(splitRange(8, 7), null);
  });
});

describe("mergeGap", () => {
  it("unions overlapping ranges and keeps both reasons", () => {
    const merged = mergeGap(
      { fromBlock: 1, toBlock: 100, reason: "a" },
      { fromBlock: 101, toBlock: 200, reason: "b" }
    );

    assert.deepEqual(merged, {
      fromBlock: 1,
      toBlock: 200,
      reason: "a; b",
    });
  });

  it("returns the other side when one is null", () => {
    const gap = { fromBlock: 1, toBlock: 2, reason: "x" };
    assert.deepEqual(mergeGap(null, gap), gap);
    assert.deepEqual(mergeGap(gap, null), gap);
    assert.equal(mergeGap(null, null), null);
  });
});

describe("computeBackoffDelay", () => {
  it("grows exponentially and stays under the cap", () => {
    const first = computeBackoffDelay(0, 1_000, 30_000, 1);
    const second = computeBackoffDelay(1, 1_000, 30_000, 1);
    const capped = computeBackoffDelay(20, 1_000, 30_000, 1);

    assert.equal(first, 1_000);
    assert.equal(second, 2_000);
    assert.equal(capped, 30_000);
  });

  it("applies jitter within 50%-100% of the capped delay", () => {
    const low = computeBackoffDelay(3, 1_000, 30_000, 0);
    const high = computeBackoffDelay(3, 1_000, 30_000, 1);

    assert.equal(low, 4_000);
    assert.equal(high, 8_000);
  });
});
