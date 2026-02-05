import { Context } from "hono";
import { appInfo } from "../../app-config.js";
import { IHonoAppBinding, purchasedPlansInf } from "../../types.js";
import { isValidId } from "../../utils/common-utils.js";
import { INVITATION_ENUMS } from "../../utils/enums.js";
import { getErrorResponseObj } from "../../utils/response-utils.js";
import { executeSql } from "../../utils/sql-helper.js";
import { getFeatureFlags } from "../feature-flags/feature-flags.js";
import { getOrgCreatedBy } from "./org-utils.js";
import { getActivePurchasedPlan } from "../paid-plans/purchased-plans.js";

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

  const sql = `SELECT COUNT(DISTINCT ou.user_id) AS count FROM auth_organization_tbl o INNER JOIN auth_organization_users_tbl ou ON ou.org_id = o.org_id 
               WHERE o.org_created_by = ${orgCreatedByUserId} AND o.org_is_deleted = 0 AND ou.org_user_is_active = 1 AND 
               (ou.user_opinion = ${INVITATION_ENUMS.ACCEPTED} OR ou.user_opinion = ${INVITATION_ENUMS.INVITED});`;

  const usersCount = (await executeSql(sql, c)) as any[];
  let count = Number(usersCount[0].count) || 0;

  const sqlInvitedUsers = `SELECT COUNT(DISTINCT oi.email) AS count FROM auth_organization_tbl o INNER JOIN auth_invited_users_tbl oi ON oi.org_id = o.org_id 
                           WHERE o.org_created_by = ${orgCreatedByUserId} AND o.org_is_deleted = 0 AND oi.is_deleted = 0;`;

  const invitedUsersCount = (await executeSql(sqlInvitedUsers, c)) as any[];
  count += Number(invitedUsersCount[0].count) || 0;

  return count;
};

const canAllowToIncludeUsersInOrg = async (
  orgId: number,
  c: Context<IHonoAppBinding>,
) => {
  const orgCreatedByUserId = (await getOrgCreatedBy(orgId, c)) as number;

  const activePurchasedPlan = (await getActivePurchasedPlan(
    orgCreatedByUserId,
    c,
  )) as purchasedPlansInf;

  if (
    !activePurchasedPlan.for_no_users ||
    activePurchasedPlan.for_no_users <= 1
  ) {
    return false;
  }

  const count = await countOrgMembersByOrgCreatedByUserId(
    orgCreatedByUserId,
    c,
  );
  return count <= activePurchasedPlan.for_no_users;
};

const checkCanAllowToIncludeUsersInOrg = async (
  orgId: number,
  c: Context<IHonoAppBinding>,
) => {
  if (getFeatureFlags().ff_enable_paid_subscription === false) {
    return true;
  }

  const canAllow = await canAllowToIncludeUsersInOrg(orgId, c);
  if (!canAllow) {
    throw getErrorResponseObj({
      errorMsg: `You have reached the limit of users to include in this ${appInfo.account_type_txt.singular.toLocaleLowerCase()}.`,
      solution: `You can add/purchase premium plan to include more users.`,
    });
  }
};

export { checkCanAllowToIncludeUsersInOrg };
