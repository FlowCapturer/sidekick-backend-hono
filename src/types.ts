// import { Application, Router } from 'express';
// import { Pool } from 'mysql2/promise';
// import { Context, Hono } from "hono";
import { APP_INFO_ACCOUNT_TYPE } from "./config/app-config.js";
import { freePurchasedPlan } from "./routes/paid-plans/subscription-utils.js";
import { Plan } from "./routes/paid-plans/billingsdk-config.js";
// import { Plan } from './routes/paid-plans/billingsdk-config.js';
// import { freePurchasedPlan } from './routes/paid-plans/subscription-utils.js';

/**
 * Database connection type - users must provide a MySQL2 Pool or compatible connection
 */
// export type DatabaseConnection = Pool;

/**
 * Application information configuration
 */
export interface AppInfo {
  appId: string;
  appName: string;
  appDescription: string;
  version: string;
  logo?: string;
  primaryThemeColor?: string;
  CLIENT_URL: string;
  SUPPORT_EMAIL: string;
  account_type_txt: {
    singular: string;
    plural: string;
    value: typeof APP_INFO_ACCOUNT_TYPE.TEAM;
  };
  UNIVERSAL_SERVER_URL?: string; // For sending emails or other universal server needs
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  allowedOrigins: string[];
}

/**
 * JWT configuration
 */
export interface JwtConfig {
  secret: string;
  expiresIn?: string; // e.g., '24h', '7d'
}

/**
 * Custom routes handler - allows users to register additional routes
 */
// export type CustomRoutesHandler = (app: Hono) => void;
// export type CustomPublicRoutesHandler = (router: Router) => void;

export interface purchasedPlansInf {
  plan_id: string;
  purchased_id: number;
  purchased_at: string;
  for_months: number;
  for_no_users: number;
  status: string;
  amount: number;
  transaction_id: string;
  old_purchased_for_no_users: number;

  z_currency: string;
  z_order_id: string;
  z_payment_method: string;

  //calculated fields
  startAt: Date;
  endAt: Date;

  updatedRecords?: IUpdatedPurchasedPlan[];
}

export interface IUpdatedPurchasedPlan {
  purchased_id: number;
  updated_at: string;
  for_no_users: string;
  status: string;
  amount: number;
  z_order_id: string;
  z_payment_method: string;
  z_payment_at: string;
  z_currency: string;
  z_payment_id: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface IEmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface ISecret {
  perplexityApiKey?: string;
  cloudFlareApiKey?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  awsRegion?: string;
  awsS3AccessKey?: string;
  awsS3SecretKey?: string;
  awsS3Bucket?: string;
  linkPreviewApiKey?: string;
  r2AccountId?: string;
  r2AccessKey?: string;
  r2SecretKey?: string;
  r2Bucket?: string;
}

/**
 * Main SideKick configuration interface
 */
export interface SideKickConfig {
  /**
   * Database connection pool (MySQL2)
   */
  // database: DatabaseConnection;

  /**
   * Application information
   */
  appInfo: AppInfo;

  /**
   * CORS configuration
   */
  cors: CorsConfig;

  /**
   * Optional: Custom routes handler to add additional routes
  //  */
  // customRoutes?: CustomRoutesHandler;
  // customRoutesPublic?: CustomRoutesHandler;

  /**
   * Optional: Port number (defaults to 3000)
   */
  port?: number;

  accountType?: typeof APP_INFO_ACCOUNT_TYPE;

  subscriptions: {
    currency: string;
    currencySymbol: string;
    freePlan: typeof freePurchasedPlan;
    premiumPlans: Plan[];
    faqs: FAQItem[];
  };

  emailConfig?: IEmailConfig | null;
  secretConfig: ISecret;
  featureFlags?: Record<string, boolean>;
  rolesEnum?: Record<string, number>;
}

export type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  LINK_PREVIEW_API_KEY: string;
  PERPLEXITY_API_KEY: string;
  CLOUDFLARE_CAPTCHA_API_KEY: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  AWS_REGION: string;
  AWS_S3_ACCESS_KEY: string;
  AWS_S3_SECRET_KEY: string;
  AWS_S3_BUCKET: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY: string;
  R2_SECRET_KEY: string;
  R2_BUCKET: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
};

export type Variables = {
  user: any;
};
export type IHonoAppBinding = { Bindings: Bindings; Variables: Variables };
