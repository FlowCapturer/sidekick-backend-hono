import crypto from "node:crypto";
import { Hono, Context } from "hono";
import Razorpay from "razorpay";
import { purchasedPlansInf, IHonoAppBinding } from "../../types.js";
import { isValidId } from "../../utils/common-utils.js";
import logger from "../../utils/error-logger.js";
import {
  getErrorResponseObj,
  getResponseObj,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../utils/response-utils.js";
import {
  initializeConnection,
  insertRecords,
  updateRecords,
} from "../../utils/sql-helper.js";
import {
  getPurchasedPlans,
  invalidatePurchasedPlansCacheForUser,
} from "./purchased-plans.js";
import { CURRENCY, plans } from "./subscription-utils.js";

const paymentGateWayRouter = new Hono<IHonoAppBinding>();
let razorpayInstance: Razorpay;

const getRazorPayInstance = (c: Context<IHonoAppBinding>) => {
  if (razorpayInstance) return razorpayInstance;

  const key_id = c.env.RAZORPAY_KEY_ID;
  const key_secret = c.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw getErrorResponseObj({
      errorMsg: "RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not defined.",
      solution:
        "Check your .env file or environment configuration and provide valid Razorpay credentials.",
    });
  }

  razorpayInstance = new Razorpay({
    key_id,
    key_secret,
  });

  return razorpayInstance;
};

const validatePaymentRequest = ({
  planId,
  billingPeriod,
  currency,
  for_no_users,
  billing_name,
  billing_country,
  billing_address,
  billing_email,
  billing_contact_no,
}: {
  planId: any;
  billingPeriod: "monthly" | "yearly";
  currency: any;
  for_no_users: any;
  billing_name: any;
  billing_country: any;
  billing_address: any;
  billing_email: any;
  billing_contact_no: any;
}) => {
  const planIndex = plans.findIndex((plan) => plan.id === planId);
  if (planIndex === -1) {
    throw getErrorResponseObj({
      errorMsg: "Invalid plan selected.",
      solution: "Please select a valid plan.",
    });
  }

  if (
    plans[planIndex].monthlyPrice === "0" ||
    plans[planIndex].yearlyPrice === "0"
  ) {
    throw getErrorResponseObj({
      errorMsg: "There is no need to pay for this plan.",
      solution: "Please select a valid plan.",
    });
  }

  if (billingPeriod !== "monthly" && billingPeriod !== "yearly") {
    throw getErrorResponseObj({
      errorMsg: "Invalid billing period.",
      solution: "Please provide a valid billing period.",
    });
  }

  if (!currency || typeof currency !== "string" || currency.trim() === "") {
    throw getErrorResponseObj({
      errorMsg: "Invalid currency.",
      solution: "Please provide a valid currency code.",
    });
  }

  if (!for_no_users || typeof for_no_users !== "number" || for_no_users <= 0) {
    throw getErrorResponseObj({
      errorMsg: "Invalid number of users.",
      solution: "Number of users must be a positive number.",
    });
  }

  if (
    !billing_name ||
    typeof billing_name !== "string" ||
    billing_name.trim() === ""
  ) {
    throw getErrorResponseObj({
      errorMsg: "Billing name is required.",
      solution: "Please provide the billing name.",
    });
  }

  if (
    !billing_country ||
    typeof billing_country !== "string" ||
    billing_country.trim() === ""
  ) {
    throw getErrorResponseObj({
      errorMsg: "Billing country is required.",
      solution: "Please provide the billing country.",
    });
  }

  if (
    !billing_address ||
    typeof billing_address !== "string" ||
    billing_address.trim() === ""
  ) {
    throw getErrorResponseObj({
      errorMsg: "Billing address is required.",
      solution: "Please provide the billing address.",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (
    !billing_email ||
    typeof billing_email !== "string" ||
    !emailRegex.test(billing_email)
  ) {
    throw getErrorResponseObj({
      errorMsg: "Invalid billing email.",
      solution: "Please provide a valid billing email address.",
    });
  }

  if (
    !billing_contact_no ||
    typeof billing_contact_no !== "string" ||
    billing_contact_no.trim() === ""
  ) {
    throw getErrorResponseObj({
      errorMsg: "Billing contact number is required.",
      solution: "Please provide the billing contact number.",
    });
  }
};

const calculateAmount = (
  billingPeriod: "monthly" | "yearly",
  for_no_users: number,
  planId: string,
  minUserRequired?: number,
) => {
  const selectedPlanRecord = plans.find((plan) => plan.id === planId);

  if (!selectedPlanRecord) {
    throw getErrorResponseObj({
      errorMsg: "Invalid plan ID.",
      solution: "Please provide a valid plan ID.",
    });
  }

  const minUser = minUserRequired || selectedPlanRecord.minUserRequired;
  const teamSizeForCalculation =
    for_no_users <= minUser ? minUser : for_no_users;

  const planAmount =
    billingPeriod === "yearly"
      ? selectedPlanRecord.yearlyPrice
      : selectedPlanRecord.monthlyPrice;
  const amount = teamSizeForCalculation * parseFloat(planAmount);
  return amount;
};

paymentGateWayRouter.post("/create-order", async (c) => {
  return await initializeConnection(async () => {
    let userId;
    try {
      const user = c.get("user");
      userId = user?.id;

      logger.info(`Initiating order creation for userId: ${userId}`);

      const {
        planId,
        billingPeriod,
        currency,
        for_no_users,
        billing_name,
        billing_country,
        billing_address,
        billing_email,
        billing_contact_no,
      } = await c.req.json();

      if (!isValidId(userId)) {
        throw getErrorResponseObj({
          errorMsg: "Invalid logged-in user.",
          solution: "Please re-login and try again.",
        });
      }

      validatePaymentRequest({
        planId,
        billingPeriod,
        currency,
        for_no_users,
        billing_name,
        billing_country,
        billing_address,
        billing_email,
        billing_contact_no,
      });

      const amount = calculateAmount(billingPeriod, for_no_users, planId);

      const options = {
        amount: Math.round(amount * 100),
        currency: currency,
        receipt: `receipt_${Date.now()}`,
      };

      //create razorpay order
      const order = await getRazorPayInstance(c).orders.create(options);

      //save order in db
      const transactionRec = {
        z_order_id: order.id,
        user_id: userId,
        z_currency: currency,
        amount,
        status: "idle",
      };
      const transactionRecSqlResponse: any = await insertRecords(
        "b_transactions",
        [transactionRec],
        c,
      );

      const purchasePlanRec = {
        for_months: billingPeriod === "yearly" ? 12 : 1,
        for_no_users,
        plan_id: planId,
        user_id: userId,

        y_billing_name: billing_name || "",
        y_billing_country: billing_country || "",
        y_billing_address: billing_address || "",
        y_billing_email: billing_email || "",
        y_billing_contact_no: billing_contact_no || "",

        transaction_id:
          transactionRecSqlResponse.insertId ||
          transactionRecSqlResponse.last_row_id,
      };

      const sqlResponse: any = await insertRecords(
        "b_purchased_plans",
        [purchasePlanRec],
        c,
      );

      logger.info(`Successfully created order for userId: ${userId}`);

      return sendSuccessResponse(
        c,
        getResponseObj({
          message: "Order created successfully.",
          orderId: order.id,
          insertRecordId: sqlResponse.insertId || sqlResponse.last_row_id,
        }),
      );
    } catch (error: any) {
      logger.error(
        `Error creating RazorPay order userId: ${userId || "unknown"}`,
        error,
      );
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: error.message || `An error occurred while creating order.`,
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    } finally {
      if (userId) {
        await invalidatePurchasedPlansCacheForUser(userId);
      }
    }
  });
});

paymentGateWayRouter.post("/add-more-users-order", async (c) => {
  return await initializeConnection(async () => {
    let userId;
    try {
      const user = c.get("user");
      userId = user?.id;

      logger.info(
        `Initiating add more users order creation for userId: ${userId}`,
      );

      const { purchased_id, for_no_users, currency } = await c.req.json();

      if (!isValidId(purchased_id)) {
        throw getErrorResponseObj({
          errorMsg: "Invalid purchased plan.",
          solution:
            "Please try again later or contact support if the issue persists.",
        });
      }

      if (for_no_users < 1) {
        throw getErrorResponseObj({
          errorMsg: "Invalid number of users.",
          solution:
            "Please try again later or contact support if the issue persists.",
        });
      }

      if (currency !== CURRENCY) {
        throw getErrorResponseObj({
          errorMsg: "Invalid currency.",
          solution:
            "Please try again later or contact support if the issue persists.",
        });
      }

      if (!isValidId(userId)) {
        throw getErrorResponseObj({
          errorMsg: "Invalid logged-in user.",
          solution: "Please re-login and try again.",
        });
      }

      const purchasedPlans: any = await getPurchasedPlans(userId, c);
      const purchasedPlan = purchasedPlans.find(
        (plan: purchasedPlansInf) =>
          Number(plan.purchased_id) === Number(purchased_id),
      );

      if (!purchasedPlan) {
        throw getErrorResponseObj({
          errorMsg: "Invalid purchased plan.",
          solution:
            "Please try again later or contact support if the issue persists.",
        });
      }

      const billingPeriod =
        purchasedPlan.for_months === 12 ? "yearly" : "monthly";
      const amount = calculateAmount(
        billingPeriod,
        Number(for_no_users),
        purchasedPlan.plan_id,
        1,
      );

      const options = {
        amount: Math.round(amount * 100),
        currency: currency,
        receipt: `receipt_${Date.now()}`,
      };
      //create razorpay order
      const order = await getRazorPayInstance(c).orders.create(options);

      //save order in db
      const transactionRec = {
        z_order_id: order.id,
        user_id: userId,
        z_currency: currency,
        amount,
        status: "idle",
      };
      const transactionRecSqlResponse: any = await insertRecords(
        "b_transactions",
        [transactionRec],
        c,
      );

      const updatedPlanRec = {
        for_no_users,
        user_id: userId,
        transaction_id:
          transactionRecSqlResponse.insertId ||
          transactionRecSqlResponse.last_row_id,
        purchased_id: Number(purchased_id),
      };
      const sqlResponse: any = await insertRecords(
        "b_updated_plans",
        [updatedPlanRec],
        c,
      );

      logger.info(
        `Successfully created add more users order for userId: ${userId}`,
      );

      return sendSuccessResponse(
        c,
        getResponseObj({
          message: "Add Users order has been created successfully.",
          orderId: order.id,
          insertRecordId: sqlResponse.insertId || sqlResponse.last_row_id,
        }),
      );
    } catch (error: any) {
      logger.error(`Error while updating purchased plan for more users`, error);
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg:
          error.message ||
          `An error occurred while updating purchased plan for more users.`,
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    } finally {
      if (userId) {
        await invalidatePurchasedPlansCacheForUser(userId);
      }
    }
  });
});

paymentGateWayRouter.post("/verify-payment", async (c) => {
  return await initializeConnection(async () => {
    const { orderId, razorpayPaymentId, razorpaySignature } =
      await c.req.json();

    if (!orderId || !razorpayPaymentId || !razorpaySignature) {
      throw getErrorResponseObj({
        errorMsg: "Invalid payment verification request.",
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }

    logger.info(`Initiating payment verification for orderId: ${orderId}`);

    try {
      const generatedSignature = crypto
        .createHmac("sha256", c.env.RAZORPAY_KEY_SECRET || "")
        .update(`${orderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (generatedSignature !== razorpaySignature) {
        const updateResponse = await updateRecords(
          "b_transactions",
          {
            status: "failed",
            z_payment_id: razorpayPaymentId,
            z_payment_signature: razorpaySignature,
          },
          { z_order_id: orderId },
          c,
        );

        throw getErrorResponseObj(
          {
            errorMsg: "Invalid signature.",
            solution:
              "Please try again later or contact support if the issue persists.",
          },
          { ...updateResponse },
        );
      }

      const updateResponse = await updateRecords(
        "b_transactions",
        {
          status: "verified",
          z_payment_id: razorpayPaymentId,
          z_payment_signature: razorpaySignature,
        },
        { z_order_id: orderId },
        c,
      );

      try {
        // Fetch payment details from Razorpay to get the payment method
        const razorpayInst = getRazorPayInstance(c);
        const paymentDetails =
          await razorpayInst.payments.fetch(razorpayPaymentId);
        const paymentMethod = paymentDetails?.method || "unknown";
        await updateRecords(
          "b_transactions",
          {
            z_payment_method: paymentMethod,
            status: paymentDetails.captured ? "paid" : "failed",
          },
          { z_order_id: orderId },
          c,
        );
      } catch (error: any) {
        logger.error(
          `Error fetching payment details from RazorPay orderId: ${orderId}, error`,
          error,
        );
      }

      logger.info(`Successfully verified payment for orderId: ${orderId}`);

      return sendSuccessResponse(
        c,
        getResponseObj({
          message: "Payment verified successfully.",
          ...updateResponse,
          success: true,
        }),
      );
    } catch (error: any) {
      logger.error(
        `Error creating RazorPay verification orderId: ${orderId}`,
        error,
      );

      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: error.message || `An error occurred while verifying payment.`,
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }
  });
});

paymentGateWayRouter.post("/log-failure", async (c) => {
  return await initializeConnection(async () => {
    const { orderId, errorCode, errorDescription, errorReason, paymentId } =
      await c.req.json();
    try {
      const updateResponse = await updateRecords(
        "b_transactions",
        {
          status: "failed",
          z_error_code: errorCode || "",
          z_error_description: errorDescription || "",
          z_error_reason: errorReason || "",
          z_payment_id: paymentId || "",
        },
        { z_order_id: orderId },
        c,
      );

      return sendSuccessResponse(
        c,
        getResponseObj({
          message: "Payment error logged successfully.",
          ...updateResponse,
          success: true,
        }),
      );
    } catch (error: any) {
      logger.error(`Error logging payment error orderId: ${orderId}`, error);

      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg:
          error.message || `An error occurred while logging payment error.`,
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }
  });
});

export default paymentGateWayRouter;
