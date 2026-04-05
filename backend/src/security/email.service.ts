import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);
const secure = String(process.env.SMTP_SECURE || "false") === "true";
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM;

// Check for missing SMTP variables
const requiredSMTPVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
const missingVars = requiredSMTPVars.filter(v => !process.env[v]);

// Handle missing variables based on environment
if (missingVars.length > 0) {
  if (process.env.NODE_ENV === 'production') {
    console.warn(`⚠️ Missing SMTP env vars: ${missingVars.join(', ')}`);
    console.warn('Email sending will be disabled. Set these variables to enable emails.');
  } else {
    console.error(`❌ Missing SMTP env vars: ${missingVars.join(', ')}`);
    console.error('Email sending will not work until these are set.');
  }
}

// Create transporter only if credentials exist (for production warning only)
let transporter: nodemailer.Transporter | null = null;

if (host && user && pass && from) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  console.log('✅ SMTP transporter initialized');
} else {
  console.warn('⚠️ SMTP not configured - email sending disabled');
}

export async function sendStepUpOtpEmail(args: {
  to: string;
  username?: string | null;
  otp: string;
  expiresAt: Date;
  riskReasons?: string[];
}) {
  const { to, username, otp, expiresAt, riskReasons } = args;

  // If transporter is not configured, log and return (don't crash)
  if (!transporter) {
    console.warn(`⚠️ Email not sent to ${to}: SMTP not configured`);
    console.log(`📧 Would have sent OTP ${otp} to ${to}`);
    return;
  }

  const reasonText =
    riskReasons && riskReasons.length > 0 ? `\n\nReason(s): ${riskReasons.join(", ")}` : "";

  const subject = "Your login verification code";

  const text =
    `Your verification code is: ${otp}\n` +
    `It expires at: ${expiresAt.toISOString()}\n` +
    `${reasonText}\n\n` +
    `If you did not try to log in, you can ignore this email.`;

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
    });
    console.log(`✅ OTP email sent to ${to}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    throw error;
  }
}