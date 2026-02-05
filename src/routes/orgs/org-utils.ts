import { Context } from "hono";
import { appInfo } from "../../app-config.js";
import { getSingletonCacheInstance } from "../../local-cache.js";
import { IHonoAppBinding } from "../../types.js";
import { isCustomError, isValidId } from "../../utils/common-utils.js";
import { INVITATION_ENUMS, ROLES } from "../../utils/enums.js";
import logger from "../../utils/error-logger.js";
import { getErrorResponseObj } from "../../utils/response-utils.js";
import { executeSql, isTruthyValue } from "../../utils/sql-helper.js";

const orgUserCache = await getSingletonCacheInstance("org-users-cache", 100);
export const invalidateOrgUserCacheForUser = async (
  orgId: number | undefined,
  userId: number | undefined,
) => {
  if (!orgId || !userId || !isValidId(orgId) || !isValidId(userId)) {
    return;
  }

  const cacheKey = `auth_organization_users_tbl_${orgId}_${userId}`;
  await orgUserCache.del(cacheKey);
};

export const getOrgUserRecord = async (
  orgId: number,
  userId: number,
  c: Context<IHonoAppBinding>,
) => {
  try {
    if (!isValidId(orgId) || !isValidId(userId)) {
      throw getErrorResponseObj({
        errorMsg: "Invalid organization or user ID from getOrgUserRecord.",
        solution: "Please provide valid IDs.",
      });
    }

    const cacheKey = `auth_organization_users_tbl_${orgId}_${userId}`;

    const cachedValue = await orgUserCache.get(cacheKey);
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const sql = `SELECT org_user_role_id, user_opinion, org_user_is_active FROM auth_organization_users_tbl WHERE org_id = ${orgId} AND user_id = ${userId};`;
    const allowedOrgs = (await executeSql(sql, c)) as any[];
    const result = allowedOrgs[0] || null;

    await orgUserCache.set(cacheKey, result);

    return result;
  } catch (error: any) {
    throw isCustomError(error)
      ? error
      : getErrorResponseObj(
          {
            errorMsg: "Problem while fetching the permissions.",
            solution: "Please login again and try again.",
          },
          error,
        );
  }
};

export const isOrgUserActive = (orgUserRecord: any) => {
  return (
    isTruthyValue(orgUserRecord.org_user_is_active) &&
    orgUserRecord.user_opinion === INVITATION_ENUMS.ACCEPTED
  );
};

export const canWriteOrg = async (
  loggedInUserId: number,
  orgId: number,
  c: Context<IHonoAppBinding>,
) => {
  try {
    const org = await getOrgUserRecord(orgId, loggedInUserId, c);

    return isOrgUserActive(org) && ROLES.Is_ADMIN(org.org_user_role_id);
  } catch (error: any) {
    throw getErrorResponseObj(
      {
        errorMsg: "Problem while checking write permissions.",
        solution: "Please login again and try again.",
      },
      error,
    );
  }
};

const orgCreatedByCache = await getSingletonCacheInstance(
  "org-created-by-cache",
  50,
);
export const getOrgCreatedBy = async (
  orgId: number,
  c: Context<IHonoAppBinding>,
) => {
  try {
    if (!isValidId(orgId)) {
      throw getErrorResponseObj({
        errorMsg: "OrgId is invalid.",
      });
    }
    const cacheKey = `org_created_by_${orgId}`;

    const cachedValue = await orgCreatedByCache.get(cacheKey);
    if (isValidId(cachedValue)) {
      return cachedValue;
    } else if (cachedValue === -1) {
      logger.error(
        `Cached orgCreatedBy is -1 for orgId: ${orgId}, this cannot be null.`,
        new Error("Cached orgCreatedBy is -1"),
      );
      return null;
    }

    const sql = `SELECT org_created_by FROM auth_organization_tbl WHERE org_id = ${orgId}`;
    const orgs = (await executeSql(sql, c)) as any[];
    const orgCreatedBy = parseInt(String(orgs[0]?.org_created_by), 10) || -1;

    await orgCreatedByCache.set(cacheKey, orgCreatedBy);

    return orgCreatedBy;
  } catch (error: any) {
    throw getErrorResponseObj(
      {
        errorMsg: "Problem while fetching the organization details.",
        solution: "Please login again and try again.",
      },
      error,
    );
  }
};

interface IInvitationEmailTplProps {
  invitedTo_UserName: string;
  organizationName: string;
  inviterName: string;
  isUserHaveAnAccount: boolean;
}

export const getInvitationEmailTpl = ({
  invitedTo_UserName,
  organizationName,
  inviterName,
  isUserHaveAnAccount,
}: IInvitationEmailTplProps) => {
  const acceptInvitationUrl = `${appInfo.CLIENT_URL}/infrastructure/user-invitations`;
  const singUpUrl = `${appInfo.CLIENT_URL}/register`;
  const loginUrl = `${appInfo.CLIENT_URL}/login`;

  return `<!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8" />
                <title>${appInfo.appName} - ${appInfo.account_type_txt.singular} Invitation</title>
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
                  .org-name {
                    font-weight: bold;
                    color: ${appInfo.primaryThemeColor};
                  }
                  .button-container {
                    text-align: center;
                    margin: 30px 0;
                  }
                  .accept-button {
                    display: inline-block;
                    padding: 14px 32px;
                    font-size: 16px;
                    font-weight: bold;
                    color: #ffffff;
                    background-color: ${appInfo.primaryThemeColor};
                    text-decoration: none;
                    border-radius: 6px;
                    transition: background-color 0.3s;
                  }
                  .accept-button:hover {
                    opacity: 0.9;
                  }
                  .link-section {
                    margin: 20px 0;
                    padding: 15px;
                    background-color: #f9fafb;
                    border-radius: 6px;
                    border-left: 4px solid ${appInfo.primaryThemeColor};
                  }
                  .link-section p {
                    margin: 5px 0;
                    font-size: 14px;
                  }
                  .link-url {
                    color: ${appInfo.primaryThemeColor};
                    word-break: break-all;
                    font-size: 13px;
                  }
                  .footer {
                    font-size: 14px;
                    color: #777777;
                    text-align: center;
                    margin-top: 30px;
                  }
                  .divider {
                    height: 1px;
                    background-color: #e5e7eb;
                    margin: 20px 0;
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
                    <p>Hello ${invitedTo_UserName},</p>
                    <p>
                      You've been invited to join 
                      <span class="org-name">${organizationName}</span> on ${appInfo.appName}.
                    </p>
                    <p>
                      ${inviterName} has invited you to collaborate and access this ${appInfo.account_type_txt.singular.toLocaleLowerCase()}.
                    </p>
                    
                    <div class="button-container">
                      <a href="${acceptInvitationUrl}" class="accept-button">
                        View Invitation
                      </a>
                    </div>

                    <p style="font-size: 14px; color: #666666;">
                      Or copy and paste this link into your browser:
                    </p>
                    <div class="link-section">
                      <p style="font-weight: 600; margin-bottom: 8px;">Accept Invitation Link:</p>
                      <p class="link-url">${acceptInvitationUrl}</p>
                    </div>

                    <div class="divider"></div>

                    ${
                      !isUserHaveAnAccount
                        ? `<p style="font-size: 14px;">
                            It appears you don't have an account with us yet. Please create an account first, and then click on the link above.
                            <a href="${singUpUrl}" style="color: ${appInfo.primaryThemeColor}; text-decoration: none; font-weight: 600;">
                              Create account
                            </a>
                          </p>`
                        : `<p style="font-size: 14px;">
                            You already have an account. Please log in first, and then click the link above.
                            <a href="${loginUrl}" style="color: ${appInfo.primaryThemeColor}; text-decoration: none; font-weight: 600;">
                              Login
                            </a>
                          </p>`
                    }

                    <p style="font-size: 14px; color: #666666; margin-top: 20px;">
                      If you did not expect this invitation, you can safely ignore this email.
                    </p>
                  </div>
                  <div class="footer">${appInfo.appName}</div>
                </div>
              </body>
            </html>`;
};
