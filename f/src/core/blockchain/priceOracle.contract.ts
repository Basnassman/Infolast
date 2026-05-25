import { ethers } from "ethers";
import { wallet, provider, config } from "./provider";
import PriceOracleABI from "../abis/PriceOracle.json";

// Read-only contract
export const priceOracleRead = new ethers.Contract(
  config.priceOracle,
  PriceOracleABI,
  provider
);

// Write contract (requires admin wallet)
export const priceOracleWrite = wallet
  ? new ethers.Contract(config.priceOracle, PriceOracleABI, wallet)
  : null;

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
  if (!priceOracleWrite) throw new Error("Admin wallet not configured");
  const tx = await priceOracleWrite.updateTokenPrice(newPrice);
  return tx.hash;
};

// Update currency price (admin only)
export const updateCurrencyPrice = async (currency: string, newPrice: string) => {
  if (!priceOracleWrite) throw new Error("Admin wallet not configured");
  const tx = await priceOracleWrite.updateCurrencyPrice(currency, newPrice);
  return tx.hash;
};

// Add currency (admin only)
export const addCurrency = async (
  currency: string,
  decimals: number,
  priceUsd: string,
  chainlinkFeed: string
) => {
  if (!priceOracleWrite) throw new Error("Admin wallet not configured");
  const tx = await priceOracleWrite.addCurrency(currency, decimals, priceUsd, chainlinkFeed);
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