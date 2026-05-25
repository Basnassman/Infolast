import { parseUnits, formatUnits } from "ethers";
import {
  AllocationInput,
  AllocationResult,
} from "../domain/airdrop.types";

const DECIMALS = 18;

const BASE_RATE = 10;

const MAX_POINTS = 1_000_000;

export const normalizePoints = (
  points: number
): number => {
  if (!Number.isFinite(points)) {
    return 0;
  }

  return Math.max(0, Math.floor(points));
};

export const resolveMultiplier = (
  totalPurchasedUsd?: number
): number => {
  if (!totalPurchasedUsd || totalPurchasedUsd <= 0) {
    return 1;
  }

  if (totalPurchasedUsd >= 10000) {
    return 1.5;
  }

  if (totalPurchasedUsd >= 5000) {
    return 1.3;
  }

  if (totalPurchasedUsd >= 1000) {
    return 1.2;
  }

  return 1;
};

export const validateAllocationInput = (
  input: AllocationInput
): AllocationResult | null => {
  const points =
    normalizePoints(input.points);

  if (!input.walletAddress) {
    return {
      eligible: false,
      points,
      allocationTokens: "0",
      allocationWei: "0",
      multiplier: 1,
      reason: "Wallet address missing",
    };
  }

  if (points <= 0) {
    return {
      eligible: false,
      points,
      allocationTokens: "0",
      allocationWei: "0",
      multiplier: 1,
      reason: "No points",
    };
  }

  if (points > MAX_POINTS) {
    return {
      eligible: false,
      points,
      allocationTokens: "0",
      allocationWei: "0",
      multiplier: 1,
      reason: "Points exceed limit",
    };
  }

  return null;
};

export const calculateAllocation = (
  input: AllocationInput
): AllocationResult => {
  const validation =
    validateAllocationInput(input);

  if (validation) {
    return validation;
  }

  const points =
    normalizePoints(input.points);

  const multiplier =
    resolveMultiplier(
      input.totalPurchasedUsd
    );

  const rawTokens =
    (points / BASE_RATE) * multiplier;

  const allocationTokens =
    Math.floor(rawTokens).toString();

  const allocationWei =
    parseUnits(
      allocationTokens,
      DECIMALS
    ).toString();

  return {
    eligible: true,
    points,
    allocationTokens,
    allocationWei,
    multiplier,
    reason: null,
  };
};

export const fromWei = (
  value: string
): string => {
  return formatUnits(value, DECIMALS);
};