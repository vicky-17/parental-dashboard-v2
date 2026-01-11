import mongoose from 'mongoose';


const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Hashed
  created: { type: Date, default: Date.now }
});

const DeviceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  deviceId: String, // The unique ID from Android
  pairingCode: String, // Temp code like "123456"
  isPaired: { type: Boolean, default: false },
  lastSeen: Date
});


const AppRuleSchema = new mongoose.Schema({
  deviceId: String, // Added to track which device
  appName: { type: String, required: true },
  packageName: { type: String, required: true },
  category: String,
  icon: String,
  color: String,
  isGlobalLocked: { type: Boolean, default: false },
  dailyUsageLimitMinutes: { type: Number, default: 60 },
  usedTodayMinutes: { type: Number, default: 0 },
  lastTimeUsed: Number, // Timestamp from Android
  schedules: [{
    start: String,
    end: String,
    days: [String]
  }]
});

// New Location Schema
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
  lastModified: { type: Number, default: Date.now }, // For sync versioning
  locationInterval: { type: Number, default: 60000 }, // How often android updates
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