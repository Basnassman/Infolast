/**
 * =====================================================
 * BACKFILL PURCHASE USD VALUES
 * =====================================================
 *
 * Updates existing Purchase records that have null tokenPriceUsd / usdValue
 * by fetching current prices from PriceOracle.
 *
 * Usage:
 *   npx tsx scripts/backfill-purchase-usd.ts
 */

import { PrismaClient, Prisma, PaymentAsset } from "@prisma/client";
import { ethers } from "ethers";

// ─── Database ───────────────────────────────────────────────────────────────
const prisma = new PrismaClient();

// ─── Constants ──────────────────────────────────────────────────────────────
// Using zero address for ETH (same as ETH_SENTINEL in domain layer)
const ETH_ZERO_ADDRESS = ethers.ZeroAddress;

// PriceOracle ABI (minimal for read functions)
const PRICE_ORACLE_ABI = [
  "function getCurrency(address currency) view returns (bool supported, uint8 decimals, uint256 priceUsd, uint256 updatedAt, address chainlinkFeed)",
  "function tokenPriceUsd() view returns (uint256)",
];

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 Finding purchases with null tokenPriceUsd or usdValue...\n");

  const purchases = await prisma.purchase.findMany({
    where: {
      OR: [
        { tokenPriceUsd: null },
        { usdValue: null },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  if (purchases.length === 0) {
    console.log("✅ No purchases need updating. All records have USD values.");
    await prisma.$disconnect();
    return;
  }

  console.log(`📋 Found ${purchases.length} purchases to update.\n`);

  // ─── Setup PriceOracle ──────────────────────────────────────────
  const rpcUrl = process.env.RPC_URL || process.env.SEPOLIA_RPC_URL;
  const oracleAddress = process.env.PRICE_ORACLE_ADDRESS;

  if (!rpcUrl || !oracleAddress) {
    console.error(
      "❌ Missing RPC_URL or PRICE_ORACLE_ADDRESS env variables."
    );
    console.log("   Set them in your .env file:");
    console.log("   RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY");
    console.log("   PRICE_ORACLE_ADDRESS=0x...");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const oracle = new ethers.Contract(oracleAddress, PRICE_ORACLE_ABI, provider);

  // ─── Fetch current prices ───────────────────────────────────────
  console.log("📡 Fetching current prices from PriceOracle...\n");

  const ethPriceUsd = await getEthPriceUsd(oracle);
  const tokenPriceUsd = await getTokenPriceUsd(oracle);

  console.log(`  ETH price: ${ethPriceUsd ? `$${ethPriceUsd}` : "unavailable"}`);
  console.log(
    `  Token price: ${tokenPriceUsd ? `$${tokenPriceUsd}` : "unavailable"}`
  );
  console.log("");

  if (!ethPriceUsd && !tokenPriceUsd) {
    console.error("❌ Cannot proceed: both ETH and token prices are unavailable.");
    console.log("   Make sure PriceOracle is deployed and has valid prices.");
    await prisma.$disconnect();
    process.exit(1);
  }

  // ─── Update each purchase ───────────────────────────────────────
  let updatedCount = 0;
  let skippedCount = 0;

  for (const purchase of purchases) {
    const updates: {
      tokenPriceUsd?: Prisma.Decimal;
      usdValue?: Prisma.Decimal;
    } = {};

    // ─── Calculate usdValue ──────────────────────────────
    if (purchase.usdValue === null) {
      if (
        purchase.paymentAsset === PaymentAsset.USDT ||
        purchase.paymentAsset === PaymentAsset.USDC
      ) {
        // Stablecoin: amount = USD value
        updates.usdValue = new Prisma.Decimal(
          parseFloat(purchase.paymentAmount.toString())
        );
      } else if (
        purchase.paymentAsset === PaymentAsset.ETH &&
        ethPriceUsd
      ) {
        // ETH: amount × ETH price
        const ethAmount = parseFloat(purchase.paymentAmount.toString());
        updates.usdValue = new Prisma.Decimal(ethAmount * ethPriceUsd);
      }
    }

    // ─── Calculate tokenPriceUsd ─────────────────────────
    if (purchase.tokenPriceUsd === null && tokenPriceUsd) {
      updates.tokenPriceUsd = new Prisma.Decimal(tokenPriceUsd);
    }

    // ─── Apply update ────────────────────────────────────
    if (Object.keys(updates).length > 0) {
      await prisma.purchase.update({
        where: { id: purchase.id },
        data: updates,
      });

      updatedCount++;
      console.log(
        `  ✅ ${purchase.txHash.slice(0, 10)}... | ` +
          `${purchase.paymentAsset} ${purchase.paymentAmount} | ` +
          `usdValue: ${updates.usdValue?.toString() || purchase.usdValue || "null"} | ` +
          `tokenPriceUsd: ${updates.tokenPriceUsd?.toString() || purchase.tokenPriceUsd || "null"}`
      );
    } else {
      skippedCount++;
    }
  }

  // ─── Summary ────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log(`📊 Backfill complete:`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped (already had values or no price available): ${skippedCount}`);
  console.log(`   Total processed: ${purchases.length}`);
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
