import {
  Response,
} from "express";

import {
  ApiSuccess,
} from "../../contracts/api-response.contract";

export const successResponse =
  <T>(
    res: Response,
    data: T,
    statusCode = 200
  ) => {
    const response: ApiSuccess<T> =
      {
        success: true,

        data,
      };

    return res
      .status(
        statusCode
      )
      .json(
        response
      );
  };

export const createdResponse =
  <T>(
    res: Response,
    data: T
  ) => {
    return successResponse(
      res,
      data,
      201
    );
  };

export const emptyResponse =
  (
    res: Response
  ) => {
    return res
      .status(204)
      .send();
  };