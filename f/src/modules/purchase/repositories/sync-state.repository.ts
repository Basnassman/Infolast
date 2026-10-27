import { prisma } from "@core/db/prisma";

/**
 * =====================================================
 * SYNC STATE REPOSITORY
 * =====================================================
 *
 * Key-value persistence for blockchain indexing checkpoints.
 * Each sync source has its own key (e.g., "sale_last_processed_block").
 *
 * The checkpoint is the last block that was FULLY persisted for a source.
 * It is only written after a batch succeeds, which makes the indexer
 * resumable and prevents events from being lost on failure.
 */

export const syncStateRepository = {
  /**
   * Get the last processed block for a given sync key.
   * Returns 0 if no checkpoint exists (first sync).
   */
  async getLastBlock(key: string): Promise<number> {
    const state = await prisma.syncState.findUnique({
      where: { key },
    });

    if (!state) return 0;
    const parsed = parseInt(state.value, 10);
    return isNaN(parsed) ? 0 : parsed;
  },

  /**
   * Update the last processed block for a given sync key.
   */
  async setLastBlock(key: string, blockNumber: number): Promise<void> {
    await prisma.syncState.upsert({
      where: { key },
      update: { value: blockNumber.toString() },
      create: { key, value: blockNumber.toString() },
    });
  },

  /**
   * Get a generic value by key.
   */
  async getValue(key: string): Promise<string | null> {
    const state = await prisma.syncState.findUnique({
      where: { key },
    });
    return state?.value ?? null;
  },

  /**
   * Set a generic value by key.
   */
  async setValue(key: string, value: string): Promise<void> {
    await prisma.syncState.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  },
};

/**
 * =====================================================
 * SYNC KEYS
 * =====================================================
 */

export const SYNC_KEYS = {
  SALE_LAST_BLOCK: "sale_last_processed_block",
  VESTING_LAST_BLOCK: "vesting_last_processed_block",

  /**
   * JSON record of blocks that could not be indexed because the RPC
   * provider does not serve historical logs on the current plan.
   * Written by the sync engine; kept until an operator backfills them.
   */
  SALE_SYNC_GAP: "sale_sync_gap",
  VESTING_SYNC_GAP: "vesting_sync_gap",
} as const;
