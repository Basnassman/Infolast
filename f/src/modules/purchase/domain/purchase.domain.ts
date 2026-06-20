import { PaymentAsset, PurchaseSource } from "@prisma/client";
import { ethers } from "ethers";
import { PurchaseSyncError } from "@modules/purchase/errors/purchase-sync.error";
import {
  BuyerClassification,
  CurrencyMapping,
  ETH_SENTINEL,
  MappedPurchaseEvent,
  RawPurchasedEvent,
} from "@modules/purchase/types/purchase.types";

/**
 * =====================================================
 * DEFAULT CURRENCY MAPPING
 * =====================================================
 *
 * Maps on-chain currency addresses to PaymentAsset enum.
 * The zero address is treated as ETH (buyETH uses msg.value).
 */

const DEFAULT_CURRENCY_MAP: CurrencyMapping[] = [
  { address: ETH_SENTINEL, asset: PaymentAsset.ETH, decimals: 18 },
];

/**
 * =====================================================
 * CURRENCY RESOLVER
 * =====================================================
 */

export const resolvePaymentAsset = (
  currencyAddress: string,
  knownTokens?: CurrencyMapping[]
): PaymentAsset => {
  const normalized = currencyAddress.toLowerCase();

  // Check known tokens first
  if (knownTokens) {
    const match = knownTokens.find(
      (t) => t.address.toLowerCase() === normalized
    );
    if (match) return match.asset;
  }

  // Check default mapping
  const defaultMatch = DEFAULT_CURRENCY_MAP.find(
    (t) => t.address.toLowerCase() === normalized
  );
  if (defaultMatch) return defaultMatch.asset;

  throw new PurchaseSyncError(
    `Unknown currency address: ${currencyAddress}. Add it to CurrencyMapping.`
  );
};

/**
 * =====================================================
 * TOKEN DECIMALS
 * =====================================================
 */

const ETH_DECIMALS = 18;
const USDT_DECIMALS = 6;
const USDC_DECIMALS = 6;

export const getDecimalsForAsset = (asset: PaymentAsset): number => {
  switch (asset) {
    case PaymentAsset.ETH:
      return ETH_DECIMALS;
    case PaymentAsset.USDT:
      return USDT_DECIMALS;
    case PaymentAsset.USDC:
      return USDC_DECIMALS;
    default:
      return 18;
  }
};

/**
 * =====================================================
 * USD VALUE CALCULATOR
 * =====================================================
 */

export const calculateUsdValue = (
  asset: PaymentAsset,
  amountWei: string
): string | null => {
  const decimals = getDecimalsForAsset(asset);
  const formatted = ethers.formatUnits(amountWei, decimals);

  // Stablecoins: value equals the raw amount
  if (asset === PaymentAsset.USDT || asset === PaymentAsset.USDC) {
    return formatted;
  }

  // ETH: requires price oracle integration
  // Return null for now — can be enriched later via PriceOracle contract
  return null;
};

/**
 * =====================================================
 * MAP RAW EVENT → MAPPED PURCHASE EVENT
 * =====================================================
 */

export const mapEventToPurchase = (
  event: RawPurchasedEvent,
  chainId: number,
  knownTokens?: CurrencyMapping[]
): MappedPurchaseEvent => {
  const paymentAsset = resolvePaymentAsset(event.currency, knownTokens);

  const tokenDecimals = 18; // FOR token is 18 decimals
  const paymentDecimals = getDecimalsForAsset(paymentAsset);

  const paymentAmount = ethers.formatUnits(event.paid.toString(), paymentDecimals);
  const tokenReceived = ethers.formatUnits(event.tokens.toString(), tokenDecimals);

  const usdValue = calculateUsdValue(paymentAsset, event.paid.toString());

  // Default source — refine with config if needed
  const source = PurchaseSource.PUBLIC;

  return {
    walletAddress: event.user.toLowerCase(),
    paymentAsset,
    paymentAmount,
    paymentAmountWei: event.paid.toString(),
    tokenReceived,
    tokenReceivedWei: event.tokens.toString(),
    chainId,
    txHash: event.txHash,
    blockNumber: event.blockNumber,
    blockHash: event.blockHash,
    blockTimestamp: new Date(), // Overridden by sync layer with actual block timestamp
    source,
    usdValue,
  };
};

/**
 * =====================================================
 * BUYER CLASSIFICATION
 * =====================================================
 */

export const classifyBuyer = (
  hasPurchases: boolean,
  hasAirdrop: boolean
): BuyerClassification => {
  if (hasPurchases && hasAirdrop) return "PARTICIPANT_BUYER";
  if (hasPurchases) return "BUYER_ONLY";
  return "PARTICIPANT_ONLY";
};
