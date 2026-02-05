import { Hono } from "hono";
import logger from "../utils/error-logger.js";
import {
  getResponseObj,
  sendSuccessResponse,
} from "../utils/response-utils.js";
import { IHonoAppBinding } from "../types.js";
import axios from "axios";

const app = new Hono<IHonoAppBinding>();

app.get("/", async (c) => {
  const url = c.req.query("url") as string;

  if (!url) {
    return c.json({ error: "URL is required" });
  }

  try {
    // Fetch the page content
    const apiKey = c.env.LINK_PREVIEW_API_KEY;
    const { data } = await axios.get("https://api.linkpreview.net", {
      params: {
        key: apiKey,
        q: url,
      },
      timeout: 5000,
    });

    const title = data.title;
    const description = data.description;
    const image = data.image;

    return sendSuccessResponse(
      c,
      getResponseObj({ title, description, image }),
    );
  } catch (error: any) {
    logger.error("Error fetching link metadata:", error);
    return sendSuccessResponse(
      c,
      getResponseObj({ title: url, description: "", image: "" }),
    );
  }
});

export default app;
