// src/config/features.ts
export const FEATURES = {
  ANTI_SYBIL: process.env.ENABLE_SYBIL === "true",
  EMERGENCY_PAUSE: process.env.ENABLE_PAUSE === "true",
};