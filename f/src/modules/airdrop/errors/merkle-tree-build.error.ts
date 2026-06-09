import { DomainError } from "@core/errors/base/domain-error";

export class MerkleTreeBuildError extends DomainError {
  constructor() {
    super(
      "MERKLE_TREE_BUILD_FAILED",
      "Unable to build Merkle tree",
      500
    );
  }
}