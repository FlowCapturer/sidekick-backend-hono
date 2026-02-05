import logger from "./error-logger.js";
import { SendEmailInf } from "./type.js";

const sendEmail = async ({ email, subject, html }: SendEmailInf) => {
  logger.info(`Sending email to ${email} with subject ${subject} ${html}`);
};

export default sendEmail;
