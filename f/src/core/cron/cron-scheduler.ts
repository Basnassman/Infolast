import { CronJob } from "cron";
import { cronRebuild } from "../../modules/airdrop/workers/rebuild.worker";
import { logger } from "@core/logger/logger";

/**
 * 🕐 Cron Scheduler
 * 
 * Schedules recurring Merkle rebuild jobs
 * 
 * IMPORTANT: In production with clustering (PM2), 
 * ensure only ONE instance runs the cron job.
 * Use NODE_APP_INSTANCE=0 check.
 */

let merkleCronJob: CronJob | null = null;

/**
 * Initialize cron jobs
 */
export const initCronJobs = () => {
  // Prevent multiple instances in cluster mode
  if (process.env.NODE_APP_INSTANCE && process.env.NODE_APP_INSTANCE !== "0") {
    logger.info("[Cron] Skipping cron jobs on worker instance");
    return;
  }

  logger.info("[Cron] Initializing scheduled jobs...");

  // Merkle rebuild: Every hour
  // Change to '0 */6 * * *' for every 6 hours in production
  merkleCronJob = new CronJob(
    "0 0 * * * *", // Every hour at minute 0
    async () => {
      logger.info("[Cron] Hourly Merkle rebuild triggered");
      try {
        const result = await cronRebuild();
        if ("skipped" in result) {
          console.log("[Cron] ⏭️ No changes detected");
        } 
          if (!result.success) {
          logger.error({ error: result.error }, "[Cron] Rebuild error");
      }
      } catch (error: any) {
        logger.error({ err: error }, "[Cron] Rebuild failed");
      }
    },
    null, // onComplete
    true, // start immediately
    "UTC" // timezone
  );

  logger.info("[Cron] Merkle rebuild scheduled every hour");
};

/**
 * Stop all cron jobs
 */
export const stopCronJobs = () => {
  if (merkleCronJob) {
    merkleCronJob.stop();
    logger.info("[Cron] Jobs stopped");
  }
};

/**
 * Get cron job status
 */
export const getCronStatus = () => {
  return {
    merkleRebuild: {
      isActive: merkleCronJob?.isActive ?? false,
      nextRun: merkleCronJob ? new Date(merkleCronJob.nextDate().toString()) : null,
    },
  };
};