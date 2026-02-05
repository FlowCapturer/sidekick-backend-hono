import { Hono } from "hono";
import checkSessionRouter from "./check-session.js";
import loginRouter from "./login-router.js";
import resetPasswordRouter from "./reset-password.js";
import sendOTPRouterRouter from "./send-otp-router.js";
import userProfileRouter from "./user-profile.js";
import userRegistrationRouter from "./user-registration-router.js";
import { IHonoAppBinding } from "../../types.js";

const authRoutes = new Hono<IHonoAppBinding>();

authRoutes.route("/check-session", checkSessionRouter);
authRoutes.route("/login", loginRouter);
authRoutes.route("/reset-password", resetPasswordRouter);
authRoutes.route("/send-otp", sendOTPRouterRouter);
authRoutes.route("/user-profile", userProfileRouter);
authRoutes.route("/register", userRegistrationRouter);

export default authRoutes;
