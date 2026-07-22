import { Router } from 'express';
import { User, Wallet, Subscription, Transaction, Deposit, Withdraw, Plan, Referral, ReferralCommission, Notification, SupportTicket, Settings, Announcement, AdminLog, CmsContent } from '../models';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { sendResponse, getPagination, sanitizeUser, hashPassword } from '../utils/helpers';
import { creditWallet, debitWallet, createNotification } from '../services/walletService';
import { logAdminAction } from '../middleware/audit';

const router = Router();
router.use(authenticate, authorize('admin', 'superadmin'));

router.get('/stats', async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalUsers, activeUsers, newUsersToday,
    totalDeposits, pendingDeposits, approvedDeposits,
    totalWithdraws, pendingWithdraws,
    subscriptionsSold, totalCommission,
  ] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.countDocuments({ role: 'user', isActive: true }),
    User.countDocuments({ role: 'user', createdAt: { $gte: today } }),
    Deposit.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
    Deposit.countDocuments({ status: 'pending' }),
    Deposit.countDocuments({ status: 'approved' }),
    Withdraw.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Withdraw.countDocuments({ status: 'pending' }),
    Subscription.countDocuments({ status: 'active' }),
    ReferralCommission.aggregate([{ $group: { _id: null, total: { $sum: '$commissionAmount' } } }]),
  ]);

  const depositTotal = totalDeposits[0]?.total || 0;
  const withdrawTotal = totalWithdraws[0]?.total || 0;
  const commissionPaid = totalCommission[0]?.total || 0;

  return sendResponse(res, 200, 'Stats fetched', {
    totalUsers,
    activeUsers,
    inactiveUsers: totalUsers - activeUsers,
    newUsersToday,
    totalDeposits: depositTotal,
    pendingDeposits,
    approvedDeposits,
    totalWithdraw: withdrawTotal,
    pendingWithdraw: pendingWithdraws,
    subscriptionsSold,
    referralCommissionPaid: commissionPaid,
    platformProfit: depositTotal - withdrawTotal - commissionPaid,
    revenue: depositTotal,
  });
});

// Users
router.get('/users', async (req, res) => {
  const { page, limit, skip } = getPagination(req.query.page as string, req.query.limit as string);
  const filter: Record<string, unknown> = { role: 'user' };
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } },
      { username: { $regex: req.query.search, $options: 'i' } },
    ];
  }
  const [users, total] = await Promise.all([
    User.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    User.countDocuments(filter),
  ]);

  const userIds = users.map((u) => u._id);
  const wallets = await Wallet.find({ user: { $in: userIds } });
  const walletMap = new Map(wallets.map((w) => [w.user.toString(), w]));

  const usersWithWallet = users.map((user) => {
    const sanitized = sanitizeUser(user);
    const w = walletMap.get(user._id.toString());
    return {
      ...sanitized,
      wallet: w ? {
        balance: w.balance,
        pendingBalance: w.pendingBalance,
        withdrawableBalance: w.withdrawableBalance,
        lockedBalance: w.lockedBalance,
        totalDeposited: w.totalDeposited,
        totalWithdrawn: w.totalWithdrawn,
        totalEarned: w.totalEarned,
      } : {
        balance: 0,
        pendingBalance: 0,
        withdrawableBalance: 0,
        lockedBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalEarned: 0,
      },
    };
  });

  return sendResponse(res, 200, 'Users fetched', { users: usersWithWallet, total, page, limit });
});

router.put('/users/:id/status', logAdminAction('update_user_status'), async (req, res) => {
  const { isActive, isBanned } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { isActive, isBanned }, { new: true });
  return sendResponse(res, 200, 'User updated', { user: sanitizeUser(user!) });
});

router.post('/users/:id/reset-password', logAdminAction('reset_password'), async (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string' || password.trim().length < 6) {
    return sendResponse(res, 400, 'Please provide a valid password of at least 6 characters');
  }
  const user = await User.findByIdAndUpdate(req.params.id, { password: await hashPassword(password) });
  return sendResponse(res, 200, 'Password reset successfully', { user: sanitizeUser(user!) });
});

// Plans
router.get('/plans', async (_req, res) => {
  const plans = await Plan.find().sort({ sortOrder: 1 });
  return sendResponse(res, 200, 'Plans fetched', { plans });
});

router.post('/plans', logAdminAction('create_plan'), async (req, res) => {
  try {
    const slug = req.body.slug || (req.body.name ? req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : undefined);
    const plan = await Plan.create({ ...req.body, slug });
    return sendResponse(res, 201, 'Plan created', { plan });
  } catch (err) {
    return sendResponse(res, 400, (err as Error).message);
  }
});

router.put('/plans/:id', logAdminAction('update_plan'), async (req, res) => {
  try {
    if (req.body.name && !req.body.slug) {
      req.body.slug = req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    return sendResponse(res, 200, 'Plan updated', { plan });
  } catch (err) {
    return sendResponse(res, 400, (err as Error).message);
  }
});

router.delete('/plans/:id', logAdminAction('delete_plan'), async (req, res) => {
  await Plan.findByIdAndDelete(req.params.id);
  return sendResponse(res, 200, 'Plan deleted');
});

// Deposits
router.get('/deposits', async (req, res) => {
  const { page, limit, skip } = getPagination(req.query.page as string, req.query.limit as string);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  const [deposits, total] = await Promise.all([
    Deposit.find(filter).populate('user', 'name email username').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Deposit.countDocuments(filter),
  ]);
  return sendResponse(res, 200, 'Deposits fetched', { deposits, total, page, limit });
});

router.put('/deposits/:id/approve', logAdminAction('approve_deposit'), async (req: AuthRequest, res) => {
  const deposit = await Deposit.findById(req.params.id);
  if (!deposit || deposit.status !== 'pending') return sendResponse(res, 400, 'Invalid deposit');

  deposit.status = 'approved';
  deposit.reviewedBy = req.user!._id;
  deposit.reviewedAt = new Date();
  await deposit.save();

  await creditWallet(deposit.user.toString(), deposit.amount, 'deposit', 'Deposit approved');
  await Transaction.findOneAndUpdate({ transactionId: deposit.transactionId }, { status: 'completed' });
  await createNotification(deposit.user.toString(), 'Deposit Approved', `Your deposit of NPR ${deposit.amount} has been approved.`, 'deposit');

  return sendResponse(res, 200, 'Deposit approved', { deposit });
});

router.put('/deposits/:id/reject', logAdminAction('reject_deposit'), async (req: AuthRequest, res) => {
  const deposit = await Deposit.findByIdAndUpdate(
    req.params.id,
    { status: 'rejected', adminNote: req.body.reason, reviewedBy: req.user!._id, reviewedAt: new Date() },
    { new: true }
  );
  await Transaction.findOneAndUpdate({ transactionId: deposit!.transactionId }, { status: 'rejected' });
  await createNotification(deposit!.user.toString(), 'Deposit Rejected', req.body.reason || 'Your deposit was rejected.', 'deposit');
  return sendResponse(res, 200, 'Deposit rejected', { deposit });
});

// Withdraws
router.get('/withdraws', async (req, res) => {
  const { page, limit, skip } = getPagination(req.query.page as string, req.query.limit as string);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  const [withdraws, total] = await Promise.all([
    Withdraw.find(filter).populate('user', 'name email username').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Withdraw.countDocuments(filter),
  ]);
  return sendResponse(res, 200, 'Withdrawals fetched', { withdraws, total, page, limit });
});

router.put('/withdraws/:id/approve', logAdminAction('approve_withdraw'), async (req: AuthRequest, res) => {
  const withdraw = await Withdraw.findById(req.params.id);
  if (!withdraw || withdraw.status !== 'pending') return sendResponse(res, 400, 'Invalid withdrawal');

  withdraw.status = 'approved';
  withdraw.reviewedBy = req.user!._id;
  withdraw.reviewedAt = new Date();
  await withdraw.save();

  const wallet = await Wallet.findOne({ user: withdraw.user });
  if (wallet) {
    wallet.pendingBalance -= withdraw.amount;
    wallet.balance -= withdraw.amount;
    wallet.totalWithdrawn += withdraw.amount;
    await wallet.save();
  }

  await Transaction.findOneAndUpdate({ transactionId: withdraw.transactionId }, { status: 'completed' });
  await createNotification(withdraw.user.toString(), 'Withdraw Approved', `Your withdrawal of NPR ${withdraw.amount} has been approved.`, 'withdraw');

  return sendResponse(res, 200, 'Withdrawal approved', { withdraw });
});

router.put('/withdraws/:id/reject', logAdminAction('reject_withdraw'), async (req: AuthRequest, res) => {
  const withdraw = await Withdraw.findById(req.params.id);
  if (!withdraw) return sendResponse(res, 404, 'Not found');

  withdraw.status = 'rejected';
  withdraw.adminNote = req.body.reason;
  withdraw.reviewedBy = req.user!._id;
  withdraw.reviewedAt = new Date();
  await withdraw.save();

  const wallet = await Wallet.findOne({ user: withdraw.user });
  if (wallet) {
    wallet.pendingBalance -= withdraw.amount;
    wallet.withdrawableBalance += withdraw.amount;
    await wallet.save();
  }

  await Transaction.findOneAndUpdate({ transactionId: withdraw.transactionId }, { status: 'rejected' });
  await createNotification(withdraw.user.toString(), 'Withdraw Rejected', req.body.reason || 'Your withdrawal was rejected.', 'withdraw');

  return sendResponse(res, 200, 'Withdrawal rejected', { withdraw });
});

// Wallet management
router.post('/wallet/adjust', logAdminAction('adjust_wallet'), async (req, res) => {
  const { userId, amount, type, reason } = req.body;
  if (type === 'add') {
    await creditWallet(userId, amount, 'adjustment', reason);
  } else {
    await debitWallet(userId, amount, 'adjustment', reason);
  }
  const wallet = await Wallet.findOne({ user: userId });
  return sendResponse(res, 200, 'Wallet adjusted', { wallet });
});

router.put('/wallet/:userId/freeze', logAdminAction('freeze_wallet'), async (req, res) => {
  const wallet = await Wallet.findOneAndUpdate({ user: req.params.userId }, { isFrozen: req.body.freeze }, { new: true });
  return sendResponse(res, 200, 'Wallet updated', { wallet });
});

// Settings
router.get('/settings', async (_req, res) => {
  const settings = await Settings.find();
  const map: Record<string, unknown> = {};
  settings.forEach((s) => { map[s.key] = s.value; });
  return sendResponse(res, 200, 'Settings fetched', { settings: map });
});

router.put('/settings', logAdminAction('update_settings'), async (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    await Settings.findOneAndUpdate({ key }, { value, group: 'general' }, { upsert: true });
  }
  return sendResponse(res, 200, 'Settings updated');
});

// Announcements
router.get('/announcements', async (_req, res) => {
  const announcements = await Announcement.find().sort({ createdAt: -1 });
  return sendResponse(res, 200, 'Announcements fetched', { announcements });
});

router.post('/announcements', logAdminAction('create_announcement'), async (req, res) => {
  const announcement = await Announcement.create(req.body);
  return sendResponse(res, 201, 'Announcement created', { announcement });
});

router.put('/announcements/:id', logAdminAction('update_announcement'), async (req, res) => {
  const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!announcement) return sendResponse(res, 404, 'Announcement not found');
  return sendResponse(res, 200, 'Announcement updated', { announcement });
});

router.delete('/announcements/:id', logAdminAction('delete_announcement'), async (req, res) => {
  await Announcement.findByIdAndDelete(req.params.id);
  return sendResponse(res, 200, 'Announcement deleted');
});

// Referrals
router.get('/referrals', async (_req, res) => {
  const topReferrals = await Referral.aggregate([
    { $group: { _id: '$referrer', count: { $sum: 1 }, commission: { $sum: '$totalCommission' } } },
    { $sort: { commission: -1 } },
    { $limit: 20 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
  ]);
  return sendResponse(res, 200, 'Referrals fetched', { topReferrals });
});

// Support tickets
router.get('/tickets', async (_req, res) => {
  const tickets = await SupportTicket.find().populate('user', 'name email').sort({ createdAt: -1 });
  return sendResponse(res, 200, 'Tickets fetched', { tickets });
});

router.post('/tickets/:id/reply', logAdminAction('reply_ticket'), async (req: AuthRequest, res) => {
  const ticket = await SupportTicket.findByIdAndUpdate(
    req.params.id,
    {
      $push: { messages: { sender: req.user!._id, senderRole: 'admin', message: req.body.message } },
      status: req.body.status || 'in_progress',
    },
    { new: true }
  );
  return sendResponse(res, 200, 'Reply sent', { ticket });
});

// CMS
router.get('/cms/:page', async (req, res) => {
  const content = await CmsContent.find({ page: req.params.page });
  return sendResponse(res, 200, 'CMS content fetched', { content });
});

router.put('/cms', logAdminAction('update_cms'), async (req, res) => {
  const { page, section, content } = req.body;
  const cms = await CmsContent.findOneAndUpdate({ page, section }, { content }, { upsert: true, new: true });
  return sendResponse(res, 200, 'CMS updated', { cms });
});

// Logs
router.get('/logs', async (_req, res) => {
  const logs = await AdminLog.find().populate('admin', 'name email').sort({ createdAt: -1 }).limit(100);
  return sendResponse(res, 200, 'Logs fetched', { logs });
});

export default router;
