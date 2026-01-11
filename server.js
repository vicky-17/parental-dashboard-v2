import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppRule, Zone, WebFilter, Settings, LocationLog } from './models.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

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