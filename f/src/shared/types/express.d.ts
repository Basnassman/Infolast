import "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;

      auth: {
        walletAddress: string;
      };
    }
  }
}

export {};