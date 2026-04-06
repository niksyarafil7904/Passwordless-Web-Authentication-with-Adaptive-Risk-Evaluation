import { Request, Response, NextFunction } from 'express';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, message: 'Not authenticated' });
  }
  
  if (!req.session.isAdmin) {
    return res.status(403).json({ ok: false, message: 'Admin access required' });
  }
  
  next();
}