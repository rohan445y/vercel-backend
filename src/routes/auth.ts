import { Router } from 'express';
import { z } from 'zod';
import {
  User,
  Wallet,
  Referral,
  ActivityLog,
} from '../models';
import {
  hashPassword,
  comparePassword,
  generateToken,
  generateReferralCode,
  generateOTP,
  sendResponse,
  sanitizeUser,
} from '../utils/helpers';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import rateLimit from 'express-rate-limit';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

const registerSchema = z.object({
  name: z.string().min(2),
  username: z.string().min(3).regex(/^[a-z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  country: z.string().optional(),
  ref: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  try {
    const { name, username, email, password, phone, country, ref } = req.body;

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return sendResponse(res, 400, 'Email or username already exists');

    let referredBy;
    if (ref) {
      const referrer = await User.findOne({
        $or: [{ referralCode: ref.toUpperCase() }, { username: ref.toLowerCase() }],
      });
      if (referrer) referredBy = referrer._id;
    }

    const user = await User.create({
      name,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: await hashPassword(password),
      phone,
      country: country || 'Nepal',
      referralCode: generateReferralCode(username),
      referredBy,
      isEmailVerified: true,
    });

    await Wallet.create({ user: user._id });

    if (referredBy) {
      await Referral.create({ referrer: referredBy, referred: user._id, level: 1 });
    }

    await ActivityLog.create({ user: user._id, action: 'register' });

    const token = generateToken(user._id.toString(), user.role);
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    return sendResponse(res, 201, 'Registration successful', { user: sanitizeUser(user), token });
  } catch (err) {
    return sendResponse(res, 500, (err as Error).message);
  }
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await comparePassword(password, user.password))) {
      return sendResponse(res, 401, 'Invalid credentials');
    }
    if (user.isBanned) return sendResponse(res, 403, 'Account is banned');
    if (!user.isActive) return sendResponse(res, 403, 'Account is inactive');

    user.lastLogin = new Date();
    user.loginHistory.push({ ip: req.ip || '', device: req.headers['user-agent'] || '', date: new Date() });
    if (user.loginHistory.length > 20) user.loginHistory = user.loginHistory.slice(-20);
    await user.save();

    const token = generateToken(user._id.toString(), user.role);
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    res.cookie('token', token, { httpOnly: true, maxAge });

    return sendResponse(res, 200, 'Login successful', { user: sanitizeUser(user), token });
  } catch (err) {
    return sendResponse(res, 500, (err as Error).message);
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  return sendResponse(res, 200, 'Logged out');
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  return sendResponse(res, 200, 'Profile fetched', { user: sanitizeUser(req.user!) });
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) return sendResponse(res, 200, 'If account exists, reset link sent');

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    return sendResponse(res, 200, 'OTP sent to email', { otp: process.env.NODE_ENV === 'development' ? otp : undefined });
  } catch (err) {
    return sendResponse(res, 500, (err as Error).message);
  }
});

router.post('/verify-otp', authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() }).select('+otp +otpExpiry');
    if (!user || user.otp !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      return sendResponse(res, 400, 'Invalid or expired OTP');
    }
    user.isEmailVerified = true;
    await user.save();
    return sendResponse(res, 200, 'OTP verified');
  } catch (err) {
    return sendResponse(res, 500, (err as Error).message);
  }
});

router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() }).select('+otp +otpExpiry +password');
    if (!user || user.otp !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      return sendResponse(res, 400, 'Invalid or expired OTP');
    }

    user.password = await hashPassword(newPassword);
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();
    return sendResponse(res, 200, 'Password reset successful');
  } catch (err) {
    return sendResponse(res, 500, (err as Error).message);
  }
});

router.put('/change-password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user!._id).select('+password');
    if (!user || !(await comparePassword(currentPassword, user.password))) {
      return sendResponse(res, 400, 'Current password is incorrect');
    }
    user.password = await hashPassword(newPassword);
    await user.save();
    return sendResponse(res, 200, 'Password changed');
  } catch (err) {
    return sendResponse(res, 500, (err as Error).message);
  }
});

router.put('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, phone, country, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { name, phone, country, avatar },
      { new: true }
    );
    return sendResponse(res, 200, 'Profile updated', { user: sanitizeUser(user!) });
  } catch (err) {
    return sendResponse(res, 500, (err as Error).message);
  }
});

export default router;
