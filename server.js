import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
// Ensure User and Device are imported here
import { User, Device, AppRule, Zone, WebFilter, Settings, LocationLog } from './models.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change_this_to_a_secure_random_string";

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- MIDDLEWARE ---
const authenticate = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    const verified = jwt.verify(token.split(" ")[1], JWT_SECRET); // Bearer <token>
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid Token' });
  }
};

// --- AUTH ROUTES (This fixes your Register/Login errors) ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    // Check if user exists
    const existing = await User.findOne({ email });
    if(existing) return res.status(400).json({ error: "Email already taken" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: "Registration failed." });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ _id: user._id }, JWT_SECRET);
    res.json({ token, email: user.email });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- DEVICE & PAIRING ROUTES ---

// 1. Generate Pairing Code (Web)
app.post('/api/devices/add', authenticate, async (req, res) => {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const device = new Device({
      userId: req.user._id,
      name: req.body.name || "New Device",
      pairingCode: code,
      isPaired: false
    });
    await device.save();
    res.json({ code });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Pair Device (Android)
app.post('/api/devices/pair', async (req, res) => {
  try {
    const { code, deviceId, deviceName } = req.body;
    const device = await Device.findOne({ pairingCode: code, isPaired: false });
    
    if (!device) return res.status(404).json({ error: "Invalid or expired code" });

    device.deviceId = deviceId;
    device.name = deviceName || device.name;
    device.isPaired = true;
    device.pairingCode = null; // Clear code
    await device.save();

    res.json({ success: true, deviceId: deviceId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Get User Devices (Web)
app.get('/api/devices', authenticate, async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.user._id });
    res.json(devices);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- DATA ROUTES (Protected & Device Specific) ---

app.get('/api/data/:deviceId/apps', authenticate, async (req, res) => {
  try {
    const apps = await AppRule.find({ deviceId: req.params.deviceId });
    res.json(apps);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/data/:deviceId/location', authenticate, async (req, res) => {
  try {
    const loc = await LocationLog.findOne({ deviceId: req.params.deviceId }).sort({ timestamp: -1 });
    res.json(loc || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ANDROID UPLOAD ROUTES ---

app.post('/api/apps', async (req, res) => {
  try {
    const { deviceId, apps } = req.body;
    if (!apps || !Array.isArray(apps)) return res.status(400).json({ error: "Invalid data" });

    const operations = apps.map(app => ({
      updateOne: {
        filter: { packageName: app.packageName, deviceId: deviceId },
        update: { 
          $set: { 
             appName: app.appName,
             usedTodayMinutes: app.minutes,
             lastTimeUsed: app.lastTime
          },
          $setOnInsert: { dailyUsageLimitMinutes: 60, isGlobalLocked: false }
        },
        upsert: true
      }
    }));

    if(operations.length > 0) await AppRule.bulkWrite(operations);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/location', async (req, res) => {
  try {
    const log = new LocationLog(req.body);
    await log.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings & Web (Generic for now, ideally device specific)
app.get('/api/settings', authenticate, async (req, res) => {
    const settings = await Settings.findOne() || {};
    res.json({ settings });
});
app.post('/api/settings', authenticate, async (req, res) => {
    const settings = await Settings.findOneAndUpdate({}, req.body, { upsert: true, new: true });
    res.json(settings);
});
app.get('/api/zones', authenticate, async (req, res) => {
    const zones = await Zone.find();
    res.json(zones);
});
app.get('/api/web/history', authenticate, async (req, res) => {
    const filter = await WebFilter.findOne() || new WebFilter();
    res.json(filter);
});

// --- SERVE FRONTEND ---
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});