// src/modules/admin/controllers/admin.controller.ts

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
  normalizeMerkleRoot,
} from "../../airdrop/normalizers/merkle.normalizer";

import {
  rebuildAndSync,
} from "../../airdrop/workers/rebuild.worker";

import {
  getLatestMerkleRoot,
} from "../../airdrop/repositories/merkle-root.repository";

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

      return res.json(
        buildSuccessResponse(
          normalizeMerkleRoot(
            result
          )
        )
      );
    }
  );

export const getLatestRootController =
  asyncHandler(
    async (
      _req: Request,
      res: Response
    ) => {
      const root =
        await getLatestMerkleRoot();

      return res.json(
        buildSuccessResponse(
          normalizeMerkleRoot(
            root
          )
        )
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

      return res.json(
        buildSuccessResponse(
          jobs
        )
      );
    }
  );