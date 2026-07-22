import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';

export const generateToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  });
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateTransactionId = (prefix = 'TXN'): string => {
  return `${prefix}${Date.now()}${nanoid(6).toUpperCase()}`;
};

export const generateReferralCode = (username: string): string => {
  return username.toUpperCase().slice(0, 8) + nanoid(4).toUpperCase();
};

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendResponse = (
  res: Response,
  status: number,
  message: string,
  data?: unknown
): Response => {
  return res.status(status).json({ success: status < 400, message, data });
};

export const getPagination = (page?: string, limit?: string) => {
  const p = Math.max(1, parseInt(page || '1', 10));
  const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
  return { page: p, limit: l, skip: (p - 1) * l };
};

export const sanitizeUser = (user: AuthRequest['user']) => {
  if (!user) return null;
  const obj = user.toObject ? user.toObject() : user;
  const { password, otp, otpExpiry, resetPasswordToken, resetPasswordExpiry, twoFactorSecret, ...safe } = obj;
  return safe;
};
