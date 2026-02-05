import { appInfo } from "../../app-config.js";
import { FAQItem, purchasedPlansInf } from "../../types.js";
import { Plan } from "./billingsdk-config.js";

export const getCurrencySymbol = (currency: string) => {
  if (currency === "INR") return "₹";
  if (currency === "USD") return "$";
  if (currency === "EUR") return "€";
  if (currency === "GBP") return "£";
  if (currency === "AUD") return "$";
  if (currency === "CAD") return "$";
  if (currency === "CHF") return "₣";
  if (currency === "CNY") return "¥";
  if (currency === "DKK") return "kr";
  if (currency === "HKD") return "$";
  if (currency === "NZD") return "$";
  if (currency === "SEK") return "kr";
  if (currency === "SGD") return "$";
  if (currency === "ZAR") return "R";
  return "";
};

export const getDisplayPaymentMethod = (paymentMethod: string) => {
  if (paymentMethod === "netbanking") return "Net Banking";
  if (paymentMethod === "wallet") return "Wallet";
  if (paymentMethod === "upi") return "UPI";
  if (paymentMethod === "card") return "Card";
  return paymentMethod;
};

export const isFreePlan = (plan: purchasedPlansInf | undefined) =>
  !plan || plan.plan_id === "starter";

// -----------------------------------------------
export let CURRENCY = "INR";
export let CURRENCY_SYMBOL = getCurrencySymbol(CURRENCY);

export const freePurchasedPlan = {
  plan_id: "starter",
  purchased_at: "",
  status: "free",
  amount: "Free",
  z_order_id: "123",
  for_no_users: 2,
};

export const plans: Plan[] = [
  {
    id: "starter",
    title: "Starter",
    description: "Best for individuals and small teams",
    monthlyPrice: "0",
    yearlyPrice: "0",
    buttonText: "Get Started",
    minUserRequired: 1,
    maxUserRequired: 2,
    features: [
      {
        name: `1 ${appInfo.account_type_txt.singular.toLocaleLowerCase()}, 2 users`,
        icon: "CheckCircle",
      },
      {
        name: "Create & share up to 10 captured flows",
        icon: "CheckCircle",
      },
      {
        name: "Works with any web application",
        icon: "CheckCircle",
      },
      {
        name: "Quick customization",
        icon: "CheckCircle",
      },
      {
        name: "Email support",
        icon: "CheckCircle",
      },
      {
        name: "Basic Insights",
        icon: "CheckCircle",
      },
    ],
    planDisplayCost: {
      monthly: `Continue with ${CURRENCY_SYMBOL}0/month`,
      yearly: `Continue with ${CURRENCY_SYMBOL}0/year`,
    },
    currency: CURRENCY_SYMBOL,
    type: "monthly",
  },
  {
    id: "premium-team",
    title: "Premium Team",
    description: `Get started at just ${CURRENCY_SYMBOL}2,495/month for 5 users`,
    planDisplayCost: {
      monthly: `Continue at ${CURRENCY_SYMBOL}2,495/month - min 5 users`,
      yearly: `Continue at ${CURRENCY_SYMBOL}2,4950/year - min 5 users`,
    },
    minUserRequired: 5,
    maxUserRequired: Number.MAX_SAFE_INTEGER,
    monthlyPrice: "499",
    yearlyPrice: "4990",
    highlight: true,
    buttonText: "Get Started",
    badge: "Top Deal",
    features: [
      {
        name: `${CURRENCY_SYMBOL}499/month for each additional user`,
        icon: "CheckCircle",
      },
      {
        name: `Unlimited ${appInfo.account_type_txt.plural.toLocaleLowerCase()}`,
        icon: "CheckCircle",
      },
      {
        name: "Specify user roles and permissions",
        icon: "CheckCircle",
      },
      {
        name: "Create & share unlimited captured flows",
        icon: "CheckCircle",
      },
      {
        name: "Specify shared document visibility",
        icon: "CheckCircle",
      },
      {
        name: "Works with any web application",
        icon: "CheckCircle",
      },
      {
        name: "Quick customization",
        icon: "CheckCircle",
      },
      {
        name: "Priority email support",
        icon: "CheckCircle",
      },
      {
        name: "Version Control for Publish Documents",
        icon: "CheckCircle",
      },
      {
        name: "Image Editing within steps",
        icon: "CheckCircle",
      },
      // {
      //   name: 'Collaboration using comments',
      //   icon: 'CheckCircle',
      // },
      // {
      //   name: 'Export to PDF, HTML & Markdown',
      //   icon: 'CheckCircle',
      // },
      {
        name: "Generate steps description using AI",
        icon: "CheckCircle",
      },
      // {
      //   name: 'Advanced Insights',
      //   icon: 'CheckCircle',
      // },
    ],
    currency: CURRENCY_SYMBOL,
    type: "monthly",
  },
  {
    id: "premium-individual",
    title: "Premium Individual",
    description: "Perfect for solo professionals",
    planDisplayCost: {
      monthly: `Continue with ${CURRENCY_SYMBOL}8/month`,
      yearly: `Continue with ${CURRENCY_SYMBOL}80/year`,
    },
    minUserRequired: 1,
    maxUserRequired: 1,
    monthlyPrice: "599",
    yearlyPrice: "5990",
    highlight: true,
    buttonText: "Get Started",
    features: [
      {
        name: `You can create unlimited ${appInfo.account_type_txt.plural.toLocaleLowerCase()} to organize records`,
        icon: "CheckCircle",
      },
      {
        name: "Create & share unlimited captured flows",
        icon: "CheckCircle",
      },
      {
        name: "Specify shared document visibility",
        icon: "CheckCircle",
      },
      {
        name: "Works with any web application",
        icon: "CheckCircle",
      },
      {
        name: "Quick customization",
        icon: "CheckCircle",
      },
      {
        name: "Priority email support",
        icon: "CheckCircle",
      },
      {
        name: "Version Control for Publish Documents",
        icon: "CheckCircle",
      },
      {
        name: "Image Editing within steps",
        icon: "CheckCircle",
      },
      // {
      //   name: 'Collaboration using comments',
      //   icon: 'CheckCircle',
      // },
      // {
      //   name: 'Export to PDF, HTML & Markdown',
      //   icon: 'CheckCircle',
      // },
      {
        name: "Generate steps description using AI",
        icon: "CheckCircle",
      },
      // {
      //   name: 'Advanced Insights',
      //   icon: 'CheckCircle',
      // },
    ],
    currency: CURRENCY_SYMBOL,
    type: "monthly",
  },
];

export let faqs = [
  {
    question: "Sample Question?",
    answer: `This is an answer to the sample question`,
  },
];

const setCurrency = (currency: any, currencySymbol: string) => {
  CURRENCY = currency;
  CURRENCY_SYMBOL = currencySymbol;
};

const setFreePlan = (freePlan: typeof freePurchasedPlan) => {
  Object.assign(freePurchasedPlan, freePlan);
};

const setPremiumPlans = (premiumPlans: Plan[]) => {
  Object.assign(plans, premiumPlans);
};

const setFaqs = (faqItems: FAQItem[]) => {
  faqs = faqItems;
};

export { setCurrency, setFreePlan, setPremiumPlans, setFaqs };
