import { ethers } from "ethers";
import { wallet, provider, config } from "@core/blockchain/provider";
import PriceOracleABI from "@core/abis/PriceOracle";

import { ConfigurationError } from "@core/errors/infrastructure/configuration.error";

// ─── Lazy Contract Helpers ────────────────────────────────────────────────

function requirePriceOracleAddress(): string {
  if (!config.priceOracle) throw new ConfigurationError("PRICE_ORACLE_ADDRESS env variable is not configured");
  return config.priceOracle;
}

// ─── Read-only Contract (lazy via Proxy) ───────────────────────────────────

let _priceOracleRead: ethers.Contract | null = null;

function _getPriceOracleRead(): ethers.Contract {
  if (!_priceOracleRead) {
    _priceOracleRead = new ethers.Contract(requirePriceOracleAddress(), PriceOracleABI, provider);
  }
  return _priceOracleRead;
}

// Read-only contract
export const priceOracleRead = new Proxy({} as ethers.Contract, {
  get(_target, prop) {
    return (_getPriceOracleRead() as any)[prop];
  },
});

// Write contract (requires admin wallet) — lazy
let _priceOracleWrite: ethers.Contract | null = null;
let _priceOracleWriteInitialized = false;

export function getPriceOracleWrite(): ethers.Contract | null {
  if (!wallet) return null;
  if (!_priceOracleWriteInitialized) {
    _priceOracleWriteInitialized = true;
    _priceOracleWrite = new ethers.Contract(requirePriceOracleAddress(), PriceOracleABI, wallet);
  }
  return _priceOracleWrite;
}


// Token price
export const getTokenPrice = async (): Promise<string> => {
  const price = await priceOracleRead.tokenPriceUsd();
  return price.toString();
};

// Token price updated at
export const getTokenPriceUpdatedAt = async (): Promise<number> => {
  const updatedAt = await priceOracleRead.tokenPriceUpdatedAt();
  return Number(updatedAt);
};

// Currency info
export const getCurrencyInfo = async (currency: string) => {
  const [supported, decimals, priceUsd, updatedAt, chainlinkFeed] = 
    await priceOracleRead.getCurrency(currency);

  return {
    supported,
    decimals: Number(decimals),
    priceUsd: priceUsd.toString(),
    updatedAt: Number(updatedAt),
    chainlinkFeed,
  };
};

// Quote: how many tokens for X amount of currency
export const getQuote = async (currency: string, amount: string): Promise<string> => {
  const tokens = await priceOracleRead.quote(currency, amount);
  return tokens.toString();
};

// Reverse quote: how much currency for X tokens
export const getReverseQuote = async (currency: string, tokenAmount: string): Promise<string> => {
  const payment = await priceOracleRead.quoteReverse(currency, tokenAmount);
  return payment.toString();
};

// Get quote info (tokens + usd value + token price)
export const getQuoteInfo = async (currency: string, amount: string) => {
  const [tokens, usdValue, tokenPrice] = await priceOracleRead.getQuoteInfo(currency, amount);

  return {
    tokens: tokens.toString(),
    usdValue: usdValue.toString(),
    tokenPrice: tokenPrice.toString(),
  };
};

// All supported currencies
export const getSupportedCurrencies = async (): Promise<string[]> => {
  return priceOracleRead.getCurrencies();
};

// Chainlink price for currency
export const getChainlinkPrice = async (currency: string): Promise<string> => {
  const price = await priceOracleRead.getChainlinkPrice(currency);
  return price.toString();
};

// Update token price (admin only)
export const updateTokenPrice = async (newPrice: string) => {
  const contract = getPriceOracleWrite();
  if (!contract) throw new Error("Admin wallet not configured");
  const tx = await contract.updateTokenPrice(newPrice);
  return tx.hash;
};

// Update currency price (admin only)
export const updateCurrencyPrice = async (currency: string, newPrice: string) => {
  const contract = getPriceOracleWrite();
  if (!contract) throw new Error("Admin wallet not configured");
  const tx = await contract.updateCurrencyPrice(currency, newPrice);
  return tx.hash;
};

// Add currency (admin only)
export const addCurrency = async (
  currency: string,
  decimals: number,
  priceUsd: string,
  chainlinkFeed: string
) => {
  const contract = getPriceOracleWrite();
  if (!contract) throw new Error("Admin wallet not configured");
  const tx = await contract.addCurrency(currency, decimals, priceUsd, chainlinkFeed);
  return tx.hash;
};

// Constants
export const getOracleConstants = async () => {
  const [bpsDenominator, maxBps, stalenessThreshold] = await Promise.all([
    priceOracleRead.BPS_DENOMINATOR(),
    priceOracleRead.MAX_BPS(),
    priceOracleRead.STALENESS_THRESHOLD(),
  ]);

  return {
    bpsDenominator: Number(bpsDenominator),
    maxBps: Number(maxBps),
    stalenessThreshold: Number(stalenessThreshold),
  };
};