import { Context } from "hono";
import { appInfo } from "../../config/app-config.js";
import { IHonoAppBinding, purchasedPlansInf } from "../../types.js";
import { isValidId } from "../../utils/common-utils.js";
import { INVITATION_ENUMS } from "../../utils/enums.js";
import { getErrorResponseObj } from "../../utils/response-utils.js";
import { executeSql } from "../../utils/sql-helper.js";
import { getFeatureFlags } from "../feature-flags/feature-flags.js";
import { getOrgCreatedBy } from "./org-utils.js";
import { getActivePurchasedPlan } from "../paid-plans/purchased-plans.js";
import logger from "../../utils/error-logger.js";

const countOrgMembersByOrgCreatedByUserId = async (
  orgCreatedByUserId: number,
  c: Context<IHonoAppBinding>,
) => {
  if (!isValidId(orgCreatedByUserId)) {
    throw getErrorResponseObj({
      errorMsg:
        "OrgCreatedByUserId is invalid from countOrgMembersByOrgCreatedByUserId function.",
    });
  }

  try {
    //Step 1: Count the number of users in the organization
    const sql = `SELECT COUNT(DISTINCT ou.user_id) AS count FROM auth_organization_tbl o INNER JOIN auth_organization_users_tbl ou ON ou.org_id = o.org_id 
               WHERE o.org_created_by = ${orgCreatedByUserId} AND o.org_is_deleted = 0 AND ou.org_user_is_active = 1 AND 
               (ou.user_opinion = ${INVITATION_ENUMS.ACCEPTED} OR ou.user_opinion = ${INVITATION_ENUMS.INVITED});`;

    const usersCount = (await executeSql(sql, c)) as any[];
    let count = Number(usersCount[0].count) || 0;

    //Step 2: Count the number of invited users in the organization
    const sqlInvitedUsers = `SELECT COUNT(DISTINCT oi.email) AS count FROM auth_organization_tbl o INNER JOIN auth_invited_users_tbl oi ON oi.org_id = o.org_id 
                           WHERE o.org_created_by = ${orgCreatedByUserId} AND o.org_is_deleted = 0 AND oi.is_deleted = 0;`;

    const invitedUsersCount = (await executeSql(sqlInvitedUsers, c)) as any[];

    //Step 3: Add the number of invited users to the count
    count += Number(invitedUsersCount[0].count) || 0;

    //Step 4: Return the total count of users in the organization
    return count;
  } catch (error: any) {
    logger.error(
      `Problem while counting the number of users in the organization for orgCreatedByUserId: ${orgCreatedByUserId}`,
      error,
    );
    throw getErrorResponseObj(
      {
        errorMsg:
          "Problem while counting the number of users in the organization.",
        solution: "Please try again later.",
      },
      error,
    );
  }
};

const canAllowToIncludeUsersInOrg = async (
  orgId: number,
  newUsersCount: number,
  c: Context<IHonoAppBinding>,
) => {
  //Step 1: Get the org created by user id
  const orgCreatedByUserId = (await getOrgCreatedBy(orgId, c)) as number;

  //Step 2: Get the active purchased plan for the org created by user
  const activePurchasedPlan = (await getActivePurchasedPlan(
    orgCreatedByUserId,
    c,
  )) as purchasedPlansInf;

  //Step 3: Check if the active purchased plan has for_no_users greater than 1
  if (
    !activePurchasedPlan.for_no_users ||
    activePurchasedPlan.for_no_users <= 1
  ) {
    //here means, the active plans cannot contain any user - that's wired
    return false;
  }

  //Step 4: Count the number of users currently in the organization
  const count = await countOrgMembersByOrgCreatedByUserId(
    orgCreatedByUserId,
    c,
  );

  //Step 5: Check if the count + new users count is less than or equal to the for_no_users
  return count + newUsersCount <= activePurchasedPlan.for_no_users;
};

const checkCanAllowToIncludeUsersInOrg = async (
  orgId: number,
  newUsersCount: number, //new users count to include
  c: Context<IHonoAppBinding>,
) => {
  //Step 1: Check if the feature flag is enabled
  if (getFeatureFlags().ff_enable_paid_subscription === false) {
    return true;
  }

  //Step 2: Check if the user can include more users in the organization
  const canAllow = await canAllowToIncludeUsersInOrg(orgId, newUsersCount, c);
  if (!canAllow) {
    throw getErrorResponseObj({
      errorMsg: `You have reached the limit of users to include in this ${appInfo.account_type_txt.singular.toLocaleLowerCase()}.`,
      solution: `You can add/purchase premium plan to include more users.`,
    });
  }
};

export { checkCanAllowToIncludeUsersInOrg };
