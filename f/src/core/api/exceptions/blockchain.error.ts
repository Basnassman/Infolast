import { AppError } from "./app.error";

export class BlockchainError extends AppError {
  constructor(message = "Blockchain error") {
    super("BLOCKCHAIN_ERROR", message, 502);
  }
}

export default BlockchainError;
