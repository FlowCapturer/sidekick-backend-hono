import { Context, Next } from "hono";
import { getRedis } from "./cache-redis";
import { IHonoAppBinding } from "../types";
import { getErrorResponseObj } from "./response-utils";
import logger from "./error-logger";

/**
 * Rate limiting middleware using Upstash Redis
 * @param options configuration for rate limiting
 * @returns Hono middleware
 */
export const rateLimit = (options: {
  limit: number;
  windowSeconds: number;
  keyPrefix?: string;
}) => {
  return async (c: Context<IHonoAppBinding>, next: Next) => {
    try {
      const redis = getRedis(c.env);

      const user = c.get("user");
      // Use user identifier if available, otherwise fallback to IP
      const identifier =
        user?.id ||
        user?.email ||
        c.req.header("cf-connecting-ip") ||
        "anonymous";

      const key = `${options.keyPrefix || "ratelimit"}:${c.req.path}:${identifier}`;

      //this will increment the existing value and return
      const count = await redis.incr(key);
      if (count === 1) {
        //setting expiry for the 1st time of same key
        await redis.expire(key, options.windowSeconds);
      }

      if (count > options.limit) {
        const errorResponse = getErrorResponseObj({
          errorMsg: "You have exceeded the rate limit of this feature.",
          solution: `Too many requests. Please wait for some time and try again.`,
        });
        return c.json(errorResponse, 429);
      }
    } catch (error) {
      logger.error("Rate limit error:", error);
      // Fail open to avoid blocking users if Redis is down
    }

    await next();
  };
};
