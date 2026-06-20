import { prisma } from "@core/db/prisma";
import { PaymentAsset, Purchase, PurchaseSource, Prisma } from "@prisma/client";

/**
 * =====================================================
 * PURCHASE REPOSITORY
 * =====================================================
 *
 * Responsible ONLY for Prisma queries and persistence.
 * No business logic here.
 */

export const purchaseRepository = {
  // ─── CRUD ──────────────────────────────────────────────────────

  /**
   * Find a purchase by transaction hash (idempotency check).
   */
  async findByTxHash(txHash: string): Promise<Purchase | null> {
    return prisma.purchase.findUnique({
      where: { txHash },
    });
  },

  /**
   * Create a new purchase record.
   */
  async create(data: {
    userId: string;
    source: PurchaseSource;
    paymentAsset: PaymentAsset;
    paymentAmount: Prisma.Decimal;
    paymentAmountWei: string;
    tokenReceived: Prisma.Decimal;
    tokenReceivedWei: string;
    tokenPriceUsd?: Prisma.Decimal | null;
    usdValue?: Prisma.Decimal | null;
    chainId: number;
    txHash: string;
    blockNumber: bigint;
    blockTimestamp?: Date | null;
    blockHash?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<Purchase> {
    const { metadata, ...rest } = data;
    return prisma.purchase.create({
      data: {
        ...rest,
        metadata: metadata ?? undefined,
      },
    });
  },

  /**
   * Upsert by txHash — used for safe re-processing.
   */
  async upsertByTxHash(
    txHash: string,
    data: {
      userId: string;
      source: PurchaseSource;
      paymentAsset: PaymentAsset;
      paymentAmount: Prisma.Decimal;
      paymentAmountWei: string;
      tokenReceived: Prisma.Decimal;
      tokenReceivedWei: string;
      tokenPriceUsd?: Prisma.Decimal | null;
      usdValue?: Prisma.Decimal | null;
      chainId: number;
      blockNumber: bigint;
      blockTimestamp?: Date | null;
      blockHash?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  ): Promise<Purchase> {
    const { metadata, ...rest } = data;
    return prisma.purchase.upsert({
      where: { txHash },
      create: { txHash, ...rest, metadata: metadata ?? undefined },
      update: {
        blockNumber: data.blockNumber,
        blockTimestamp: data.blockTimestamp,
        blockHash: data.blockHash,
      },
    });
  },

  // ─── QUERIES ───────────────────────────────────────────────────

  /**
   * Get all purchases for a user, ordered by newest first.
   */
  async findByUserId(userId: string): Promise<Purchase[]> {
    return prisma.purchase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Get purchase by ID.
   */
  async findById(id: string): Promise<Purchase | null> {
    return prisma.purchase.findUnique({ where: { id } });
  },

  /**
   * Get the highest block number across all purchases.
   * Used to determine the sync starting point.
   */
  async getMaxBlockNumber(): Promise<bigint | null> {
    const result = await prisma.purchase.aggregate({
      _max: { blockNumber: true },
    });
    return result._max.blockNumber ?? null;
  },

  /**
   * Count total purchases.
   */
  async countAll(): Promise<number> {
    return prisma.purchase.count();
  },

  /**
   * Count unique buyers (distinct userId).
   */
  async countUniqueBuyers(): Promise<number> {
    const result = await prisma.purchase.groupBy({
      by: ["userId"],
    });
    return result.length;
  },

  /**
   * Get purchase stats grouped by payment asset.
   */
  async getStatsByAsset(): Promise<
    Array<{
      paymentAsset: PaymentAsset;
      _count: { id: number };
      _sum: { paymentAmount: Prisma.Decimal | null };
    }>
  > {
    return prisma.purchase.groupBy({
      by: ["paymentAsset"],
      _count: { id: true },
      _sum: { paymentAmount: true },
    });
  },

  /**
   * Get purchase stats grouped by source.
   */
  async getStatsBySource(): Promise<
    Array<{
      source: PurchaseSource;
      _count: { id: number };
    }>
  > {
    return prisma.purchase.groupBy({
      by: ["source"],
      _count: { id: true },
    });
  },

  /**
   * Get purchases in a block range (for sync verification).
   */
  async findByBlockRange(
    fromBlock: number,
    toBlock: number
  ): Promise<Purchase[]> {
    return prisma.purchase.findMany({
      where: {
        blockNumber: {
          gte: BigInt(fromBlock),
          lte: BigInt(toBlock),
        },
      },
      orderBy: { blockNumber: "asc" },
    });
  },

  /**
   * Get recent purchases (for admin dashboard).
   */
  async findRecent(limit: number): Promise<Purchase[]> {
    return prisma.purchase.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  /**
   * Check if a txHash exists (lightweight idempotency check).
   */
  async existsByTxHash(txHash: string): Promise<boolean> {
    const count = await prisma.purchase.count({
      where: { txHash },
    });
    return count > 0;
  },
};
