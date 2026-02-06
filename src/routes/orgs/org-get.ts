import { Context } from "hono";
import { APP_INFO_ACCOUNT_TYPE, appInfo } from "../../config/app-config.js";
import { IHonoAppBinding } from "../../types.js";
import { isValidId } from "../../utils/common-utils.js";
import {
  getErrorResponseObj,
  getResponseObj,
  sendErrorResponse,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../utils/response-utils.js";
import { executeSql, initializeConnection } from "../../utils/sql-helper.js";
import { getFeatureFlags } from "../feature-flags/feature-flags.js";
import { getActivePurchasedPlan } from "../paid-plans/purchased-plans.js";

const getAllowedOrgsByUserId = (
  loggedInUserId: number,
  c: Context<IHonoAppBinding>,
) => {
  const sql = `SELECT auth_organization_tbl.org_id, auth_organization_tbl.org_name, auth_organization_tbl.org_external_id, auth_organization_tbl.created_at, auth_organization_tbl.updated_at, auth_organization_tbl.org_is_deleted, auth_organization_tbl.org_created_by,
               ${appInfo.account_type_txt.value === APP_INFO_ACCOUNT_TYPE.ORG ? "auth_organization_tbl.org_address, auth_organization_tbl.org_state, auth_organization_tbl.org_country," : ""}
               auth_organization_users_tbl.org_user_role_id as role_id FROM auth_organization_tbl
               INNER JOIN auth_organization_users_tbl ON auth_organization_users_tbl.org_id = auth_organization_tbl.org_id
               WHERE auth_organization_users_tbl.user_id = ${loggedInUserId} AND auth_organization_users_tbl.user_opinion = 1 
               AND auth_organization_tbl.org_is_deleted = 0 AND auth_organization_users_tbl.org_user_is_active = 1;`;

  return executeSql(sql, c);
};

export const getAllowedOrgs = async (c: Context<IHonoAppBinding>) => {
  const user = c.get("user");
  const loggedInUserId = user?.id;

  if (isValidId(loggedInUserId) === false) {
    return sendErrorResponse(
      c,
      getErrorResponseObj({
        errorMsg: "UserId not found in your API key.",
        solution:
          "Kindly try by re-login or contact support if the issue persists.",
      }),
    );
  }

  return await initializeConnection(async () => {
    try {
      const orgs = (await getAllowedOrgsByUserId(loggedInUserId, c)) as any[];

      if (getFeatureFlags().ff_enable_paid_subscription === true) {
        for (const org of orgs) {
          const activePurchasedPlan = await getActivePurchasedPlan(
            org.org_created_by,
            c,
          );
          org.active_purchased_plan = activePurchasedPlan;
        }
      }

      return sendSuccessResponse(c, getResponseObj({ orgs }));
    } catch (error: any) {
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: `Encountered an error while fetching ${appInfo.account_type_txt.plural}.`,
        solution: "Error occurred while communicating with database.",
      });
    }
  });
};
