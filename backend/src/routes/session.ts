import { Router } from "express";

export const sessionRouter = Router();

/**
 * Destroys server session + clears cookie
 */
sessionRouter.post("/logout", (req, res) => {
  // If there is no session user, we still respond OK (idempotent logout)
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout destroy error:", err);
      return res.status(500).json({ ok: false, message: "Failed to logout" });
    }

    // must match the name in session({ name: "authsid", ... })
    res.clearCookie("authsid", {
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });

    return res.json({ ok: true });
  });
});
