import { appInfo } from "../config/app-config.js";
import { getSingletonCacheInstance } from "./local-cache.js";

export const otpTemplate = (otp: string) => {
  return `
  <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${appInfo.appName} OTP for Email Verification</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f5f7fa;
            margin: 0;
            padding: 0;
          }
          .container {
            width: 100%;
            max-width: 480px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            color: #333333;
          }
          .header {
            font-size: 24px;
            font-weight: bold;
            color: ${appInfo.primaryThemeColor};
            margin-bottom: 20px;
            justify-content: center;
            display: flex;
            gap: 5px;
          }
          .content p {
            font-size: 16px;
            line-height: 1.5;
          }
          .otp-code {
            display: block;
            width: fit-content;
            margin: 20px auto;
            font-size: 28px;
            font-weight: bold;
            letter-spacing: 4px;
            color: ${appInfo.primaryThemeColor};
            padding: 10px 20px;
            border: 2px dashed ${appInfo.primaryThemeColor};
            border-radius: 6px;
            user-select: all;
          }
          .footer {
            font-size: 14px;
            color: #777777;
            text-align: center;
            margin-top: 30px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>${appInfo.logo}</div>
            <div style="margin-top: 0">${appInfo.appName}</div>
          </div>
          <div class="content">
            <p>Hello there,</p>
            <p>Your One-Time Password (OTP) for email verification is:</p>
            <span class="otp-code">${otp}</span>
            <p>
              This OTP is valid for the next 10 minutes. Please do not share it with
              anyone.
            </p>
            <p>If you did not request this, please ignore this email.</p>
          </div>
          <div class="footer">${appInfo.appName}</div>
        </div>
      </body>
    </html>
    `;
};

const singletonOTPCache = await getSingletonCacheInstance("otp-cache");
// export const cachedOTPs: OTPCache = {};

export const setOTPInCache = async (email: string, otp: string) => {
  await singletonOTPCache.set(email, otp, 600);
};

export const validateOTP = async (email: string, otp: string) => {
  const cachedOTP = await singletonOTPCache.get(email);
  if (cachedOTP === undefined) {
    return false;
  }

  return cachedOTP === otp;
};

export const clearOTPFromCache = async (email: string) => {
  await singletonOTPCache.del(email);
};
