# Sidekick Backend Hono (Serverless)
This repository provides all the essential setup required to kick-start any application.

- Authorization: Authorization features including Login, Signup, and Forgot Password.
- Team Management: Complete team and user management functionality.
- Payment Gateway: Integrated payment gateway using Razorpay.
- Email API: Built-in Email API for transactional and system emails.
- Utilities: Reusable utility and helper functions.


## Installation
Add this in your package.json file:
```txt
"sidekick-backend-hono": "git@github.com:FlowCapturer/sidekick-backend-hono.git"
```

Add the following to the project's dependency array:
You can skip the packages if you don't want any features.
```txt
"@aws-sdk/client-s3": "^3.983.0",
"@aws-sdk/s3-request-presigner": "^3.983.0",
"axios": "^1.13.4",
"bcryptjs": "^3.0.3",
"hono": "^4.11.7",
"razorpay": "^2.9.6",
"@upstash/redis": "^1.36.2"
```

## Application Setup

Call the `initSideKick` method to initialize the sidekick.

```txt
initSideKick(
  {
    appInfo: appInfo,
    accountType: APP_INFO_ACCOUNT_TYPE,
    cors: {
      allowedOrigins: ["*"],
    },
    subscriptions: {
      currency: "",
      currencySymbol: "",
      freePlan: freePurchasedPlan,
      premiumPlans: [],
      faqs: [],
    },
    secretConfig: {
      //All secret
      cloudFlareApiKey: process.env.CLOUDFLARE_API_TOKEN,
    },
    featureFlags: featureFlags,
  },
  honoApp,
);
```

### Local Database setup

#### Create database
Add this in `wrangler.jsonc`
```txt
  "d1_databases": [
    {
      "binding": "MY_DB",
      "database_name": "db_name",
      "database_id": "",
    },
  ],
```

Run:
```txt
mkdir migrations
npx wrangler d1 migrations apply db_name --local
```
You will see the SQLite db file created in 
```txt
.wrangler\state\v3\d1\miniflare-D1DatabaseObject\filename.sqlite
```

#### Create tables - you can execute
[create-statement.sql](https://github.com/FlowCapturer/sidekick-backend-hono/blob/b2d0e3093dd93b8ece4d2336bb425d8236083c55/sql/create-statement.sql)

Note: No need to add database_id for local DB.
