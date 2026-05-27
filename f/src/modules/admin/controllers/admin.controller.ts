// src/modules/admin/controllers/admin.controller.ts

import {
  Request,
  Response,
} from "express";

import {
  asyncHandler,
} from "@core/utils/async-handler";

import {
  successResponse,
} from "@core/api/responses/success.response";

import {
  normalizeMerkleRoot,
} from "@core/api/normalizers/merkle.normalizer";

import {
  rebuildAndSync,
} from "@modules/airdrop/workers/rebuild.worker";

import {
  getActiveMerkleRoot,
} from "@modules/airdrop/repositories/merkle-root.repository";

import {
  getMerkleJobs,
} from "../services/admin.service";

export const rebuildMerkleController =
  asyncHandler(
    async (
      _req: Request,
      res: Response
    ) => {
      const result =
        await rebuildAndSync();

      return successResponse(
        res,
        result
      );
    }
  );

export const getLatestRootController =
  asyncHandler(
    async (
      _req: Request,
      res: Response
    ) => {
      const root = await getActiveMerkleRoot();

      return successResponse(
        res,
        root
      );
    }
  );

export const getMerkleJobsController =
  asyncHandler(
    async (
      _req: Request,
      res: Response
    ) => {
      const jobs =
        await getMerkleJobs();

      return successResponse(
        res,
        jobs
      );
    }
  );