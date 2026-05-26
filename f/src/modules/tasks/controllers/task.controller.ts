// src/modules/tasks/controllers/task.controller.ts

import {
  Request,
  Response,
} from "express";

import {
  asyncHandler,
} from "../../../core/utils/async-handler";

import {
  buildSuccessResponse,
} from "../../../core/responses/success.response";

import {
  normalizeTask,
  normalizeTaskSubmission,
} from "../normalizers/task.normalizer";

import {
  getAvailableTasks,
  submitTask,
  getUserTaskHistory,
} from "../services/task.service";

export const getTasksController =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const walletAddress =
        String(
          req.query.walletAddress
        );

      const tasks =
        await getAvailableTasks(
          walletAddress
        );

      return res.json(
        buildSuccessResponse(
          tasks.map(normalizeTask)
        )
      );
    }
  );

export const submitTaskController =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const result =
        await submitTask(
          req.body
        );

      return res.json(
        buildSuccessResponse(
          normalizeTaskSubmission(
            result
          )
        )
      );
    }
  );

export const getTaskHistoryController =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const walletAddress =
        String(
          req.params.walletAddress
        );

      const history =
        await getUserTaskHistory(
          walletAddress
        );

      return res.json(
        buildSuccessResponse(
          history.map(
            normalizeTaskSubmission
          )
        )
      );
    }
  );