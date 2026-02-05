import { Hono } from "hono";
import logger from "../../utils/error-logger.js";
import {
  getResponseObj,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../utils/response-utils.js";
import {
  CURRENCY,
  CURRENCY_SYMBOL,
  faqs,
  freePurchasedPlan,
  plans,
} from "./subscription-utils.js";
import { IHonoAppBinding } from "../../types.js";

const getSubscriptionConfigRouter = new Hono<IHonoAppBinding>();

getSubscriptionConfigRouter.get("/", (c) => {
  try {
    return sendSuccessResponse(
      c,
      getResponseObj({
        plans,
        freePurchasedPlan,
        CURRENCY_SYMBOL,
        CURRENCY,
        faqs,
      }),
    );
  } catch (error: any) {
    logger.error("Error while returning plans:", error);
    return throwErrorInResponseIfErrorIsNotCustom(c, error, {
      errorMsg: "An error occurred while fetching countries.",
      solution:
        "Please try again later or contact support if the issue persists.",
    });
  }
});

export default getSubscriptionConfigRouter;
