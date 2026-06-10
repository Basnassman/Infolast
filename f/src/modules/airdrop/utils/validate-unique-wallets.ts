import { AirdropEntry } from "../merkle/tree.service";
import { normalizeWallet } from "@modules/airdrop/merkle/hash.service";
import { DuplicateWalletError } from "@core/errors/domain/airdrop/duplicate-wallet.error";

export const validateUniqueWallets = (
  entries: AirdropEntry[]
): void => {
  const wallets =
    new Set<string>();

  for (const entry of entries) {
    const normalized =
      normalizeWallet(
        entry.walletAddress
      );

    if (wallets.has(normalized)) {
      throw new DuplicateWalletError(
        normalized
      );
    }

    wallets.add(normalized);
  }
};