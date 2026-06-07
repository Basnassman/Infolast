import { CronJob } from "cron";
import { cronRebuild } from "../../modules/airdrop/workers/rebuild.worker";

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
    console.log("[Cron] Skipping cron jobs on worker instance");
    return;
  }

  console.log("[Cron] Initializing scheduled jobs...");

  // Merkle rebuild: Every hour
  // Change to '0 */6 * * *' for every 6 hours in production
  merkleCronJob = new CronJob(
    "0 */5 * * * *", // Every hour at minute 0
    async () => {
      console.log("[Cron] ⏰ Hourly Merkle rebuild triggered");
      try {
        const result = await cronRebuild();
        if ("skipped" in result) {
          console.log("[Cron] ⏭️ No changes detected");
        } else {
          console.log(`[Cron] ✅ Rebuild completed: ${result.success}`);
        }
      } catch (error: any) {
        console.error("[Cron] ❌ Rebuild failed:", error.message);
      }
    },
    null, // onComplete
    true, // start immediately
    "UTC" // timezone
  );

  console.log("[Cron] ✅ Merkle rebuild scheduled every hour");
};

/**
 * Stop all cron jobs
 */
export const stopCronJobs = () => {
  if (merkleCronJob) {
    merkleCronJob.stop();
    console.log("[Cron] 🛑 Jobs stopped");
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