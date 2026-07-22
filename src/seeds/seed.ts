import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import { connectDB, disconnectDB } from '../config/database';
import {
  User, Wallet, Plan, Subscription, Transaction, Deposit, Withdraw,
  Referral, ReferralCommission, Notification, SupportTicket, Settings, Announcement, CmsContent,
} from '../models';
import { hashPassword, generateReferralCode, generateTransactionId } from '../utils/helpers';

async function seed() {
  await connectDB();
  console.log('Clearing existing data...');
  await Promise.all([
    User.deleteMany({}), Wallet.deleteMany({}), Plan.deleteMany({}),
    Subscription.deleteMany({}), Transaction.deleteMany({}), Deposit.deleteMany({}),
    Withdraw.deleteMany({}), Referral.deleteMany({}), ReferralCommission.deleteMany({}),
    Notification.deleteMany({}), SupportTicket.deleteMany({}), Settings.deleteMany({}),
    Announcement.deleteMany({}), CmsContent.deleteMany({}),
  ]);

  // Plans
  const plans = await Plan.insertMany([
    {
      name: 'SILVER', slug: 'silver', price: 300, commission: 40, duration: 30,
      benefits: ['Basic Dashboard', 'Referral Income', 'Wallet', 'Withdraw', 'Support'],
      color: '#6366F1', sortOrder: 1,
    },
    {
      name: 'GOLD', slug: 'gold', price: 800, commission: 55, duration: 30,
      benefits: ['Everything in Silver', 'Higher Referral Commission', 'Priority Support', 'Extra Bonus'],
      badge: 'Gold', color: '#8B5CF6', sortOrder: 2,
    },
    {
      name: 'DIAMOND', slug: 'diamond', price: 1500, commission: 65, duration: 30,
      benefits: ['Everything', 'Highest Referral Commission', 'Diamond Badge', 'Fast Withdraw', 'Exclusive Rewards'],
      badge: 'Diamond', color: '#EC4899', sortOrder: 3,
    },
  ]);
  console.log('Plans created');

  // Super Admin with strong credentials
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@karma.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'K4rm4#Admin$2026!SecureKey99';

  const admin = await User.create({
    name: 'Super Admin',
    username: 'admin',
    email: adminEmail,
    password: await hashPassword(adminPassword),
    role: 'superadmin',
    referralCode: 'ADMIN001',
    isEmailVerified: true,
    badges: ['Admin'],
  });
  await Wallet.create({ user: admin._id, balance: 0 });

  // Demo users (strictly display/mock users with randomly generated unguessable passwords)
  const nepaliDemoNames = [
    'Aashish Gurung',
    'Pooja Shrestha',
    'Rohan Adhikari',
    'Sunita Thapa',
    'Bikram Sharma',
    'Ananya Karki',
    'Bibek Tamang',
    'Priya Maharjan',
    'Aarav Rai',
    'Sushma Dahal',
  ];

  const demoUsers: any[] = [];
  for (let i = 1; i <= 10; i++) {
    const nepaliName = nepaliDemoNames[i - 1] || `Demo User ${i}`;
    const unguessablePassword = crypto.randomBytes(24).toString('hex') + '!Aa9#';
    const user = await User.create({
      name: nepaliName,
      username: `user_${i}_${crypto.randomBytes(4).toString('hex')}`,
      email: `demouser_${i}@karma-display.internal`,
      password: await hashPassword(unguessablePassword),
      role: 'user',
      referralCode: generateReferralCode(`user${i}`),
      referredBy: i > 1 ? demoUsers[Math.floor((i - 2) / 2)]?._id : undefined,
      isEmailVerified: true,
      badges: i >= 8 ? ['Diamond'] : i >= 5 ? ['Gold'] : [],
      phone: `980000000${i}`,
      country: 'Nepal',
    });
    demoUsers.push(user);

    const balance = Math.floor(Math.random() * 50000) + 5000;
    await Wallet.create({
      user: user._id,
      balance,
      withdrawableBalance: balance * 0.8,
      pendingBalance: balance * 0.1,
      lockedBalance: balance * 0.1,
      totalDeposited: balance * 1.5,
      totalWithdrawn: balance * 0.3,
      totalEarned: balance * 0.4,
    });

    if (i > 1 && demoUsers[Math.floor((i - 2) / 2)]) {
      await Referral.create({
        referrer: demoUsers[Math.floor((i - 2) / 2)]._id,
        referred: user._id,
        level: 1,
        isActive: i % 2 === 0,
        totalCommission: Math.floor(Math.random() * 5000),
        totalPurchases: i % 2 === 0 ? 1 : 0,
      });
    }
  }
  console.log('Demo users created');

  // Subscriptions for some users
  for (let i = 0; i < 7; i++) {
    const plan = plans[i >= 5 ? 2 : i >= 3 ? 1 : 0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 60));
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);

    await Subscription.create({
      user: demoUsers[i]._id,
      plan: plan._id,
      status: 'active',
      startDate,
      endDate,
      amount: plan.price,
      transactionId: generateTransactionId('SUB'),
    });
  }

  // Transactions
  for (const user of demoUsers) {
    for (let j = 0; j < 5; j++) {
      await Transaction.create({
        transactionId: generateTransactionId(),
        user: user._id,
        type: ['referral', 'deposit', 'bonus'][j % 3] as 'referral' | 'deposit' | 'bonus',
        amount: Math.floor(Math.random() * 5000) + 500,
        status: 'completed',
        remarks: 'Demo transaction',
      });
    }
  }

  // Deposits
  for (let i = 0; i < 8; i++) {
    const user = demoUsers[i % demoUsers.length];
    const amount = Math.floor(Math.random() * 10000) + 1000;
    const status = ['pending', 'approved', 'rejected'][i % 3] as 'pending' | 'approved' | 'rejected';
    await Deposit.create({
      user: user._id,
      transactionId: generateTransactionId('DEP'),
      amount,
      paymentMethod: ['esewa', 'khalti', 'bank_transfer'][i % 3] as 'esewa' | 'khalti' | 'bank_transfer',
      paymentReference: `REF${1000 + i}`,
      status,
    });
  }

  // Withdrawals
  for (let i = 0; i < 6; i++) {
    const user = demoUsers[i % demoUsers.length];
    const amount = Math.floor(Math.random() * 5000) + 500;
    await Withdraw.create({
      user: user._id,
      transactionId: generateTransactionId('WTH'),
      amount,
      paymentMethod: 'esewa',
      paymentDetails: `980000000${i}@esewa`,
      status: ['pending', 'approved', 'rejected'][i % 3] as 'pending' | 'approved' | 'rejected',
    });
  }

  // Referral commissions
  for (let i = 1; i < demoUsers.length; i++) {
    if (demoUsers[i].referredBy) {
      await ReferralCommission.create({
        referrer: demoUsers[i].referredBy,
        referred: demoUsers[i]._id,
        subscription: (await Subscription.findOne({ user: demoUsers[i]._id }))?._id || plans[0]._id,
        plan: plans[0]._id,
        amount: 300,
        commissionRate: 40,
        commissionAmount: 120,
        level: 1,
        status: 'paid',
      });
    }
  }

  // Notifications
  for (const user of demoUsers.slice(0, 5)) {
    await Notification.insertMany([
      { user: user._id, title: 'Welcome to SMART EARN NEPAL!', message: 'Your account has been created successfully.', type: 'system' },
      { user: user._id, title: 'Deposit Approved', message: 'Your deposit of NPR 5,000 has been approved.', type: 'deposit', isRead: true },
      { user: user._id, title: 'Referral Joined', message: 'A new user joined using your referral link!', type: 'referral' },
    ]);
  }

  // Settings
  await Settings.insertMany([
    { key: 'minDeposit', value: 300, group: 'payment' },
    { key: 'minWithdraw', value: 225, group: 'payment' },
    { key: 'maxWithdraw', value: 0, group: 'payment' },
    { key: 'dailyWithdrawLimit', value: 3, group: 'payment' },
    { key: 'referralLevels', value: 1, group: 'referral' },
    { key: 'multiLevelReferral', value: false, group: 'referral' },
    { key: 'dailyLoginReward', value: false, group: 'rewards' },
    { key: 'siteName', value: 'SMART EARN NEPAL', group: 'general' },
    { key: 'maintenanceMode', value: false, group: 'general' },
    { key: 'paymentMethods', value: ['esewa', 'khalti', 'bank_transfer', 'manual', 'crypto'], group: 'payment' },
  ]);

  // Announcements
  await Announcement.create({
    title: 'Welcome to SMART EARN NEPAL Membership!',
    content: 'Join thousands of members earning through referrals. Get started today!',
    type: 'banner',
    isActive: true,
  });

  // CMS
  await CmsContent.insertMany([
    {
      page: 'landing', section: 'hero',
      content: {
        title: 'Earn More with SMART EARN NEPAL Membership',
        subtitle: 'Premium referral platform. Subscribe, refer, and grow your income.',
        cta: 'Get Started',
      },
    },
    {
      page: 'landing', section: 'faq',
      content: {
        items: [
          { q: 'How do I earn?', a: 'Purchase a plan and refer others. Earn commission on every subscription your referrals buy.' },
          { q: 'Minimum deposit?', a: 'NPR 300 minimum deposit amount.' },
          { q: 'Minimum withdrawal?', a: 'NPR 225 minimum withdrawal amount.' },
          { q: 'Payment methods?', a: 'eSewa, Khalti, Bank Transfer, Manual Payment, and Crypto (USDT).' },
        ],
      },
    },
    {
      page: 'landing', section: 'testimonials',
      content: {
        items: [
          { name: 'Pooja Shrestha', role: 'Diamond Member', text: 'SMART EARN NEPAL changed my income stream. The referral system is transparent and payouts are fast.' },
          { name: 'Rohan Adhikari', role: 'Gold Member', text: 'Beautiful platform, easy to use. I earned NPR 50,000 in my first month through referrals.' },
          { name: 'Ananya Karki', role: 'Diamond Member', text: 'Best membership platform in Nepal. Premium UI and excellent support team.' },
        ],
      },
    },
  ]);

  // Support ticket
  await SupportTicket.create({
    user: demoUsers[0]._id,
    subject: 'Need help with deposit',
    category: 'payment',
    status: 'open',
    messages: [{ sender: demoUsers[0]._id, senderRole: 'user', message: 'My deposit is pending for 2 days.' }],
  });

  console.log('\n✅ Seed completed!');
  console.log(`🔐 Admin Email:    ${adminEmail}`);
  console.log(`🔑 Admin Password: ${adminPassword}`);
  console.log('\n👤 Display-only Nepali Demo Users (Mock Data for UI/Leaderboard/Referrals):');
  nepaliDemoNames.forEach((n, idx) => {
    console.log(`  ${idx + 1}. ${n}`);
  });
  console.log('   (Note: Demo user passwords are set to random unguessable values and cannot be logged into)');

  await disconnectDB();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
