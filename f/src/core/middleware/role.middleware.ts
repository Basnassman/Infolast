import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  ApiError,
} from "@core/contracts-api/error.contract";

import {
  isAdmin,
  isGov,
  isOperator,
  isDepositor,
} from "@core/auth/role.service";

export type RoleType =
  | "ADMIN"
  | "GOV"
  | "OPERATOR"
  | "DEPOSITOR";

const roleResolvers = {
  ADMIN: isAdmin,

  GOV: isGov,

  OPERATOR:
    isOperator,

  DEPOSITOR:
    isDepositor,
};

export const requireRole =
  (
    role: RoleType
  ) => {
    return async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const walletAddress =
          req.walletAddress;

        if (
          !walletAddress
        ) {
          const response: ApiError =
            {
              success: false,

              error: {
                code:
                  "UNAUTHORIZED",

                message:
                  "Authentication required",
              },
            };

          return res
            .status(401)
            .json(
              response
            );
        }

        const checker =
          roleResolvers[
            role
          ];

        const allowed =
          await checker(
            walletAddress
          );

        if (!allowed) {
          const response: ApiError =
            {
              success: false,

              error: {
                code:
                  "FORBIDDEN",

                message: `${role} role required`,
              },
            };

          return res
            .status(403)
            .json(
              response
            );
        }

        next();
      } catch (error: any) {
        const response: ApiError =
          {
            success: false,

            error: {
              code:
                "ROLE_CHECK_FAILED",

              message:
                error.message,
            },
          };

        return res
          .status(500)
          .json(response);
      }
    };
  };

export const requireAdmin =
  requireRole(
    "ADMIN"
  );

export const requireGov =
  requireRole(
    "GOV"
  );

export const requireOperator =
  requireRole(
    "OPERATOR"
  );

export const requireDepositor =
  requireRole(
    "DEPOSITOR"
  );