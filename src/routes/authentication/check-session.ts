import { Context, Hono } from "hono";

import { getSingletonCacheInstance } from "../../utils/local-cache.js";
import { isValidId } from "../../utils/common-utils.js";
import logger from "../../utils/error-logger.js";
import {
  getErrorResponseObj,
  getResponseObj,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../utils/response-utils.js";
import { executeSql, initializeConnection } from "../../utils/sql-helper.js";
import { IHonoAppBinding } from "../../types.js";

const localSessionCache = getSingletonCacheInstance("active-users-cache", 100);

// Map to track in-flight database queries for users
const loadingExecuteFor = new Map<number, Promise<any>>();
const checkSessionRouter = new Hono<IHonoAppBinding>();

export const invalidateSessionCacheForUser = async (userId: number) => {
  const cacheKey = `user_${userId}`;
  await localSessionCache.del(cacheKey);
  // Also clear any in-flight requests for this user
  loadingExecuteFor.delete(userId);
};

/**
 * Fetches user from database and caches the result.
 */
const fetchAndCacheUser = async (
  userId: number,
  c: Context<IHonoAppBinding>,
) => {
  try {
    const userSql = `SELECT user_email, user_mobile_no, user_fname, user_lname, user_id FROM auth_users_tbl WHERE user_id = ${userId} AND user_is_active = 1;`;
    const userResult = await executeSql(userSql, c);
    const user = userResult[0] || null;

    await localSessionCache.set(`user_${userId}`, user);
    return user;
  } finally {
    // Clean up the promise from the map once completed
    loadingExecuteFor.delete(userId);
  }
};

/**
 * Fetches user session data with caching and deduplication.
 * Prevents duplicate database calls for the same user when concurrent requests arrive.
 */
const getSessionUser = async (userId: number, c: Context<IHonoAppBinding>) => {
  // Check cache first
  const cachedUser = await localSessionCache.get(`user_${userId}`);
  if (cachedUser !== undefined) {
    return cachedUser;
  }

  // Check if there's already a query in progress for this user
  let userPromise = loadingExecuteFor.get(userId);

  if (!userPromise) {
    // No query in progress, create a new one
    userPromise = fetchAndCacheUser(userId, c);
    loadingExecuteFor.set(userId, userPromise);
  }

  // Wait for the query to complete (either new or existing)
  return await userPromise;
};

checkSessionRouter.get("/", async (c) => {
  return await initializeConnection(async () => {
    try {
      const user = c.get("user");
      const userId = user?.id;
      if (!isValidId(userId)) {
        throw getErrorResponseObj({
          errorMsg: "It seems like you are not logged in",
        });
      }

      const sessionUser = await getSessionUser(userId, c);

      return sendSuccessResponse(
        c,
        getResponseObj({
          title: "Auth success",
          sessionInfo: user,
          user: sessionUser,
        }),
      );
    } catch (error: any) {
      logger.error("Error in checkSession command", error);
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: "An error occurred while checking the session.",
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }
  });
});

export default checkSessionRouter;
