import { ethers } from "ethers";
import { wallet, provider, config } from "@core/blockchain/provider";
import SaleABI from "@core/abis/Sale";

// Read-only contract
export const saleContractRead = new ethers.Contract(
  config.sale,
  SaleABI,
  provider
);

// Write contract (requires admin wallet)
export const saleContractWrite = wallet
  ? new ethers.Contract(config.sale, SaleABI, wallet)
  : null;

// Sale info
export const getSaleInfo = async () => {
  const [token, priceOracle, vesting, treasury, startTime, endTime, 
         maxTokens, tokensSold, minPurchase, maxPurchase, paused] = 
    await Promise.all([
      saleContractRead.token(),
      saleContractRead.priceOracle(),
      saleContractRead.vesting(),
      saleContractRead.treasury(),
      saleContractRead.startTime(),
      saleContractRead.endTime(),
      saleContractRead.maxTokens(),
      saleContractRead.tokensSold(),
      saleContractRead.minPurchase(),
      saleContractRead.maxPurchase(),
      saleContractRead.paused(),
    ]);

  return {
    token,
    priceOracle,
    vesting,
    treasury,
    startTime: Number(startTime),
    endTime: Number(endTime),
    maxTokens: maxTokens.toString(),
    tokensSold: tokensSold.toString(),
    minPurchase: minPurchase.toString(),
    maxPurchase: maxPurchase.toString(),
    paused,
    address: config.sale,
  };
};

// User purchase info
export const getUserPurchase = async (address: string) => {
  const [totalBought, totalSpent] = await Promise.all([
    saleContractRead.totalBought(address),
    saleContractRead.totalSpent(address),
  ]);

  return {
    totalBought: totalBought.toString(),
    totalSpent: totalSpent.toString(),
  };
};

// Quote: how many tokens for X ETH
export const getSaleQuote = async (currency: string, amount: string) => {
  const tokens = await saleContractRead.quote(currency, amount);
  return tokens.toString();
};

// Buy tokens (user calls this from frontend)
export const buyTokens = async (currency: string, amount: string, value?: string) => {
  if (!saleContractWrite) throw new Error("Wallet not configured");
  
  const tx = await saleContractWrite.buy(currency, amount, {
    value: value || "0",
  });
  return tx.hash;
};

// Listen to purchase events
export const listenToPurchases = (callback: (event: any) => void) => {
  saleContractRead.on("Purchased", callback);
  return () => saleContractRead.off("Purchased", callback);
};

// Get past purchase events
export const getPastPurchases = async (fromBlock: number, toBlock?: number) => {
  const filter = saleContractRead.filters.Purchased();
  const events = await saleContractRead.queryFilter(filter, fromBlock, toBlock);
  
  return events.map((event: any) => ({
    buyer: event.args.buyer,
    tokenAmount: event.args.tokenAmount.toString(),
    price: event.args.price.toString(),
    currency: event.args.currency,
    txHash: event.transactionHash,
    blockNumber: event.blockNumber,
  }));
};