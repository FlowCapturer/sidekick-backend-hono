import { Context, Next } from "hono";
import logger from "./error-logger.js";

export const loggerMiddleware = async (c: Context, next: Next) => {
  const start = Date.now();
  const { method, path } = c.req;

  await next();

  const ms = Date.now() - start;
  const status = c.res.status;

  const logLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  if (logLevel === "info") return; // Skip logging for successful requests to reduce noise

  const user = c.get("user");
  const userLog = user
    ? { userId: user.id || user.userId, userEmail: user.email }
    : {};

  // Use 'any' cast for logger indexing to support dynamic level access
  (logger as any)[logLevel](`${method} ${path}`, {
    method,
    path,
    status,
    durationMs: ms,
    userAgent: c.req.header("user-agent"),
    ip: c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for"),
    ...userLog,
  });
};
