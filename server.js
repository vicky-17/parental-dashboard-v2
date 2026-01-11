import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { AppRule, Zone, WebFilter, Settings, LocationLog } from './models.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key_change_me";

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



// --- AUTH ROUTES ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Registration failed. Email might be taken." });
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
    res.status(500).json({ error: err.message });
  }
});

// --- DEVICE / PAIRING ROUTES ---

// 1. Web: Generate a Pairing Code
app.post('/api/devices/add', authenticate, async (req, res) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code
  const device = new Device({
    userId: req.user._id,
    name: req.body.name || "New Device",
    pairingCode: code,
    isPaired: false
  });
  await device.save();
  res.json({ code });
});


// 2. Android: Pair with Code (No Auth required, just code)
app.post('/api/devices/pair', async (req, res) => {
  const { code, deviceId, deviceName } = req.body;
  const device = await Device.findOne({ pairingCode: code, isPaired: false });
  
  if (!device) return res.status(404).json({ error: "Invalid or expired code" });

  device.deviceId = deviceId;
  device.name = deviceName || device.name;
  device.isPaired = true;
  device.pairingCode = null; // Clear code after use
  await device.save();

  res.json({ success: true, deviceId: deviceId });
});


// 3. Web: Get My Devices
app.get('/api/devices', authenticate, async (req, res) => {
  const devices = await Device.find({ userId: req.user._id });
  res.json(devices);
});


// --- DASHBOARD DATA ROUTES (Protected & Filtered by Device) ---

app.get('/api/data/:deviceId/apps', authenticate, async (req, res) => {
  // Ensure user owns this device
  const device = await Device.findOne({ userId: req.user._id, deviceId: req.params.deviceId });
  if (!device) return res.status(403).json({ error: "Unauthorized" });

  const apps = await AppRule.find({ deviceId: req.params.deviceId });
  res.json(apps);
});

app.get('/api/data/:deviceId/location', authenticate, async (req, res) => {
  const device = await Device.findOne({ userId: req.user._id, deviceId: req.params.deviceId });
  if (!device) return res.status(403).json({ error: "Unauthorized" });

  const loc = await LocationLog.findOne({ deviceId: req.params.deviceId }).sort({ timestamp: -1 });
  res.json(loc || {});
});



// --- API ROUTES ---

// 1. App Rules (Sync from Android)
app.get('/api/apps', async (req, res) => {
  try {
    const apps = await AppRule.find();
    res.json(apps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/apps', async (req, res) => {
  // Handle BULK update from Android
  // Payload: { deviceId: "...", apps: [ { packageName, appName, minutes... } ] }
  try {
    const { deviceId, apps } = req.body;
    
    if (!apps || !Array.isArray(apps)) {
      // Fallback for manual single creation (testing)
      const newApp = new AppRule(req.body);
      await newApp.save();
      return res.status(201).json(newApp);
    }

    const operations = apps.map(app => ({
      updateOne: {
        filter: { packageName: app.packageName }, // Match by package
        update: { 
          $set: { 
             appName: app.appName,
             deviceId: deviceId,
             usedTodayMinutes: app.minutes,
             lastTimeUsed: app.lastTime
          },
          $setOnInsert: { // Only set defaults if new
             dailyUsageLimitMinutes: 60,
             isGlobalLocked: false
          }
        },
        upsert: true
      }
    }));

    if(operations.length > 0) {
      await AppRule.bulkWrite(operations);
    }
    
    res.json({ success: true, count: operations.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/apps/:id', async (req, res) => {
  try {
    const updatedApp = await AppRule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedApp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Location (New Endpoint for Android)
app.post('/api/location', async (req, res) => {
  try {
    const log = new LocationLog(req.body);
    await log.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Latest Location for Dashboard
app.get('/api/location/latest', async (req, res) => {
  try {
    // Get the single most recent location log
    const latest = await LocationLog.findOne().sort({ timestamp: -1 });
    res.json(latest || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Settings (Sync logic)
app.get('/api/settings', async (req, res) => {
  try {
     const settings = await Settings.findOne() || {};
     // Also send back ALL rules so Android can cache them locally
     const rules = await AppRule.find();
     
     res.json({
        settings: settings,
        rules: rules // Android needs this in the sync response
     });
  } catch(e) {
     res.status(500).json({error: e.message});
  }
});

app.post('/api/settings', async (req, res) => {
  // Update timestamp so Android knows to fetch new config
  const updateData = { ...req.body, lastModified: Date.now() };
  const settings = await Settings.findOneAndUpdate({}, updateData, { upsert: true, new: true });
  res.json(settings);
});

// 4. Web Filter & Zones (Standard)
app.get('/api/zones', async (req, res) => {
  const zones = await Zone.find();
  res.json(zones);
});
app.post('/api/zones', async (req, res) => {
  const newZone = new Zone(req.body);
  await newZone.save();
  res.json(newZone);
});
app.get('/api/web/history', async (req, res) => {
  const filter = await WebFilter.findOne() || new WebFilter();
  res.json(filter);
});

// --- Serve Frontend ---
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