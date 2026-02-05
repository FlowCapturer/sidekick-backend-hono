import logger from "../../utils/error-logger.js";
import {
  getResponseObj,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../utils/response-utils.js";
import { executeSql, initializeConnection } from "../../utils/sql-helper.js";
import { Hono, type Context } from "hono";
import { IHonoAppBinding } from "../../types.js";

const app = new Hono<IHonoAppBinding>();

app.get("/", async (c) => {
  return await initializeConnection(async () => {
    try {
      const sql = `SELECT country_code as countryCode, country_name as countryName FROM c_countries;`;
      const countries = await executeSql(sql, c);

      return sendSuccessResponse(c, getResponseObj({ countries }));
    } catch (error: any) {
      logger.error("Error while fetching countries:", error);
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: "An error occurred while fetching countries.",
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }
  });
});

export default app;
