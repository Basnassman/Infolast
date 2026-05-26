import { taskQueue } from "@core/queue/queue";

export const enqueueTaskVerification =
  async (
    taskId: string,
    userId: string
  ) => {
    return await taskQueue.add(
      "task-verification",

      {
        taskId,
        userId,
      },

      {
        removeOnComplete: 100,

        removeOnFail: 50,
      }
    );
  };