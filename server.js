import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppRule, Zone, WebFilter, Settings } from './models.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- API Routes ---

// 1. App Rules
app.get('/api/apps', async (req, res) => {
  try {
    const apps = await AppRule.find();
    res.json(apps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/apps', async (req, res) => {
  try {
    const newApp = new AppRule(req.body);
    await newApp.save();
    res.status(201).json(newApp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/apps/:id', async (req, res) => {
  try {
    const updatedApp = await AppRule.findByIdAndUpdate(req.id, req.body, { new: true });
    res.json(updatedApp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Zones (Geofencing)
app.get('/api/zones', async (req, res) => {
  const zones = await Zone.find();
  res.json(zones);
});

app.post('/api/zones', async (req, res) => {
  const newZone = new Zone(req.body);
  await newZone.save();
  res.json(newZone);
});

// 3. Web Filter & History
app.get('/api/web/history', async (req, res) => {
  // Assuming single config doc for simplicity, or find specific user config
  const filter = await WebFilter.findOne() || new WebFilter();
  res.json(filter);
});

app.post('/api/web/log', async (req, res) => {
  // Endpoint for the child's phone to POST history
  try {
    let filter = await WebFilter.findOne();
    if (!filter) filter = new WebFilter();
    
    filter.history.push(req.body); // { url, title, riskScore }
    await filter.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Settings
app.get('/api/settings', async (req, res) => {
  const settings = await Settings.findOne() || {};
  res.json(settings);
});

app.post('/api/settings', async (req, res) => {
  const settings = await Settings.findOneAndUpdate({}, req.body, { upsert: true, new: true });
  res.json(settings);
});

// --- Production Serving ---
// In production, Node serves the React files built by Vite
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