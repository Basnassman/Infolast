export const CACHE_KEYS = {
  eligibility: (
    walletAddress: string
  ) =>
    `airdrop:eligibility:${walletAddress}`,

  proof: (
    walletAddress: string
  ) =>
    `airdrop:proof:${walletAddress}`,

  stats: () =>
    `airdrop:stats`,

  rebuildLock: () =>
    `lock:merkle:rebuild`,

  idempotency: (
    key: string
  ) =>
    `idempotency:${key}`,
};