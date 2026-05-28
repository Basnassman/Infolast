/// <reference types="express" />

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      walletAddress?: string;
    }
  }
}

export {};
