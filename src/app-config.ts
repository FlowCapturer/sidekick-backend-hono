import { AppInfo } from "./types";

export const APP_INFO_ACCOUNT_TYPE = {
  TEAM: "team",
  ORG: "org",
};

// Default app info (can be overridden via setAppConfig)
export let appInfo: AppInfo = {
  appId: "gamma_tech",
  appName: "Gamma Tech",
  appDescription:
    "Gamma Tech is a software company that provides a range of services to help businesses grow and succeed.",
  version: "2.0.1",
  logo: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-notebook-text-icon lucide-notebook-text"><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9.5 8h5"/><path d="M9.5 12H16"/><path d="M9.5 16H14"/></svg>',
  primaryThemeColor: "#00c950",
  CLIENT_URL: "http://localhost:5173",
  supportEmail: "support@gammatech.com",
  account_type_txt: {
    singular: "Team",
    plural: "Teams",
    value: APP_INFO_ACCOUNT_TYPE.TEAM,
  },
};

/**
 * Set application configuration
 * @param config - Application information configuration
 */
export const setAppConfig = (config: AppInfo): void => {
  appInfo = config;
};

export const setAccountType = (
  type?: Partial<typeof APP_INFO_ACCOUNT_TYPE>,
) => {
  if (!type) return;
  Object.assign(APP_INFO_ACCOUNT_TYPE, type);
};
