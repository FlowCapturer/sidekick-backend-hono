import { Hono } from "hono";
import { IHonoAppBinding } from "../../types.js";
import getSubscriptionConfigRouter from "./get-subscription-config.js";
import purchasedPlansRouter from "./purchased-plans.js";
import paymentGateWayRouter from "./payment-gateway.js";

const paidPlansRouter = new Hono<IHonoAppBinding>();

paidPlansRouter.route("/subscription-config", getSubscriptionConfigRouter);
paidPlansRouter.route("/purchased-plans", purchasedPlansRouter);
paidPlansRouter.route("/payment-gateway", paymentGateWayRouter);

export default paidPlansRouter;
