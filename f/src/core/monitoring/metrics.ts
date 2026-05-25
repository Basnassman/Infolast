import { Request, Response, NextFunction } from "express";

let totalRequests = 0;
let failedRequests = 0;
let successfulClaims = 0;

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  totalRequests++;

  res.on("finish", () => {
    if (res.statusCode >= 400) {
      failedRequests++;
    }
  });

  next();
};

export const incrementClaimSuccess = () => {
  successfulClaims++;
};

export const getMetrics = () => {
  return {
    totalRequests,
    failedRequests,
    successfulClaims,
  };
};