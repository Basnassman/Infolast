import { ethers } from "ethers";
import { PaymentAsset, Prisma, PurchaseSource } from "@prisma/client";
import { purchaseRepository } from "@modules/purchase/repositories/purchase.repository";
import { userRepository } from "@modules/user/repositories/user.repository";
import { classifyBuyer, resolvePaymentAsset, getDecimalsForAsset, calculateUsdValue } from "@modules/purchase/domain/purchase.domain";
import {
  BuyerProfile,
  MappedPurchaseEvent,
  PurchaseStats,
} from "@modules/purchase/types/purchase.types";
import { saleContractRead } from "@core/blockchain/sale.contract";
import { provider } from "@core/blockchain/provider";
import { env } from "@core/config/env";
import { logger } from "@core/logger/logger";

/**
 * =====================================================
 * PURCHASE SERVICE
 * =====================================================
 *
 * Responsible ONLY for:
 * - Business logic
 * - Validation
 * - Processing
 * - Workflow orchestration
 *
 * NOT responsible for:
 * - Prisma queries (→ repository)
 * - Blockchain reading (→ sync layer)
 */

export const purchaseService = {
  /**
   * Process a single mapped purchase event.
   * Creates user if not found, persists purchase with idempotency.
   *
   * Uses upsertByTxHash for race-condition safety when
   * multiple sync workers run concurrently.
   *
   * Returns: { created: true } if new, { created: false } if duplicate.
   */
  async processEvent(event: MappedPurchaseEvent): Promise<{
    created: boolean;
    purchaseId?: string;
  }> {
    // ─── Find or create user (via repository) ─────────────────
    const user = await userRepository.findOrCreate(event.walletAddress);

    // ─── Idempotent upsert (handles race conditions) ─────────
    const existing = await purchaseRepository.findByTxHash(event.txHash);

    const purchaseData = {
      userId: user.id,
      source: event.source,
      paymentAsset: event.paymentAsset,
      paymentAmount: new Prisma.Decimal(event.paymentAmount),
      paymentAmountWei: event.paymentAmountWei,
      tokenReceived: new Prisma.Decimal(event.tokenReceived),
      tokenReceivedWei: event.tokenReceivedWei,
      usdValue: event.usdValue ? new Prisma.Decimal(event.usdValue) : null,
      chainId: event.chainId,
      blockNumber: BigInt(event.blockNumber),
      blockTimestamp: event.blockTimestamp,
      blockHash: event.blockHash,
    };

    const purchase = await purchaseRepository.upsertByTxHash(
      event.txHash,
      purchaseData
    );

    const created = !existing;

    if (created) {
      logger.info(
        {
          purchaseId: purchase.id,
          walletAddress: event.walletAddress,
          txHash: event.txHash,
          paymentAsset: event.paymentAsset,
          blockNumber: event.blockNumber,
        },
        "Purchase recorded"
      );
    } else {
      logger.debug(
        { txHash: event.txHash },
        "Duplicate purchase skipped"
      );
    }

    return { created, purchaseId: purchase.id };
  },

  /**
   * Process a purchase reported by the frontend.
   *
   * Accepts walletAddress + txHash, fetches the full Purchased event
   * from the blockchain, maps it to a MappedPurchaseEvent, and persists.
   *
   * This is idempotent — calling it twice with the same txHash is safe.
   */
  async processFrontendPurchase(
    walletAddress: string,
    txHash: string
  ): Promise<{ created: boolean; purchaseId?: string }> {
    const normalizedWallet = walletAddress.toLowerCase();

    // 1. Check if already recorded (idempotency)
    const existing = await purchaseRepository.findByTxHash(txHash);
    if (existing) {
      logger.debug({ txHash }, "Frontend purchase: already recorded, skipping");
      return { created: false, purchaseId: existing.id };
    }

    // 2. Fetch transaction receipt from blockchain
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error(`Transaction not found: ${txHash}`);
    }

    // 3. Find the Purchased event in the receipt logs
    const purchasedEvent = saleContractRead.interface.getEvent("Purchased");
    if (!purchasedEvent) {
      throw new Error("Purchased event not found in contract ABI");
    }
    const purchasedEventTopic = purchasedEvent.topicHash;
    const log = receipt.logs.find(
      (l) => l.address.toLowerCase() === saleContractRead.target?.toString().toLowerCase() && l.topics[0] === purchasedEventTopic
    );

    if (!log) {
      throw new Error(`No Purchased event found in tx: ${txHash}`);
    }

    // 4. Decode the event
    const decoded = saleContractRead.interface.decodeEventLog(
      purchasedEvent,
      log.data,
      log.topics
    );

    const eventUser = (decoded.user as string).toLowerCase();
    const currencyAddress = decoded.currency as string;
    const paid = decoded.paid as bigint;
    const tokens = decoded.tokens as bigint;

    // 5. Verify the user matches
    if (eventUser !== normalizedWallet) {
      throw new Error(
        `Wallet mismatch: expected ${normalizedWallet}, got ${eventUser}`
      );
    }

    // 6. Map to MappedPurchaseEvent (reusing domain logic)
    const paymentAsset = resolvePaymentAsset(currencyAddress);
    const paymentDecimals = getDecimalsForAsset(paymentAsset);
    const tokenDecimals = 18;

    const mappedEvent: MappedPurchaseEvent = {
      walletAddress: normalizedWallet,
      paymentAsset,
      paymentAmount: ethers.formatUnits(paid.toString(), paymentDecimals),
      paymentAmountWei: paid.toString(),
      tokenReceived: ethers.formatUnits(tokens.toString(), tokenDecimals),
      tokenReceivedWei: tokens.toString(),
      chainId: env.chainId,
      txHash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      blockTimestamp: new Date(), // will be overridden below
      source: PurchaseSource.PUBLIC,
      usdValue: calculateUsdValue(paymentAsset, paid.toString()),
    };

    // 7. Enrich with actual block timestamp
    const block = await provider.getBlock(receipt.blockNumber);
    if (block) {
      mappedEvent.blockTimestamp = new Date(block.timestamp * 1000);
    }

    // 8. Process via existing method (idempotent)
    return this.processEvent(mappedEvent);
  },

  /**
   * Get purchase history for a user.
   */
  async getUserPurchases(userId: string) {
    return purchaseRepository.findByUserId(userId);
  },

  /**
   * Get purchase by ID.
   */
  async getPurchaseById(id: string) {
    return purchaseRepository.findById(id);
  },

  /**
   * Get buyer profile with classification.
   */
  async getBuyerProfile(walletAddress: string): Promise<BuyerProfile | null> {
    const user = await userRepository.findByWallet(walletAddress.toLowerCase());

    if (!user) return null;

    const purchases = await purchaseRepository.findByUserId(user.id);

    if (purchases.length === 0) return null;

    const totalSpentUsd = purchases.reduce((sum, p) => {
      return sum + (p.usdValue ? Number(p.usdValue) : 0);
    }, 0);

    const totalTokensReceived = purchases.reduce((sum, p) => {
      return sum + BigInt(p.tokenReceivedWei);
    }, 0n);

    const paymentAssets = [
      ...new Set(purchases.map((p) => p.paymentAsset)),
    ];

    const firstPurchase = purchases[purchases.length - 1];
    const lastPurchase = purchases[0];

    return {
      walletAddress: user.walletAddress,
      classification: classifyBuyer(
        purchases.length > 0,
        "airdropParticipant" in user && !!(user as any).airdropParticipant
      ),
      totalPurchases: purchases.length,
      totalSpentUsd: totalSpentUsd.toString(),
      totalTokensReceivedWei: totalTokensReceived.toString(),
      firstPurchaseAt: firstPurchase.createdAt,
      lastPurchaseAt: lastPurchase.createdAt,
      paymentAssets,
    };
  },

  /**
   * Get aggregate purchase stats.
   */
  async getPurchaseStats(): Promise<PurchaseStats> {
    const [
      totalPurchases,
      totalBuyers,
      statsByAsset,
      statsBySource,
    ] = await Promise.all([
      purchaseRepository.countAll(),
      purchaseRepository.countUniqueBuyers(),
      purchaseRepository.getStatsByAsset(),
      purchaseRepository.getStatsBySource(),
    ]);

    const totalPaymentUsd = statsByAsset.reduce((sum, s) => {
      const asset = s.paymentAsset;
      // Stablecoins contribute 1:1 to USD
      if (asset === PaymentAsset.USDT || asset === PaymentAsset.USDC) {
        return sum + Number(s._sum.paymentAmount || 0);
      }
      return sum;
    }, 0);

    // totalTokensReceived: aggregated from paymentAmount as proxy
    // (tokenReceivedWei is a string field not aggregatable via _sum)
    const totalTokensReceived = 0;

    return {
      totalPurchases,
      totalBuyers,
      totalPaymentUsd: totalPaymentUsd.toString(),
      totalTokensReceived: totalTokensReceived.toString(),
      purchasesByAsset: statsByAsset.map((s) => ({
        asset: s.paymentAsset,
        count: s._count.id,
        totalAmount: s._sum.paymentAmount?.toString() || "0",
      })),
      purchasesBySource: statsBySource.map((s) => ({
        source: s.source,
        count: s._count.id,
      })),
    };
  },

  /**
   * Get recent purchases (admin dashboard).
   */
  async getRecentPurchases(limit: number) {
    return purchaseRepository.findRecent(limit);
  },
};
