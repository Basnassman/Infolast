import {
  Response,
} from "express";

import {
  PaginationMeta,
} from "@core/contracts-api/pagination.contract";

export type PaginatedSuccess<T> =
  {
    success: true;

    data: T[];

    pagination: PaginationMeta;
  };

export const paginatedResponse =
  <T>(
    res: Response,
    data: T[],
    pagination: PaginationMeta,
    statusCode = 200
  ) => {
    const response: PaginatedSuccess<T> =
      {
        success: true,

        data,

        pagination,
      };

    return res
      .status(
        statusCode
      )
      .json(
        response
      );
  };