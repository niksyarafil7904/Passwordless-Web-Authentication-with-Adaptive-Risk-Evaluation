import "express-session";

declare module "express-session" {
  interface SessionData {
    // Authenticated session
    userId?: string;
    username?: string;
    role?: "USER" | "ADMIN";
    isAdmin?: boolean;
    stepUpVerified?: boolean;

    // During WebAuthn flows (temporary)
    pendingUserId?: string;
    pendingUsername?: string;

    // WebAuthn challenges
    webauthnRegChallenge?: string;
    webauthnAuthChallenge?: string;

    // Device tracking (for dashboard)
    currentCredentialId?: string;

    stepUp?: {
      userId: string;
      loginAttemptId: string;
      createdAt: number;
    };
  }
}
