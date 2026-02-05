import type { Context } from "hono";
import { isCustomError } from "./common-utils.js";
import { ErrorMsgs, ErrorResponse, SuccessResponse } from "./type.js";

export const getResponseObj = (response: object): SuccessResponse => {
  return {
    success: true,
    response,
  };
};

export const getErrorResponseObj = (
  errorMsgs: ErrorMsgs,
  error?: object,
): ErrorResponse => {
  return {
    success: false,
    error: {
      errorMsg: errorMsgs.errorMsg || "",
      solution: errorMsgs.solution || "",
      error: {
        ...(error || {}),
      },
    },
  };
};

export const sendSuccessResponse = (
  c: Context,
  responseObj: SuccessResponse,
) => {
  return c.json(responseObj);
};

export const sendErrorResponse = (c: Context, responseObj: ErrorResponse) => {
  return c.json(responseObj, 403);
};

export const throwErrorInResponseIfErrorIsNotCustom = (
  c: Context | null,
  errorObj: ErrorResponse | any,
  defaultErrorMsgs: ErrorMsgs,
) => {
  const errorMsg = {
    ...defaultErrorMsgs,
    errorMsg: (errorObj && errorObj?.message) || defaultErrorMsgs.errorMsg,
  };

  const responseError =
    errorObj && isCustomError(errorObj)
      ? errorObj
      : getErrorResponseObj(errorMsg, errorObj);

  //here, error means always in correct format.
  if (c) return sendErrorResponse(c, responseError);

  return responseError;
};
