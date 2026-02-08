import axios from "axios";
import logger from "./error-logger.js";
import { SendEmailInf } from "./type.js";
import { appInfo } from "../config/app-config.js";

const sendEmail = async ({ email, subject, html }: SendEmailInf) => {
  if (!appInfo.UNIVERSAL_SERVER_URL) {
    logger.error(
      `sendEmail called with UNIVERSAL_SERVER_URL: ${appInfo.UNIVERSAL_SERVER_URL}`,
    );
    return;
  }

  return axios
    .post(`${appInfo.UNIVERSAL_SERVER_URL}/email`, {
      to: email,
      subject,
      html,
    })
    .then((response) => {
      logger.info(
        `Email sent successfully to ${email}. Response: ${response.data}`,
      );
      return response.data;
    })
    .catch((error) => {
      logger.error(`Failed to send email to ${email}. Error: ${error.message}`);
      throw error;
    });
};

export default sendEmail;
