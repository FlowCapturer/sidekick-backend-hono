import { Bindings } from "../types";
import { appInfo } from "../config/app-config.js";
import { delRedisValue, getRedisValue, setRedisValue } from "./cache-redis.js";
// import { getSingletonCacheInstance } from "./local-cache.js";

export const otpTemplate = (otp: string) => {
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${appInfo.appName} OTP Verification</title>
    </head>

    <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">

      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding:20px;">
        <tr>
          <td align="center">

            <!-- Main Container -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden;">

              <!-- Header -->
              <tr>
                <td style="background-color:${appInfo.primaryThemeColor}; padding:24px; text-align:center;">
                  <div style="font-size:22px; font-weight:bold; color:#ffffff;">
                    ${appInfo.appName}
                  </div>
                  <div style="font-size:13px; color:#ffffff; margin-top:6px;">
                    Email Verification
                  </div>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:32px; color:#111827;">

                  <p style="margin-top:0; font-size:15px; line-height:1.6;">
                    Hello,
                  </p>

                  <p style="font-size:15px; line-height:1.6;">
                    Use the following One-Time Password (OTP) to verify your email address:
                  </p>

                  <!-- OTP Box -->
                  <table cellpadding="0" cellspacing="0" align="center" style="margin:24px auto;">
                    <tr>
                      <td
                        style="
                          border:2px dashed ${appInfo.primaryThemeColor};
                          border-radius:6px;
                          padding:14px 26px;
                          font-size:26px;
                          font-weight:bold;
                          letter-spacing:4px;
                          color:${appInfo.primaryThemeColor};
                          text-align:center;
                          background-color:#f8fafc;
                        ">
                        ${otp}
                      </td>
                    </tr>
                  </table>

                  <p style="font-size:14px; line-height:1.6; color:#374151;">
                    This OTP is valid for the next <strong>10 minutes</strong>.
                    Please do not share it with anyone.
                  </p>

                  <p style="font-size:14px; line-height:1.6; color:#374151;">
                    If you did not request this verification, you can safely ignore this email.
                  </p>

                  <p style="font-size:14px; margin-bottom:0;">
                    Regards,<br />
                    <strong>${appInfo.appName} Team</strong>
                  </p>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color:#f8fafc; padding:16px; text-align:center; font-size:12px; color:#6b7280;">
                  © ${new Date().getFullYear()} ${appInfo.appName}. All rights reserved.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>

    </body>
    </html>
`;
};

// const singletonOTPCache = getSingletonCacheInstance("otp-cache");

export const setOTPInCache = async (
  env: Bindings,
  email: string,
  otp: string,
) => {
  // await singletonOTPCache.set(email, otp, 600);
  await setRedisValue(env, email, otp, 600);
};

export const validateOTP = async (
  env: Bindings,
  email: string,
  otp: string,
) => {
  const cachedOTP = await getRedisValue(env, email);
  if (cachedOTP === undefined) {
    return false;
  }

  return Number(cachedOTP) === Number(otp);
};

export const clearOTPFromCache = async (env: Bindings, email: string) => {
  await delRedisValue(env, email);
};
