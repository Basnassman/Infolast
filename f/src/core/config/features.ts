import { env } from "./env";

export const FEATURES = {
  ANTI_SYBIL:      env.features.antiSybil,
  EMERGENCY_PAUSE:  env.features.emergencyPause,
};