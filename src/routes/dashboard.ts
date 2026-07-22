import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  Wallet,
  Transaction,
  Deposit,
  Withdraw,
  Subscription,
  ReferralCommission,
  Notification,
  User,
} from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendResponse, getPagination, generateTransactionId, comparePassword } from '../utils/helpers';
import { getSetting } from '../services/settingsService';
import { createNotification } from '../services/walletService';
import { getReferralStats } from '../services/referralService';

import os from 'os';
import { v2 as cloudinary } from 'cloudinary';

if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed'));
  },
});

const router = Router();

router.use(authenticate);

router.post('/upload', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return sendResponse(res, 400, 'No file uploaded');
    }

    if (process.env.CLOUDINARY_CLOUD_NAME) {
      return new Promise<void>((resolve) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'karma_uploads' },
          (error, result) => {
            if (error || !result) {
              sendResponse(res, 500, error?.message || 'Cloudinary upload failed');
            } else {
              sendResponse(res, 200, 'File uploaded successfully', { url: result.secure_url });
            }
            resolve();
          }
        );
        stream.end(req.file!.buffer);
      });
    }

    // Fallback for local / disk storage
    let uploadDir = path.join(__dirname, '../../uploads');
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
    } catch {
      uploadDir = os.tmpdir();
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = uniqueSuffix + path.extname(req.file.originalname);
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, req.file.buffer);

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    return sendResponse(res, 200, 'File uploaded successfully', { url: fileUrl });
  } catch (err) {
    return sendResponse(res, 500, (err as Error).message);
  }
});

router.get('/overview', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!._id;
    const wallet = await Wallet.findOne({ user: userId });
    const subscription = await Subscription.findOne({ user: userId, status: 'active' }).populate('plan');
    const referralStats = await getReferralStats(userId.toString());

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIncome = await Transaction.aggregate([
      { $match: { user: userId, createdAt: { $gte: today }, type: { $in: ['referral', 'bonus'] }, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const pendingWithdraw = await Withdraw.countDocuments({ user: userId, status: 'pending' });
    const completedWithdraw = await Withdraw.countDocuments({ user: userId, status: 'approved' });

    return sendResponse(res, 200, 'Overview fetched', {
      wallet,
      subscription,
      todayIncome: todayIncome[0]?.total || 0,
      referralIncome: referralStats.totalCommission,
      totalReferrals: referralStats.total,
      activeReferrals: referralStats.active,
      pendingWithdraw,
      completedWithdraw,
    });
  } catch (err) {
    return sendResponse(res, 500, (err as Error).message);
  }
});

router.get('/chart', async (req: AuthRequest, res) => {
  try {
    const { period = 'monthly' } = req.query;
    const userId = req.user!._id;
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'daily':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'weekly':
        startDate.setDate(now.getDate() - 56);
        break;
      case 'yearly':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 6);
    }

    const data = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: startDate },
          type: { $in: ['referral', 'bonus', 'deposit'] },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return sendResponse(res, 200, 'Chart data fetched', { data, period });
  } catch (err) {
    return sendResponse(res, 500, (err as Error).message);
  }
});

router.get('/wallet', async (req: AuthRequest, res) => {
  const wallet = await Wallet.findOne({ user: req.user!._id });
  return sendResponse(res, 200, 'Wallet fetched', { wallet });
});

router.get('/transactions', async (req: AuthRequest, res) => {
  const { page, limit, skip } = getPagination(req.query.page as string, req.query.limit as string);
  const filter: Record<string, unknown> = { user: req.user!._id };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.status) filter.status = req.query.status;

  const [transactions, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Transaction.countDocuments(filter),
  ]);

  return sendResponse(res, 200, 'Transactions fetched', { transactions, total, page, limit });
});

router.post('/deposit', async (req: AuthRequest, res) => {
  try {
    const { amount, paymentMethod, paymentReference, screenshot } = req.body;
    const minDeposit = (await getSetting('minDeposit')) as number || 300;

    if (amount < minDeposit) {
      return sendResponse(res, 400, `Minimum deposit is NPR ${minDeposit}`);
    }

    if (paymentMethod !== 'esewa') {
      return sendResponse(res, 400, 'Only eSewa is allowed for deposits');
    }

    if (!screenshot) {
      return sendResponse(res, 400, 'Screenshot is required');
    }

    const deposit = await Deposit.create({
      user: req.user!._id,
      transactionId: generateTransactionId('DEP'),
      amount,
      paymentMethod,
      paymentReference,
      screenshot,
    });

    await Transaction.create({
      transactionId: deposit.transactionId,
      user: req.user!._id,
      type: 'deposit',
      amount,
      status: 'pending',
      remarks: `Deposit via ${paymentMethod}`,
    });

    await createNotification(req.user!._id.toString(), 'Deposit Submitted', `Your deposit of NPR ${amount} is pending approval.`, 'deposit');

    return sendResponse(res, 201, 'Deposit submitted', { deposit });
  } catch (err) {
    return sendResponse(res, 500, (err as Error).message);
  }
});

router.get('/deposits', async (req: AuthRequest, res) => {
  const deposits = await Deposit.find({ user: req.user!._id }).sort({ createdAt: -1 });
  return sendResponse(res, 200, 'Deposits fetched', { deposits });
});

router.post('/withdraw', async (req: AuthRequest, res) => {
  try {
    const { amount, paymentMethod, paymentDetails } = req.body;
    const minWithdraw = (await getSetting('minWithdraw')) as number;
    const dailyLimit = (await getSetting('dailyWithdrawLimit')) as number;

    if (paymentMethod !== 'esewa') {
      return sendResponse(res, 400, 'Only eSewa is allowed for withdrawals');
    }

    if (amount < minWithdraw) return sendResponse(res, 400, `Minimum withdrawal is NPR ${minWithdraw}`);

    const wallet = await Wallet.findOne({ user: req.user!._id });
    if (!wallet || wallet.withdrawableBalance < amount) {
      return sendResponse(res, 400, 'Insufficient withdrawable balance');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Withdraw.countDocuments({ user: req.user!._id, createdAt: { $gte: today } });
    if (todayCount >= dailyLimit) return sendResponse(res, 400, 'Daily withdrawal limit reached');

    const withdraw = await Withdraw.create({
      user: req.user!._id,
      transactionId: generateTransactionId('WTH'),
      amount,
      paymentMethod,
      paymentDetails,
    });

    wallet.pendingBalance += amount;
    wallet.withdrawableBalance -= amount;
    await wallet.save();

    await Transaction.create({
      transactionId: withdraw.transactionId,
      user: req.user!._id,
      type: 'withdraw',
      amount: -amount,
      status: 'pending',
      remarks: `Withdraw via ${paymentMethod}`,
    });

    await createNotification(req.user!._id.toString(), 'Withdraw Requested', `Your withdrawal of NPR ${amount} is pending approval.`, 'withdraw');

    return sendResponse(res, 201, 'Withdraw request submitted', { withdraw });
  } catch (err) {
    return sendResponse(res, 500, (err as Error).message);
  }
});

router.get('/withdraws', async (req: AuthRequest, res) => {
  const withdraws = await Withdraw.find({ user: req.user!._id }).sort({ createdAt: -1 });
  return sendResponse(res, 200, 'Withdrawals fetched', { withdraws });
});

router.get('/referrals', async (req: AuthRequest, res) => {
  const stats = await getReferralStats(req.user!._id.toString());
  const commissions = await ReferralCommission.find({ referrer: req.user!._id })
    .populate('referred', 'name username')
    .populate('plan', 'name')
    .sort({ createdAt: -1 })
    .limit(50);

  return sendResponse(res, 200, 'Referrals fetched', { ...stats, commissions });
});

router.get('/notifications', async (req: AuthRequest, res) => {
  const notifications = await Notification.find({ user: req.user!._id }).sort({ createdAt: -1 }).limit(50);
  const unreadCount = await Notification.countDocuments({ user: req.user!._id, isRead: false });
  return sendResponse(res, 200, 'Notifications fetched', { notifications, unreadCount });
});

router.put('/notifications/:id/read', async (req: AuthRequest, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user!._id }, { isRead: true });
  return sendResponse(res, 200, 'Notification marked as read');
});

router.put('/notifications/read-all', async (req: AuthRequest, res) => {
  await Notification.updateMany({ user: req.user!._id, isRead: false }, { isRead: true });
  return sendResponse(res, 200, 'All notifications marked as read');
});

export default router;
