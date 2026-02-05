import routes from "./routes/index.js";
import { Hono } from "hono";
import { IHonoAppBinding, SideKickConfig } from "./types.js";
import { cors } from "hono/cors";
import { appInfo, setAccountType, setAppConfig } from "./config/app-config.js";
import {
  setCurrency,
  setFaqs,
  setFreePlan,
  setPremiumPlans,
} from "./routes/paid-plans/subscription-utils.js";
import { setFeatureFlag } from "./routes/feature-flags/feature-flags.js";
import { updateRolesEnum } from "./utils/enums.js";

export const initSideKick = (config: SideKickConfig) => {
  // Set configuration
  setAppConfig(config.appInfo);
  setAccountType(config.accountType || {});

  const { subscriptions } = config;
  setCurrency(subscriptions.currency, subscriptions.currencySymbol);
  setFreePlan(subscriptions.freePlan);
  setPremiumPlans(subscriptions.premiumPlans);
  setFaqs(subscriptions.faqs);

  // setEmailConfig(config.emailConfig || null);
  // setSecret(config.secretConfig || {});
  setFeatureFlag(config.featureFlags || {});
  updateRolesEnum(config.rolesEnum || {});

  const honoApp = new Hono<IHonoAppBinding>();

  routes.get("/", (c) => {
    return c.json({
      title: `${appInfo.appName} API Portal`,
      message: `Welcome to the ${appInfo.appName} API portal!`,
    });
  });

  honoApp.use(cors({ origin: config.cors.allowedOrigins }));
  honoApp.route("/", routes);

  // Global Rate Limiting
  // const limiter = rateLimit({
  //   windowMs: 15 * 60 * 1000, // 15 minutes
  //   limit: 1000, // Limit each IP to 100 requests per windowMs
  //   standardHeaders: "draft-7", // Use standard headers for rate limit info
  //   legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  //   message: {
  //     errorMsg: "Too many requests from this IP, please try again.",
  //     solution:
  //       "Please slow down your requests or contact support if you believe this is an error.",
  //   },
  // });
  // expressApp.use(limiter);

  // Configure CORS
  // const corsConfiguration = corsConfig(config.cors.allowedOrigins);

  // // 404 handler for unmatched routes
  // honoApp.use((req, res, next) => {
  //   const err: any = new Error("Invalid API endpoint.");
  //   next(err);
  // });

  // // Error handler (must be last)
  // honoApp.use(errorHandler);

  // Initialize socket io (if needed)
  // initSocketIO(httpServer, corsConfiguration);

  return honoApp;
};

export type {
  SideKickConfig,
  AppInfo,
  CorsConfig,
  JwtConfig,
} from "./types.js";
export * from "./utils/index.js";
export * from "./routes/orgs/index.js";
export * from "./utils/local-cache.js";
// export * from "./ai/index.js";
export * from "./r2-buckets/index.js";
export { getCurrencySymbol } from "./routes/paid-plans/subscription-utils.js";
export type { Plan } from "./routes/paid-plans/billingsdk-config.js";
