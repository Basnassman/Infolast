import { rebuildQueue } from "@core/queue/queue";

export const enqueueRebuild =
  async () => {
    return await rebuildQueue.add(
      "rebuild",

      {
        triggeredAt:
          new Date(),
      },

      {
        removeOnComplete: 50,

        removeOnFail: 20,
      }
    );
  };