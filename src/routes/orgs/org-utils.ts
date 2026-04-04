import { Context } from "hono";
import { appInfo } from "../../config/app-config.js";
import { getSingletonCacheInstance } from "../../utils/local-cache.js";
import { IHonoAppBinding } from "../../types.js";
import { isCustomError, isValidId } from "../../utils/common-utils.js";
import { INVITATION_ENUMS, ROLES } from "../../utils/enums.js";
import logger from "../../utils/error-logger.js";
import { getErrorResponseObj } from "../../utils/response-utils.js";
import { executeSql, isTruthyValue } from "../../utils/sql-helper.js";

const orgUserCache = getSingletonCacheInstance("org-users-cache", 100);
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

const orgCreatedByCache = getSingletonCacheInstance("org-created-by-cache", 50);

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
    if (isValidId(cachedValue as string)) {
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
            <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>${appInfo.appName} Invitation</title>
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
                            ${appInfo.account_type_txt.singular} Invitation
                          </div>
                        </td>
                      </tr>

                      <!-- Body -->
                      <tr>
                        <td style="padding:32px; color:#111827;">

                          <p style="margin-top:0; font-size:15px; line-height:1.6;">
                            Hello <strong>${invitedTo_UserName}</strong>,
                          </p>

                          <p style="font-size:15px; line-height:1.6;">
                            You've been invited to join
                            <strong style="color:${appInfo.primaryThemeColor};">
                              ${organizationName}
                            </strong>
                            on <strong>${appInfo.appName}</strong>.
                          </p>

                          <p style="font-size:15px; line-height:1.6;">
                            <strong>${inviterName}</strong> has invited you to collaborate and access this
                            ${appInfo.account_type_txt.singular.toLocaleLowerCase()}.
                          </p>

                          <!-- CTA Button -->
                          <table cellpadding="0" cellspacing="0" align="center" style="margin:28px auto;">
                            <tr>
                              <td style="background-color:${appInfo.primaryThemeColor}; border-radius:6px;">
                                <a href="${acceptInvitationUrl}" target="_blank"
                                  style="display:inline-block; padding:14px 32px; color:#ffffff; text-decoration:none; font-size:15px; font-weight:bold;">
                                  View Invitation
                                </a>
                              </td>
                            </tr>
                          </table>

                          <p style="font-size:14px; color:#374151;">
                            Or copy and paste this link into your browser:
                          </p>

                          <!-- Link Box -->
                          <table width="100%" cellpadding="0" cellspacing="0"
                            style="margin:16px 0; background-color:#f9fafb; border-left:4px solid ${appInfo.primaryThemeColor};">
                            <tr>
                              <td style="padding:14px;">
                                <p style="margin:0 0 6px; font-size:14px; font-weight:bold;">
                                  Accept Invitation Link:
                                </p>
                                <p style="margin:0; font-size:13px; color:${appInfo.primaryThemeColor}; word-break:break-all;">
                                  ${acceptInvitationUrl}
                                </p>
                              </td>
                            </tr>
                          </table>

                          <!-- Divider -->
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                            <tr>
                              <td style="height:1px; background-color:#e5e7eb;"></td>
                            </tr>
                          </table>

                          ${
                            !isUserHaveAnAccount
                              ? `<p style="font-size:14px; line-height:1.6;">
                                  It appears you don't have an account with us yet.
                                  Please create an account first, then click the invitation link above.
                                  <br /><br />
                                  <a href="${singUpUrl}" target="_blank"
                                    style="color:${appInfo.primaryThemeColor}; text-decoration:none; font-weight:bold;">
                                    Create account
                                  </a>
                                </p>`
                              : `<p style="font-size:14px; line-height:1.6;">
                                  You already have an account.
                                  Please log in first, then click the invitation link above.
                                  <br /><br />
                                  <a href="${loginUrl}" target="_blank"
                                    style="color:${appInfo.primaryThemeColor}; text-decoration:none; font-weight:bold;">
                                    Login
                                  </a>
                                </p>`
                          }

                          <p style="font-size:14px; color:#6b7280; margin-top:20px;">
                            If you did not expect this invitation, you can safely ignore this email.
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
