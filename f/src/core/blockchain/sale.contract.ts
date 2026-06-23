import { ethers } from "ethers";
import { wallet, provider, config } from "@core/blockchain/provider";
import SaleABI from "@core/abis/Sale";
import { ConfigurationError } from "@core/errors/infrastructure/configuration.error";

// ─── Lazy Contract Helpers ────────────────────────────────────────────────

function requireSaleAddress(): string {
  if (!config.sale) throw new ConfigurationError("SALE_ADDRESS env variable is not configured");
  return config.sale;
}

// ─── Read-only Contract (lazy via Proxy) ───────────────────────────────────

let _saleContractRead: ethers.Contract | null = null;

function _getSaleContractRead(): ethers.Contract {
  if (!_saleContractRead) {
    _saleContractRead = new ethers.Contract(requireSaleAddress(), SaleABI, provider);
  }
  return _saleContractRead;
}

export const saleContractRead = new Proxy({} as ethers.Contract, {
  get(_target, prop) {
    return (_getSaleContractRead() as any)[prop];
  },
});

// ─── Write Contract (requires admin wallet) ─────────────────────────────────

let _saleContractWrite: ethers.Contract | null = null;
let _saleWriteInitialized = false;

function _getSaleContractWrite(): ethers.Contract | null {
  if (!wallet) return null;
  if (!_saleWriteInitialized) {
    _saleWriteInitialized = true;
    _saleContractWrite = new ethers.Contract(requireSaleAddress(), SaleABI, wallet);
  }
  return _saleContractWrite;
}

export function getSaleContractWrite(): ethers.Contract | null {
  return _getSaleContractWrite();
}


// ─── Sale Info ──────────────────────────────────────────────────────────────

export const getSaleInfo = async () => {
  const [
    token,
    priceOracle,
    vesting,
    treasury,
    saleStart,
    saleEnd,
    saleCap,
    totalSold,
    minPurchase,
    walletCap,
    paused,
    finalized,
  ] = await Promise.all([
    saleContractRead.token(),
    saleContractRead.priceOracle(),
    saleContractRead.vesting(),
    saleContractRead.treasury(),
    saleContractRead.saleStart(),
    saleContractRead.saleEnd(),
    saleContractRead.saleCap(),
    saleContractRead.totalSold(),
    saleContractRead.minPurchase(),
    saleContractRead.walletCap(),
    saleContractRead.paused(),
    saleContractRead.finalized(),
  ]);

  return {
    token,
    priceOracle,
    vesting,
    treasury,
    saleStart: Number(saleStart),
    saleEnd: Number(saleEnd),
    saleCap: saleCap.toString(),
    totalSold: totalSold.toString(),
    minPurchase: minPurchase.toString(),
    walletCap: walletCap.toString(),
    paused,
    finalized,
    address: config.sale,
  };
};

// ─── User Purchase Info ─────────────────────────────────────────────────────

export const getUserBought = async (address: string): Promise<string> => {
  const bought = await saleContractRead.bought(address);
  return bought.toString();
};

export const getUserLastBuy = async (address: string): Promise<number> => {
  const lastBuy = await saleContractRead.lastBuy(address);
  return Number(lastBuy);
};

// ─── Buy Tokens ─────────────────────────────────────────────────────────────

export const buyTokensETH = async (value: string): Promise<string> => {
  const contract = getSaleContractWrite();
  if (!contract) throw new ConfigurationError("Wallet not configured");
  const tx = await contract.buyETH({ value });
  return tx.hash;
};

export const buyTokensERC20 = async (
  currency: string,
  amount: string
): Promise<string> => {
  const contract = getSaleContractWrite();
  if (!contract) throw new ConfigurationError("Wallet not configured");
  const tx = await contract.buyToken(currency, amount);
  return tx.hash;
};

// ─── Events: Purchased(address indexed user, address indexed currency, uint256 paid, uint256 tokens) ──

export type PurchasedEvent = {
  user: string;
  currency: string;
  paid: bigint;
  tokens: bigint;
  txHash: string;
  blockNumber: number;
  blockHash: string;
  logIndex: number;
};

export const getPastPurchases = async (
  fromBlock: number,
  toBlock?: number
): Promise<PurchasedEvent[]> => {
  const filter = saleContractRead.filters.Purchased();
  const events = await saleContractRead.queryFilter(filter, fromBlock, toBlock);

  return events.map((event: any) => ({
    user: event.args.user,
    currency: event.args.currency,
    paid: event.args.paid,
    tokens: event.args.tokens,
    txHash: event.transactionHash,
    blockNumber: event.blockNumber,
    blockHash: event.blockHash,
    logIndex: event.logIndex,
  }));
};

export const getLatestBlockNumber = async (): Promise<number> => {
  return provider.getBlockNumber();
};
