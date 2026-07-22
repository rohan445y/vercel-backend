import { Settings } from '../models';

const DEFAULTS: Record<string, unknown> = {
  minDeposit: 300,
  minWithdraw: 225,
  maxWithdraw: 0,
  dailyWithdrawLimit: 3,
  referralLevels: 1,
  multiLevelReferral: false,
  dailyLoginReward: false,
  dailyLoginRewardAmount: 10,
  maintenanceMode: false,
  paymentMethods: ['esewa', 'khalti', 'bank_transfer', 'manual', 'crypto'],
  siteName: 'SMART EARN NEPAL',
  siteUrl: 'http://localhost:3000',
  supportEmail: 'support@karma.com',
};

export async function getSetting(key: string): Promise<unknown> {
  const setting = await Settings.findOne({ key });
  return setting?.value ?? DEFAULTS[key];
}

export async function getSettings(keys: string[]): Promise<Record<string, unknown>> {
  const settings = await Settings.find({ key: { $in: keys } });
  const map: Record<string, unknown> = { ...DEFAULTS };
  settings.forEach((s) => {
    map[s.key] = s.value;
  });
  return map;
}

export async function setSetting(key: string, value: unknown, group = 'general') {
  return Settings.findOneAndUpdate({ key }, { value, group }, { upsert: true, new: true });
}
