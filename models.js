import mongoose from 'mongoose';

// --- NEW AUTH SCHEMAS ---
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  created: { type: Date, default: Date.now }
});

const DeviceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  deviceId: String, // The Android ID
  pairingCode: String,
  isPaired: { type: Boolean, default: false },
  lastSeen: Date
});

// --- EXISTING SCHEMAS ---
const AppRuleSchema = new mongoose.Schema({
  deviceId: String, // Linked to Device
  appName: { type: String, required: true },
  packageName: { type: String, required: true },
  category: String,
  icon: String,
  color: String,
  isGlobalLocked: { type: Boolean, default: false },
  dailyUsageLimitMinutes: { type: Number, default: 60 },
  usedTodayMinutes: { type: Number, default: 0 },
  lastTimeUsed: Number,
  schedules: [{
    start: String,
    end: String,
    days: [String]
  }]
});

const LocationSchema = new mongoose.Schema({
  deviceId: String,
  latitude: Number,
  longitude: Number,
  batteryLevel: Number,
  timestamp: { type: Date, default: Date.now }
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
  deviceId: String,
  lastModified: { type: Number, default: Date.now },
  locationInterval: { type: Number, default: 60000 },
  appSyncInterval: { type: Number, default: 300000 },
  bedtimeWeeknight: String,
  bedtimeWeekend: String,
  uninstallProtection: Boolean,
  locationTracking: Boolean
});

// Create Models
export const User = mongoose.model('User', UserSchema);
export const Device = mongoose.model('Device', DeviceSchema);
export const AppRule = mongoose.model('AppRule', AppRuleSchema);
export const LocationLog = mongoose.model('LocationLog', LocationSchema);
export const Zone = mongoose.model('Zone', ZoneSchema);
export const WebFilter = mongoose.model('WebFilter', WebFilterSchema);
export const Settings = mongoose.model('Settings', SettingsSchema);