import logger from "./error-logger.js";
import { SendEmailInf } from "./type.js";
import { Resend } from "resend";

const sendEmail = async ({ email, subject, html, env, from }: SendEmailInf) => {
  const resend = new Resend(env.RESEND_KEY);

  const { data, error } = await resend.emails.send({
    from: from || env.EMAIL_FROM,
    to: [email],
    subject,
    html,
  });

  if (error) {
    logger.error("[sendEmail] Resend error:", error);
    throw new Error(error.message);
  }

  return data;
};
export default sendEmail;
