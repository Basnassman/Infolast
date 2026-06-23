import { ethers } from "ethers";
import { wallet, provider, config } from "@core/blockchain/provider";
import VestingABI from "@core/abis/Vesting";
import { ConfigurationError } from "@core/errors/infrastructure/configuration.error";

// ─── Lazy Contract Helpers ────────────────────────────────────────────────

const VESTING_MISSING = "VESTING_ADDRESS env variable is not configured";

function requireVestingAddress(): string {
  if (!config.vesting) throw new ConfigurationError(VESTING_MISSING);
  return config.vesting;
}

// ─── Read-only Contract (lazy via Proxy) ───────────────────────────────────

let _vestingContractRead: ethers.Contract | null = null;

function _getVestingContractRead(): ethers.Contract {
  if (!_vestingContractRead) {
    _vestingContractRead = new ethers.Contract(
      requireVestingAddress(),
      VestingABI,
      provider
    );
  }
  return _vestingContractRead;
}

// Backward-compatible — triggers lazy init only when any property is accessed
export const vestingContractRead = new Proxy({} as ethers.Contract, {
  get(_target, prop, _receiver) {
    return (_getVestingContractRead() as any)[prop];
  },
});

// ─── Write Contract (requires admin wallet + vesting address) ──────────────
// Kept as a nullable variable: null when wallet is missing.
// Lazy: only created when first called (not at module load).

let _vestingContractWrite: ethers.Contract | null = null;
let _vestingWriteInitialized = false;

function _getVestingContractWrite(): ethers.Contract | null {
  if (!wallet) return null;
  if (!_vestingWriteInitialized) {
    _vestingWriteInitialized = true;
    _vestingContractWrite = new ethers.Contract(
      requireVestingAddress(),
      VestingABI,
      wallet
    );
  }
  return _vestingContractWrite;
}

// Lazy write contract: evaluates lazily via getter only when accessed
export function getVestingContractWrite(): ethers.Contract | null {
  return _getVestingContractWrite();
}

// ─── Contract Info ──────────────────────────────────────────────────────────

export const getVestingInfo = async () => {
  const [token, treasury, startTime, totalAllocated, totalClaimed, paused] =
    await Promise.all([
      vestingContractRead.token(),
      vestingContractRead.treasury(),
      vestingContractRead.startTime(),
      vestingContractRead.totalAllocated(),
      vestingContractRead.totalClaimed(),
      vestingContractRead.paused(),
    ]);

  return {
    token,
    treasury,
    startTime: Number(startTime),
    totalAllocated: totalAllocated.toString(),
    totalClaimed: totalClaimed.toString(),
    paused,
    address: config.vesting,
  };
};

// ─── User Vesting Info ──────────────────────────────────────────────────────

export const getUserVesting = async (address: string) => {
  const [schedule, releasable] = await Promise.all([
    vestingContractRead.vesting(address),
    vestingContractRead.releasable(address),
  ]);

  return {
    total: schedule[0].toString(),
    claimed: schedule[1].toString(),
    releasable: releasable.toString(),
    remaining: (schedule[0] - schedule[1]).toString(),
  };
};

// ─── Constants ──────────────────────────────────────────────────────────────

export const getVestingConstants = async () => {
  const [cliff, month, totalStages, stageShare] = await Promise.all([
    vestingContractRead.CLIFF(),
    vestingContractRead.MONTH(),
    vestingContractRead.TOTAL_STAGES(),
    vestingContractRead.STAGE_SHARE(),
  ]);

  return {
    cliff: Number(cliff),
    month: Number(month),
    totalStages: Number(totalStages),
    stageShare: Number(stageShare),
  };
};

// ─── Events: Allocated(address user, uint256 amount) ───────────────────────

export type AllocatedEvent = {
  user: string;
  amount: bigint;
  txHash: string;
  blockNumber: number;
  blockHash: string;
  logIndex: number;
};

export const getPastAllocations = async (
  fromBlock: number,
  toBlock?: number
): Promise<AllocatedEvent[]> => {
  const filter = vestingContractRead.filters.Allocated();
  const events = await vestingContractRead.queryFilter(filter, fromBlock, toBlock);

  return events.map((event: any) => ({
    user: event.args.user,
    amount: event.args.amount,
    txHash: event.transactionHash,
    blockNumber: event.blockNumber,
    blockHash: event.blockHash,
    logIndex: event.logIndex,
  }));
};

// ─── Events: Claimed(address user, uint256 amount) ─────────────────────────

export type ClaimedEvent = {
  user: string;
  amount: bigint;
  txHash: string;
  blockNumber: number;
  blockHash: string;
  logIndex: number;
};

export const getPastClaims = async (
  fromBlock: number,
  toBlock?: number
): Promise<ClaimedEvent[]> => {
  const filter = vestingContractRead.filters.Claimed();
  const events = await vestingContractRead.queryFilter(filter, fromBlock, toBlock);

  return events.map((event: any) => ({
    user: event.args.user,
    amount: event.args.amount,
    txHash: event.transactionHash,
    blockNumber: event.blockNumber,
    blockHash: event.blockHash,
    logIndex: event.logIndex,
  }));
};

// ─── Latest Block ───────────────────────────────────────────────────────────

export const getLatestBlockNumber = async (): Promise<number> => {
  return provider.getBlockNumber();
};

// ─── Write Operations ───────────────────────────────────────────────────────

export const claimVesting = async () => {
  const contract = getVestingContractWrite();
  if (!contract) throw new ConfigurationError("Wallet not configured");
  const tx = await contract.claim();
  return tx.hash;
};

export const allocateVesting = async (user: string, amount: string) => {
  const contract = getVestingContractWrite();
  if (!contract) throw new ConfigurationError("Admin wallet not configured");
  const tx = await contract.allocate(user, amount);
  return tx.hash;
};

export const depositTokens = async (amount: string) => {
  const contract = getVestingContractWrite();
  if (!contract) throw new ConfigurationError("Admin wallet not configured");
  const tx = await contract.deposit(amount);
  return tx.hash;
};