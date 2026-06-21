import { PaymentAsset, PurchaseSource } from "@prisma/client";

/**
 * =====================================================
 * RAW BLOCKCHAIN EVENT
 * =====================================================
 */

export type RawPurchasedEvent = {
  user: string;
  currency: string;
  paid: bigint;
  tokens: bigint;
  txHash: string;
  blockNumber: number;
  blockHash: string;
  logIndex: number;
};

/**
 * =====================================================
 * MAPPED EVENT (after currency resolution)
 * =====================================================
 */

export type MappedPurchaseEvent = {
  walletAddress: string;
  paymentAsset: PaymentAsset;
  paymentAmount: string;
  paymentAmountWei: string;
  tokenReceived: string;
  tokenReceivedWei: string;
  chainId: number;
  txHash: string;
  blockNumber: number;
  blockHash: string;
  blockTimestamp: Date;
  source: PurchaseSource;
  usdValue: string | null;
  tokenPriceUsd: string | null;
};

/**
 * =====================================================
 * SYNC RESULT
 * =====================================================
 */

export type SyncResult = {
  fromBlock: number;
  toBlock: number;
  totalEvents: number;
  newPurchases: number;
  duplicatePurchases: number;
  errors: number;
  duration: number;
};

/**
 * =====================================================
 * BUYER CLASSIFICATION
 * =====================================================
 */

export type BuyerClassification = "PARTICIPANT_ONLY" | "BUYER_ONLY" | "PARTICIPANT_BUYER";

/**
 * =====================================================
 * PURCHASE STATS
 * =====================================================
 */

export type PurchaseStats = {
  totalPurchases: number;
  totalBuyers: number;
  totalPaymentUsd: string;
  totalTokensReceived: string;
  purchasesByAsset: Array<{
    asset: PaymentAsset;
    count: number;
    totalAmount: string;
  }>;
  purchasesBySource: Array<{
    source: PurchaseSource;
    count: number;
  }>;
};

/**
 * =====================================================
 * BUYER PROFILE (for analytics / reporting)
 * =====================================================
 */

export type BuyerProfile = {
  walletAddress: string;
  classification: BuyerClassification;
  totalPurchases: number;
  totalSpentUsd: string;
  totalTokensReceivedWei: string;
  firstPurchaseAt: Date;
  lastPurchaseAt: Date;
  paymentAssets: PaymentAsset[];
};

/**
 * =====================================================
 * CURRENCY ADDRESS MAPPING
 * =====================================================
 */

export const ETH_SENTINEL = "0x0000000000000000000000000000000000000000";

export type CurrencyMapping = {
  address: string;
  asset: PaymentAsset;
  decimals: number;
};
