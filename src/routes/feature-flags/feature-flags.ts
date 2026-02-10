import { Hono } from "hono";
import logger from "../../utils/error-logger.js";
import {
  getResponseObj,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../utils/response-utils.js";
import { IHonoAppBinding } from "../../types.js";

const featureFlags = {
  ff_enable_paid_subscription: true,
  ff_enable_teams: true,
  ff_enable_email_related_features: true,
};

export const setFeatureFlag = (flags: any): void => {
  Object.assign(featureFlags, flags);
};

export const getFeatureFlags = (): any => {
  return featureFlags;
};

const app = new Hono<IHonoAppBinding>();

app.get("/", async (c) => {
  try {
    return sendSuccessResponse(c, getResponseObj({ featureFlags }));
  } catch (error: any) {
    logger.error("Error while returning feature flags:", error);

    return throwErrorInResponseIfErrorIsNotCustom(c, error, {
      errorMsg: "An error occurred returning feature flags.",
      solution:
        "Please try again later or contact support if the issue persists.",
    });
  }
});

export default app;
