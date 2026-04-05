// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ 
      ok: false, 
      message: "Unauthorized: Please login first" 
    });
  }
  next();
}

export function requireDashboardAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    // For HTML page requests, redirect to login
    if (req.accepts('html')) {
      return res.redirect('/login');
    }
    // For API requests, return JSON error
    return res.status(401).json({ 
      ok: false, 
      message: "Unauthorized: Please login first" 
    });
  }
  next();
}

// Optional: Check if user is already logged in (for login page)
export function redirectIfLoggedIn(req: Request, res: Response, next: NextFunction) {
  if (req.session.userId) {
    if (req.accepts('html')) {
      return res.redirect('/dashboard');
    }
    return res.json({ ok: true, message: "Already logged in" });
  }
  next();
}