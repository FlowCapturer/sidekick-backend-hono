import { Hono } from "hono";

import { verifyPassword, generateToken } from "../../utils/common-utils.js";
import {
  getErrorResponseObj,
  getResponseObj,
  sendErrorResponse,
  sendSuccessResponse,
} from "../../utils/response-utils.js";
import { initializeConnection, selectRecords } from "../../utils/sql-helper.js";
import { IHonoAppBinding } from "../../types.js";

const loginRouter = new Hono<IHonoAppBinding>();

const verifyCaptchaToken = async (
  turnstileToken: string,
  ip: string | undefined,
  cloudFlareApiKey: string,
) => {
  if (!turnstileToken) {
    throw "INVALID_TOKEN";
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: cloudFlareApiKey,
        response: turnstileToken,
        remoteip: ip, // optional
      }),
    },
  );

  const data: any = await response.json();

  if (data.success !== true) {
    throw "INVALID_TOKEN";
  }
};

loginRouter.post("/", async (c) => {
  /**
   * Request JSON:
   * { username, password, turnstileToken }
   */

  const ip =
    c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip");

  return await initializeConnection(async () => {
    try {
      const {
        username: user_email,
        password,
        turnstileToken,
      } = (await c.req.json()) || {};

      await verifyCaptchaToken(
        turnstileToken,
        ip,
        c.env.CLOUDFLARE_CAPTCHA_API_KEY,
      );

      const records = await selectRecords(
        "auth_users_tbl",
        ["user_id", "user_email", "user_password_hash"],
        { user_email },
        c,
      );

      const record: any = records[0];

      if (!record) {
        //here means, there is no user with his email
        throw "NOT_FOUND";
      }

      if (
        (await verifyPassword(password, record.user_password_hash)) === false
      ) {
        throw "INCORRECT_PASSWORD";
      }

      const api = await generateToken({
        email: user_email,
        id: record.user_id,
      });

      return sendSuccessResponse(
        c,
        getResponseObj({
          message: "Logged in successfully",
          api,
        }),
      );
    } catch (error: any) {
      let responseError = getErrorResponseObj(
        {
          errorMsg: "An error occurred while logging in.",
          solution:
            "Please try again later or contact support if the issue persists.",
        },
        error || {},
      );

      if (error === "NOT_FOUND") {
        responseError = getErrorResponseObj({
          errorMsg: "No account found with this email address.",
          solution:
            "Please check your email for any typos, try a different email, or sign up for a new account.",
        });
      } else if (error === "INCORRECT_PASSWORD") {
        responseError = getErrorResponseObj({
          errorMsg: "Incorrect password. Please try again.",
          solution:
            'Ensure your password is correct. If you forgot your password, use the "Forgot Password" option to reset it.',
        });
      } else if (error === "INVALID_TOKEN") {
        responseError = getErrorResponseObj({
          errorMsg: "Invalid CAPTCHA token.",
          solution: "Please complete the CAPTCHA challenge and try again.",
        });
      }

      return sendErrorResponse(c, responseError);
    }
  });
});

loginRouter.get("/logout", async (c) => {
  return sendSuccessResponse(
    c,
    getResponseObj({
      message: "Logged out successfully",
    }),
  );
});

export default loginRouter;
