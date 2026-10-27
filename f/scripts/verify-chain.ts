/**
 * =====================================================
 * LIVE SEPOLIA VERIFICATION
 * =====================================================
 *
 * Read-only checks against the configured RPC + contracts. Writes nothing
 * to the database and prints no secrets (only public addresses).
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register scripts/verify-chain.ts
 *   (or: npm run verify:chain)
 *
 * Checks:
 *   1. eth_chainId === 0xaa36a7 (Sepolia)
 *   2. block number is readable
 *   3. every configured contract has bytecode
 *   4. contracts point at each other consistently
 *   5. event topics in our ABIs match on-chain logs
 *   6. eth_getLogs works on a small, provider-allowed range
 *   7. the indexer resumes from its checkpoint (no restart from block 1)
 *   8. the provider's historical log window is reported
 */

import "dotenv/config";
import { ethers } from "ethers";
import { env } from "@core/config/env";
import {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_ID_HEX,
} from "@core/blockchain/chains/constants";
import { provider } from "@core/blockchain/provider";
import { getPastPurchases } from "@core/blockchain/sale.contract";
import { getPastAllocations, getPastClaims } from "@core/blockchain/vesting.contract";
import { classifyRpcError } from "@core/blockchain/rpc-errors";
import { runEventSync, type CheckpointStore } from "@core/blockchain/sync-engine";
import SaleABI from "@core/abis/Sale";
import VestingABI from "@core/abis/Vesting";

type Result = { name: string; ok: boolean; detail?: string };

const results: Result[] = [];

const check = (name: string, ok: boolean, detail?: string): void => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const short = (value: string, size = 10): string =>
  value.length <= size * 2 + 2
    ? value
    : `${value.slice(0, size)}…${value.slice(-size)}`;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Find the oldest block the provider will still answer eth_getLogs for.
 * Returns 1 when full history is available.
 */
const detectLogFloor = async (head: number, addresses: string[]): Promise<number> => {
  const probe = async (fromBlock: number): Promise<boolean> => {
    try {
      await provider.getLogs({
        address: addresses,
        fromBlock,
        toBlock: Math.min(fromBlock + 15, head),
      });
      return true;
    } catch {
      return false;
    }
  };

  if (await probe(1)) return 1;

  let low = 1;
  let high = head;
  let floor = head;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    if (await probe(mid)) {
      floor = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return floor;
};

const main = async (): Promise<void> => {
  // ── 1. Network ────────────────────────────────────────────────────────
  try {
    const rawChainId = await provider.send("eth_chainId", []);
    check(
      "eth_chainId is Sepolia (0xaa36a7)",
      rawChainId === SEPOLIA_CHAIN_ID_HEX,
      rawChainId
    );
  } catch (error: any) {
    check("eth_chainId is Sepolia (0xaa36a7)", false, error?.message);
  }

  const network = await provider.getNetwork().catch(() => null);
  check(
    "provider network is Sepolia (11155111)",
    Number(network?.chainId) === SEPOLIA_CHAIN_ID,
    network ? `chainId=${network.chainId}` : "unreachable"
  );

  const head = await provider.getBlockNumber();
  check("block number readable", Number.isFinite(head) && head > 0, `head=${head}`);

  // ── 2. Bytecode ───────────────────────────────────────────────────────
  const addresses = {
    TOKEN: env.contracts.token,
    SALE: env.contracts.sale,
    AIRDROP: env.contracts.airdrop,
    VESTING: env.contracts.vesting,
    PRICE_ORACLE: env.contracts.priceOracle,
  };

  for (const [name, address] of Object.entries(addresses)) {
    if (!address) {
      check(`${name} address configured`, false, "missing env value");
      continue;
    }

    try {
      const code = await provider.getCode(address);
      const bytecodeBytes = (code.length - 2) / 2;
      check(
        `${name} has bytecode on Sepolia`,
        bytecodeBytes > 0,
        `${short(address)} (${bytecodeBytes} bytes)`
      );
    } catch (error: any) {
      check(`${name} has bytecode on Sepolia`, false, error?.message);
    }
  }

  // ── 3. Cross references ───────────────────────────────────────────────
  const same = (a?: string | null, b?: string | null): boolean =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase();

  if (addresses.SALE && addresses.TOKEN && addresses.VESTING && addresses.PRICE_ORACLE) {
    try {
      const sale = new ethers.Contract(addresses.SALE, SaleABI, provider);
      const [token, vesting, oracle] = await Promise.all([
        sale.token(),
        sale.vesting(),
        sale.priceOracle(),
      ]);

      check("Sale.token === TOKEN_ADDRESS", same(token, addresses.TOKEN), token);
      check("Sale.vesting === VESTING_ADDRESS", same(vesting, addresses.VESTING), vesting);
      check(
        "Sale.priceOracle === PRICE_ORACLE_ADDRESS",
        same(oracle, addresses.PRICE_ORACLE),
        oracle
      );
    } catch (error: any) {
      check("Sale contract reads", false, error?.message);
    }
  }

  if (addresses.VESTING && addresses.TOKEN) {
    try {
      const vesting = new ethers.Contract(addresses.VESTING, VestingABI, provider);
      const [token, start] = await Promise.all([
        vesting.token(),
        vesting.startTime(),
      ]);

      check("Vesting.token === TOKEN_ADDRESS", same(token, addresses.TOKEN), token);
      check(
        "Vesting.startTime readable",
        Number(start) > 0,
        new Date(Number(start) * 1000).toISOString()
      );
    } catch (error: any) {
      check("Vesting contract reads", false, error?.message);
    }
  }

  // ── 4. Event topics ───────────────────────────────────────────────────
  const saleIface = new ethers.Interface(SaleABI);
  const vestingIface = new ethers.Interface(VestingABI);

  check(
    "Purchased event topic derives from ABI",
    !!saleIface.getEvent("Purchased")?.topicHash,
    saleIface.getEvent("Purchased")?.topicHash
  );
  check(
    "Allocated event topic derives from ABI",
    !!vestingIface.getEvent("Allocated")?.topicHash,
    vestingIface.getEvent("Allocated")?.topicHash
  );
  check(
    "Claimed event topic derives from ABI",
    !!vestingIface.getEvent("Claimed")?.topicHash,
    vestingIface.getEvent("Claimed")?.topicHash
  );

  // ── 5. Small eth_getLogs probe ────────────────────────────────────────
  const logAddresses = [addresses.SALE, addresses.VESTING, addresses.AIRDROP]
    .filter((address): address is string => !!address)
    .map((address) => address.toLowerCase());

  try {
    const fromBlock = Math.max(1, head - 10);
    const logs = await provider.getLogs({
      address: logAddresses,
      fromBlock,
      toBlock: head,
    });

    check(
      "eth_getLogs works on a recent 10-block range",
      true,
      `${logs.length} log(s) in ${fromBlock}-${head}`
    );

    for (const log of logs.slice(0, 5)) {
      const iface =
        same(log.address, addresses.VESTING) ? vestingIface : saleIface;

      try {
        const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
        check(
          `decoded ${parsed?.name} log with project ABI`,
          true,
          `${short(log.transactionHash)} block ${log.blockNumber}`
        );
      } catch {
        check(
          "decoded log with project ABI",
          false,
          `unknown topic ${short(log.topics[0] ?? "0x", 8)} from ${short(log.address, 6)}`
        );
      }
    }
  } catch (error: any) {
    check(
      "eth_getLogs works on a recent 10-block range",
      false,
      classifyRpcError(error)
    );
  }

  // ── 6. Provider historical window ─────────────────────────────────────
  let floor = head;
  try {
    floor = await detectLogFloor(head, logAddresses);
    const windowSize = head - floor + 1;

    check(
      "provider historical log window detected",
      true,
      floor === 1
        ? "full history available (archive-capable)"
        : `only the last ~${windowSize} blocks are queryable (floor=${floor})`
    );
  } catch (error: any) {
    check("provider historical log window detected", false, error?.message);
  }

  // ── 7. Resume simulation (no database writes) ─────────────────────────
  const store: CheckpointStore & { checkpoint: number } = {
    checkpoint: 0,
    async getLastBlock() {
      return this.checkpoint;
    },
    async setLastBlock(_key, blockNumber) {
      this.checkpoint = blockNumber;
    },
    async getValue() {
      return null;
    },
    async setValue() {
      /* no-op */
    },
  };

  const syncOptions = {
    label: "verify-purchase-resume",
    startBlockEnvName: "SALE_START_BLOCK",
    stateKey: "verify_sale_last_block",
    gapKey: "verify_sale_gap",
    configuredStartBlock: null,
    batchSize: 5_000,
    safeLookbackBlocks: env.sync.safeLookbackBlocks,
    maxRetries: 2,
    retryBaseDelayMs: 500,
    batchDelayMs: 0,
    fetchRange: async (fromBlock: number, toBlock: number) => {
      await sleep(50);
      return getPastPurchases(fromBlock, toBlock);
    },
    processEvents: async (events: unknown[]) => ({
      processed: events.length,
      skipped: 0,
      errors: 0,
    }),
    store,
  };

  try {
    const first = await runEventSync(syncOptions);

    check(
      "first run without SALE_START_BLOCK does not scan from block 1",
      first.fromBlock > 1,
      `fromBlock=${first.fromBlock}`
    );
    check(
      "first run records the skipped history explicitly",
      first.gap !== null || first.fromBlock === 1,
      first.gap
        ? `gap ${first.gap.fromBlock}-${first.gap.toBlock}`
        : "no gap (full history available)"
    );
    check(
      "checkpoint persisted to the last processed block",
      store.checkpoint === first.toBlock,
      `${store.checkpoint}`
    );

    const second = await runEventSync(syncOptions);

    check(
      "second run resumes instead of rescanning",
      second.batches === 0 && second.fromBlock > first.fromBlock,
      `fromBlock=${second.fromBlock} (checkpoint=${store.checkpoint})`
    );
  } catch (error: any) {
    check("sync resume simulation", false, error?.message);
  }

  // ── 8. Vesting event queries in the allowed window ────────────────────
  try {
    const from = Math.max(1, head - 50);
    const [allocations, claims] = await Promise.all([
      getPastAllocations(from, head),
      getPastClaims(from, head),
    ]);

    check(
      "vesting Allocated/Claimed queries succeed",
      true,
      `${allocations.length} allocated, ${claims.length} claimed in last 50 blocks`
    );
  } catch (error: any) {
    check(
      "vesting Allocated/Claimed queries succeed",
      false,
      classifyRpcError(error)
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const failed = results.filter((result) => !result.ok);

  console.log("\n──────────────────────────────────────────────");
  console.log(
    `Summary: ${results.length - failed.length}/${results.length} checks passed`
  );

  if (failed.length > 0) {
    console.log("Failed checks:");
    for (const result of failed) {
      console.log(`  - ${result.name}${result.detail ? ` (${result.detail})` : ""}`);
    }
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error("FATAL:", error?.message ?? error);
  process.exitCode = 1;
});
