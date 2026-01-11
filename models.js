import mongoose from 'mongoose';

const AppRuleSchema = new mongoose.Schema({
  appName: { type: String, required: true },
  packageName: { type: String, required: true },
  category: String,
  icon: String,
  color: String,
  isGlobalLocked: { type: Boolean, default: false },
  dailyUsageLimitMinutes: { type: Number, default: 60 },
  usedTodayMinutes: { type: Number, default: 0 },
  schedules: [{
    start: String,
    end: String,
    days: [String]
  }]
});

const ZoneSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: ['safe', 'danger'] },
  points: [{ lat: Number, lng: Number }],
  alertMessage: String
});

const WebFilterSchema = new mongoose.Schema({
  blockedCategories: [String],
  blockedUrls: [String],
  history: [{
    url: String,
    title: String,
    timestamp: { type: Date, default: Date.now },
    riskScore: Number
  }]
});

const SettingsSchema = new mongoose.Schema({
  bedtimeWeeknight: String,
  bedtimeWeekend: String,
  uninstallProtection: Boolean,
  locationTracking: Boolean
});

// Create Models
export const AppRule = mongoose.model('AppRule', AppRuleSchema);
export const Zone = mongoose.model('Zone', ZoneSchema);
export const WebFilter = mongoose.model('WebFilter', WebFilterSchema);
export const Settings = mongoose.model('Settings', SettingsSchema);