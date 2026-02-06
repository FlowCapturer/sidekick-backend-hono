import { Hono } from "hono";
import { verifyToken } from "../utils/common-utils.js";
import logger from "../utils/error-logger.js";
import {
  getErrorResponseObj,
  sendErrorResponse,
} from "../utils/response-utils.js";
import checkSessionRouter from "./authentication/check-session.js";
import loginRouter from "./authentication/login-router.js";
import resetPasswordRouter from "./authentication/reset-password.js";
import sendOTPRouterRouter from "./authentication/send-otp-router.js";
import userProfileRouter from "./authentication/user-profile.js";
import userRegistrationRouter from "./authentication/user-registration-router.js";
import countriesRouter from "./countries/countries-router.js";
import featureFlagsRouter, {
  getFeatureFlags,
} from "./feature-flags/feature-flags.js";
import linkMetadataRouter from "./link-metadata.js";
import invitationRouter from "./orgs/invitation.js";
import orgMembersRouter from "./orgs/org-members/org-members.js";
import orgRegistrationRouter from "./orgs/org-registration-router.js";
import getSubscriptionConfigRouter from "./paid-plans/get-subscription-config.js";
import paymentGateWayRouter from "./paid-plans/payment-gateway.js";
import purchasedPlansRouter from "./paid-plans/purchased-plans.js";
import { IHonoAppBinding } from "../types.js";
import { createMiddleware } from "hono/factory";

const routes = new Hono<IHonoAppBinding>();

const middleWare = createMiddleware<IHonoAppBinding>(async (c, next) => {
  const api = (c.req.header("api") || "").toString();
  let userObj = null;

  try {
    if (!api) {
      throw "API_EMPTY";
    }

    userObj = await verifyToken(api);

    if (!userObj) {
      //Pass error object
      throw "UNAUTH";
    } //if..

    //Here means session exists, this userObj contains { id and email }
    c.set("user", userObj);

    await next();
  } catch (error: any) {
    let commonError = getErrorResponseObj(
      {
        errorMsg: "An uncaught error occurred!",
        solution: "Please log in and try again.",
      },
      error,
    );

    if (error === "API_EMPTY") {
      commonError = getErrorResponseObj({
        errorMsg: "You are not logged in.",
        solution: "Please log in and try again.",
      });
    } else if (error === "UNAUTH") {
      commonError = getErrorResponseObj(
        {
          errorMsg:
            "You have been logged out because your session has expired.",
          solution: "Please log in and try again.",
        },
        error,
      );
    } else {
      logger.error("An uncaught error occurred", error);
    }

    return sendErrorResponse(c, commonError);
  }
});

// login does not requires for below APIs
routes.route("/send-otp", sendOTPRouterRouter);
routes.route("/user-registration", userRegistrationRouter);
routes.route("/login", loginRouter);
routes.route("/reset-password", resetPasswordRouter);

if (getFeatureFlags().ff_enable_paid_subscription) {
  routes.route("/get-subscription-config", getSubscriptionConfigRouter);
}
routes.route("/feature-flags", featureFlagsRouter);

// Apply middleware for protected routes
routes.use("*", middleWare);

// login required for below APIs
routes.route("/check-session", checkSessionRouter);

if (getFeatureFlags().ff_enable_teams) {
  routes.route("/organization", orgRegistrationRouter);
  routes.route("/invitation", invitationRouter);
  routes.route("/org-member", orgMembersRouter);
}

routes.route("/get-countries", countriesRouter);
routes.route("/user-profile", userProfileRouter);
routes.route("/link-metadata", linkMetadataRouter);

if (getFeatureFlags().ff_enable_paid_subscription) {
  routes.route("/payment-gateway", paymentGateWayRouter);
  routes.route("/purchased-plans", purchasedPlansRouter);
}

export default routes;
