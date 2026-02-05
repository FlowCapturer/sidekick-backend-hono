import { Hono, Context } from "hono";
import { getSingletonCacheInstance } from "../../utils/local-cache.js";
import { IHonoAppBinding, purchasedPlansInf } from "../../types.js";
import { convertServerDateToJS, isValidId } from "../../utils/common-utils.js";
import logger from "../../utils/error-logger.js";
import {
  getErrorResponseObj,
  getResponseObj,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../utils/response-utils.js";
import { executeSql, initializeConnection } from "../../utils/sql-helper.js";
import { freePurchasedPlan } from "./subscription-utils.js";

const purchasedPlansRouter = new Hono<IHonoAppBinding>();
const purchasedPlansCache = await getSingletonCacheInstance(
  "purchased-plans-cache",
  100,
);
// Map to track in-flight database queries for purchased plans
const loadingPurchasedPlansFor = new Map<number, Promise<any>>();

export const invalidatePurchasedPlansCacheForUser = async (userId: number) => {
  const cacheKey = `purchasedPlans_user_${userId}`;
  await purchasedPlansCache.del(cacheKey);
  loadingPurchasedPlansFor.delete(userId);
};

const getUpdatedPurchasedPlans = async (
  p_userId: number | string,
  c: Context<IHonoAppBinding>,
) => {
  try {
    const userId = Number(p_userId);

    if (!isValidId(userId)) {
      throw getErrorResponseObj({
        errorMsg: "It seems like you are not logged in",
      });
    }

    const updatedPurchasedPlansSql = `SELECT u.purchased_id, u.updated_at, u.for_no_users, t.status, t.amount,
                                      t.z_order_id, t.z_payment_id, t.z_payment_at, t.z_currency, t.z_payment_method
                                      FROM b_updated_plans u INNER JOIN b_transactions t ON u.transaction_id = t.transaction_id 
                                      WHERE u.user_id = ${userId} AND t.status != 'idle' ORDER BY u.updated_plan_id DESC;`;

    const updatedPlansResult = await executeSql(updatedPurchasedPlansSql, c);
    return updatedPlansResult;
  } catch (error: any) {
    logger.error("Error in getUpdatedPurchasedPlans function", error);
    throw getErrorResponseObj(
      {
        errorMsg: "An error occurred while retrieving updated purchased plans.",
        solution:
          "Please try again later or contact support if the issue persists.",
      },
      error,
    );
  }
};

const attachUpdatedPurchasedPlansToPurchasedPlans = async (
  purchasedPlans: purchasedPlansInf[],
  userId: number,
  c: Context<IHonoAppBinding>,
) => {
  const updatedPurchasedPlans: any = await getUpdatedPurchasedPlans(userId, c);

  if (!updatedPurchasedPlans || updatedPurchasedPlans.length === 0)
    return purchasedPlans;

  updatedPurchasedPlans.sort((a: any, b: any) => {
    const dateA = new Date(a.updated_at).getTime();
    const dateB = new Date(b.updated_at).getTime();
    return dateA - dateB;
  });

  updatedPurchasedPlans.forEach((updatedPlan: any) => {
    // if (updatedPlan.status !== 'paid') return;

    const planIndex = purchasedPlans.findIndex(
      (p: purchasedPlansInf) => p.purchased_id === updatedPlan.purchased_id,
    );
    if (planIndex < 0) {
      return;
    }

    const record = purchasedPlans[planIndex];

    if (updatedPlan.status === "paid") {
      record.for_no_users =
        Number(updatedPlan.for_no_users) + Number(record.for_no_users);
    }

    record.updatedRecords = record.updatedRecords || [];
    record.updatedRecords.push(updatedPlan);

    purchasedPlans[planIndex] = record;
  });

  return purchasedPlans;
};

const processPurchasedPlansData = (purchasedPlans: purchasedPlansInf[]) => {
  // Sort plans by purchased_at to ensure proper chronological chaining
  purchasedPlans.sort((a: purchasedPlansInf, b: purchasedPlansInf) => {
    const dateA = new Date(a.purchased_at).getTime();
    const dateB = new Date(b.purchased_at).getTime();
    return dateA - dateB;
  });

  // Chain plans together: each plan starts when the previous one ends
  // BUT only if the previous plan hasn't expired yet
  let previousEndDate: Date | null = null;

  purchasedPlans.forEach((plan: purchasedPlansInf) => {
    if (plan.status !== "paid") return;

    const purchasedAt = convertServerDateToJS(plan.purchased_at);

    if (previousEndDate === null) {
      // First plan: starts at purchased_at
      plan.startAt = purchasedAt;
    } else if (previousEndDate > purchasedAt) {
      // Previous plan is still active/future: chain this plan to start when previous ends
      plan.startAt = new Date(previousEndDate);
    } else {
      // Previous plan has already ended: start fresh from purchased_at
      plan.startAt = purchasedAt;
    }

    // Calculate end date: startAt + for_months
    plan.endAt = new Date(plan.startAt);
    plan.endAt.setMonth(plan.endAt.getMonth() + plan.for_months);

    // Update previousEndDate for the next iteration
    previousEndDate = plan.endAt;
  });

  return purchasedPlans;
};

/**
 * Fetches purchased plans from database and caches the result.
 */
const fetchAndCachePurchasedPlans = async (
  userId: number,
  c: Context<IHonoAppBinding>,
) => {
  try {
    const purchasedPlanSql = `SELECT p.plan_id, p.purchased_id, p.purchased_at, p.for_months, p.for_no_users, p.for_no_users as old_purchased_for_no_users,
                               t.status, t.amount, t.z_order_id, t.z_payment_id, t.z_payment_at, t.z_currency, t.z_payment_method,
                               p.y_billing_name, p.y_billing_country, p.y_billing_address, p.y_billing_email, p.y_billing_contact_no
                               FROM b_purchased_plans p INNER JOIN b_transactions t ON p.transaction_id = t.transaction_id 
                               WHERE p.user_id = ${userId} AND t.status != 'idle' ORDER BY p.purchased_id DESC;`;

    const purchasedPlans: any = await executeSql(purchasedPlanSql, c);
    const processedPlans = processPurchasedPlansData(purchasedPlans);
    const updatedPurchasedPlans =
      await attachUpdatedPurchasedPlansToPurchasedPlans(
        processedPlans,
        userId,
        c,
      );

    const cacheKey = `purchasedPlans_user_${userId}`;
    await purchasedPlansCache.set(cacheKey, updatedPurchasedPlans || []);

    return updatedPurchasedPlans;
  } finally {
    // Clean up the promise from the map once completed
    loadingPurchasedPlansFor.delete(userId);
  }
};

export const getPurchasedPlans = async (
  p_userId: number | string,
  c: Context<IHonoAppBinding>,
) => {
  try {
    const userId = Number(p_userId);

    if (!isValidId(userId)) {
      throw getErrorResponseObj({
        errorMsg: "It seems like you are not logged in",
      });
    }

    const cacheKey = `purchasedPlans_user_${userId}`;

    // Check cache first
    const cachedPurchasedPlans = await purchasedPlansCache.get(cacheKey);
    if (cachedPurchasedPlans) {
      console.log("Using cached purchased plans");
      return cachedPurchasedPlans;
    }
    console.log("Fetching purchased plans from database");

    // Check if there's already a query in progress for this user
    let plansPromise = loadingPurchasedPlansFor.get(userId);

    if (!plansPromise) {
      // No query in progress, create a new one
      plansPromise = fetchAndCachePurchasedPlans(userId, c);
      loadingPurchasedPlansFor.set(userId, plansPromise);
    }

    // Wait for the query to complete (either new or existing)
    return await plansPromise;
  } catch (error: any) {
    logger.error("Error in getPurchasedPlans function", error);
    throw getErrorResponseObj(
      {
        errorMsg: "An error occurred while retrieving purchased plans.",
        solution:
          "Please try again later or contact support if the issue persists.",
      },
      error,
    );
  }
};

// Retrieving an Active Plan
export const getActivePurchasedPlan = async (
  userId: number,
  c: Context<IHonoAppBinding>,
): Promise<purchasedPlansInf | typeof freePurchasedPlan> => {
  try {
    const purchasedPlans: purchasedPlansInf[] = await getPurchasedPlans(
      userId,
      c,
    );

    const currentDate = new Date();

    const activePlan = purchasedPlans.find((plan) => {
      if (plan.status !== "paid") return false;
      return (
        new Date(plan.startAt)! <= currentDate &&
        new Date(plan.endAt)! >= currentDate
      );
    });

    return activePlan || freePurchasedPlan;
  } catch (error: any) {
    logger.error("Error in getActivePurchasedPlan function", error);
    throw getErrorResponseObj(
      {
        errorMsg:
          "An error occurred while retrieving the active purchased plan.",
        solution:
          "Please try again later or contact support if the issue persists.",
      },
      error,
    );
  }
};

purchasedPlansRouter.get("/", async (c) => {
  return await initializeConnection(async () => {
    try {
      const user = c.get("user");
      const userId = user?.id;

      const purchasedPlans = await getPurchasedPlans(userId, c);
      const activePlan = await getActivePurchasedPlan(userId, c);

      return sendSuccessResponse(
        c,
        getResponseObj({ purchasedPlans, activePlan }),
      );
    } catch (error: any) {
      logger.error("Error in purchased-plans command", error);
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: "An error occurred while retrieving purchased plans.",
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }
  });
});

export default purchasedPlansRouter;
