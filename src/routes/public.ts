import { Router } from 'express';
import { Plan, User, Wallet, ReferralCommission, Announcement, CmsContent } from '../models';
import { sendResponse } from '../utils/helpers';
import { getSettings } from '../services/settingsService';

const router = Router();

router.get('/plans', async (_req, res) => {
  let plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1 });
  if (plans.length === 0) {
    try {
      await Plan.insertMany([
        {
          name: 'SILVER', slug: 'silver', price: 300, commission: 40, duration: 30,
          benefits: ['Basic Dashboard', 'Referral Income', 'Wallet', 'Withdraw', 'Support'],
          color: '#6366F1', sortOrder: 1, isActive: true,
        },
        {
          name: 'GOLD', slug: 'gold', price: 800, commission: 55, duration: 30,
          benefits: ['Everything in Silver', 'Higher Referral Commission', 'Priority Support', 'Extra Bonus'],
          badge: 'Gold', color: '#8B5CF6', sortOrder: 2, isActive: true,
        },
        {
          name: 'DIAMOND', slug: 'diamond', price: 1500, commission: 65, duration: 30,
          benefits: ['Everything', 'Highest Referral Commission', 'Diamond Badge', 'Fast Withdraw', 'Exclusive Rewards'],
          badge: 'Diamond', color: '#EC4899', sortOrder: 3, isActive: true,
        },
      ]);
      plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1 });
    } catch {
      // Ignore insert error if concurrent request inserted
    }
  }
  return sendResponse(res, 200, 'Plans fetched', { plans });
});

router.get('/stats', async (_req, res) => {
  const [users, subscriptions, totalEarned] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Plan.countDocuments({ isActive: true }),
    ReferralCommission.aggregate([{ $group: { _id: null, total: { $sum: '$commissionAmount' } } }]),
  ]);

  return sendResponse(res, 200, 'Public stats', {
    totalMembers: users,
    activePlans: subscriptions,
    totalPaidOut: totalEarned[0]?.total || 0,
    satisfaction: 98,
  });
});

router.get('/leaderboard', async (_req, res) => {
  const topEarners = await Wallet.find().populate('user', 'name username avatar badges').sort({ totalEarned: -1 }).limit(10);
  const topReferrers = await ReferralCommission.aggregate([
    { $group: { _id: '$referrer', total: { $sum: '$commissionAmount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $limit: 10 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
  ]);
  const newestMembers = await User.find({ role: 'user' }).sort({ createdAt: -1 }).limit(10).select('name username avatar createdAt badges');

  return sendResponse(res, 200, 'Leaderboard fetched', { topEarners, topReferrers, newestMembers });
});

router.get('/announcements', async (_req, res) => {
  const announcements = await Announcement.find({ isActive: true }).sort({ createdAt: -1 }).limit(5);
  return sendResponse(res, 200, 'Announcements fetched', { announcements });
});

router.get('/cms/:page', async (req, res) => {
  const content = await CmsContent.find({ page: req.params.page });
  const map: Record<string, unknown> = {};
  content.forEach((c) => { map[c.section] = c.content; });
  return sendResponse(res, 200, 'CMS fetched', { content: map });
});

router.get('/settings/public', async (_req, res) => {
  const settings = await getSettings(['siteName', 'siteUrl', 'supportEmail', 'paymentMethods', 'maintenanceMode']);
  return sendResponse(res, 200, 'Settings fetched', { settings });
});

export default router;
