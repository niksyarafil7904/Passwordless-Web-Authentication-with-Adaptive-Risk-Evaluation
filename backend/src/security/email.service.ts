import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);
const secure = String(process.env.SMTP_SECURE || "false") === "true";
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM;

if (!host || !user || !pass || !from) {
  throw new Error("Missing SMTP env vars. Check SMTP_HOST/USER/PASS/FROM.");
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
});

export async function sendStepUpOtpEmail(args: {
  to: string;
  username?: string | null;
  otp: string;
  expiresAt: Date;
  riskReasons?: string[];
}) {
  const { to, username, otp, expiresAt, riskReasons } = args;

  const reasonText =
    riskReasons && riskReasons.length > 0 ? `\n\nReason(s): ${riskReasons.join(", ")}` : "";

  const subject = "Your login verification code";

  const text =
    `Your verification code is: ${otp}\n` +
    `It expires at: ${expiresAt.toISOString()}\n` +
    `${reasonText}\n\n` +
    `If you did not try to log in, you can ignore this email.`;

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
  });
}