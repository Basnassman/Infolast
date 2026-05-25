import { Request, Response, NextFunction } from "express";

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number;      // Max requests per window
}

const requests = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (options: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const windowStart = now - options.windowMs;

    const record = requests.get(key);

    if (!record || record.resetTime < now) {
      requests.set(key, { count: 1, resetTime: now + options.windowMs });
      return next();
    }

    if (record.count >= options.max) {
      return res.status(429).json({
        error: "Too many requests",
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    record.count++;
    next();
  };
};