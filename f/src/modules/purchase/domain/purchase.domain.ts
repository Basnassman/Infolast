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
import {
  getTokenPrice,
  getCurrencyInfo,
} from "@core/blockchain/priceOracle.contract";
import { logger } from "@core/logger/logger";

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
  // Sepolia testnet stablecoins
  { address: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238", asset: PaymentAsset.USDC, decimals: 6 },
  { address: "0xaa0e2d147e6a4febccebcede87a5d3a6e6f3d6f3c", asset: PaymentAsset.USDT, decimals: 6 },
  { address: "0x3e622317f8c93f7328350cf0b8d9c6e5e1e6b5b5", asset: PaymentAsset.USDT, decimals: 18 },
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

export const calculateUsdValue = async (
  asset: PaymentAsset,
  amountWei: string
): Promise<string | null> => {
  const decimals = getDecimalsForAsset(asset);
  const formatted = ethers.formatUnits(amountWei, decimals);

  // Stablecoins: value equals the raw amount
  if (asset === PaymentAsset.USDT || asset === PaymentAsset.USDC) {
    return formatted;
  }

  // ETH: use PriceOracle to get USD value
  try {
    const currencyInfo = await getCurrencyInfo(ETH_SENTINEL);
    if (currencyInfo.supported && Number(currencyInfo.priceUsd) > 0) {
      const ethAmount = parseFloat(formatted);
      const priceUsd = parseFloat(currencyInfo.priceUsd);
      return (ethAmount * priceUsd).toString();
    }
  } catch (error: any) {
    logger.warn(
      { asset, error: error.message },
      "Failed to get ETH price from Oracle, returning null"
    );
  }

  return null;
};

/**
 * Calculate token price in USD using PriceOracle
 */
export const calculateTokenPriceUsd = async (): Promise<string | null> => {
  try {
    const price = await getTokenPrice();
    if (Number(price) > 0) {
      return price;
    }
  } catch (error: any) {
    logger.warn(
      { error: error.message },
      "Failed to get token price from Oracle, returning null"
    );
  }
  return null;
};

/**
 * =====================================================
 * MAP RAW EVENT → MAPPED PURCHASE EVENT
 * =====================================================
 */

export const mapEventToPurchase = async (
  event: RawPurchasedEvent,
  chainId: number,
  knownTokens?: CurrencyMapping[]
): Promise<MappedPurchaseEvent> => {
  const paymentAsset = resolvePaymentAsset(event.currency, knownTokens);

  const tokenDecimals = 18; // FOR token is 18 decimals
  const paymentDecimals = getDecimalsForAsset(paymentAsset);

  const paymentAmount = ethers.formatUnits(event.paid.toString(), paymentDecimals);
  const tokenReceived = ethers.formatUnits(event.tokens.toString(), tokenDecimals);

  const usdValue = await calculateUsdValue(paymentAsset, event.paid.toString());
  const tokenPriceUsd = await calculateTokenPriceUsd();

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
    tokenPriceUsd,
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
