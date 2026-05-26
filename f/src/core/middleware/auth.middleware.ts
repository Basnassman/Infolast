import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  authenticateWallet,
} from "@core/auth/wallet-auth.service";

import {
  ApiError,
} from "@core/contracts-api/error.contract";

declare global {
  namespace Express {
    interface Request {
      walletAddress?: string;
    }
  }
}

export const authenticate =
  (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const walletAddress =
        authenticateWallet(
          req
        );

      req.walletAddress =
        walletAddress;

      next();
    } catch (error: any) {
      const response: ApiError =
        {
          success: false,

          error: {
            code:
              "UNAUTHORIZED",

            message:
              error.message ||
              "Authentication failed",
          },
        };

      return res
        .status(401)
        .json(response);
    }
  };