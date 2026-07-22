import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { AdminLog } from '../models';

export const logAdminAction = (action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (req.user && res.statusCode < 400) {
        AdminLog.create({
          admin: req.user._id,
          action,
          target: req.params.id || req.body?.userId,
          details: { body: req.body, params: req.params },
          ip: req.ip,
        }).catch(console.error);
      }
      return originalJson(body);
    };
    next();
  };
};
