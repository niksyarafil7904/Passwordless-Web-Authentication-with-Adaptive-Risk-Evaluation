import { Request, Response, NextFunction } from 'express';
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireDashboardAccess(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
export declare function redirectIfLoggedIn(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
//# sourceMappingURL=auth.d.ts.map