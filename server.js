const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your_super_secret_key_123'; // In production, use process.env.JWT_SECRET

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static frontend files

// Database Connection
mongoose.connect('mongodb://localhost:27017/parentalControl', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- Schemas ---
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const DeviceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deviceId: { type: String }, // Hardware ID from child device
    name: { type: String },
    pairingCode: { type: String },
    isPaired: { type: Boolean, default: false }
});

const LocationSchema = new mongoose.Schema({
    deviceId: String,
    latitude: Number,
    longitude: Number,
    timestamp: { type: Date, default: Date.now }
});

const AppRuleSchema = new mongoose.Schema({
    deviceId: String,
    packageName: String,
    appName: String,
    isBlocked: { type: Boolean, default: false },
    timeLimit: { type: Number, default: 0 }, // in minutes
    usedToday: { type: Number, default: 0 } // in minutes
});

const User = mongoose.model('User', UserSchema);
const Device = mongoose.model('Device', DeviceSchema);
const Location = mongoose.model('Location', LocationSchema);
const AppRule = mongoose.model('AppRule', AppRuleSchema);

// --- Auth Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- API Routes ---

// Auth
app.post('/api/auth/register', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const user = new User({ email: req.body.email, password: hashedPassword });
        await user.save();
        res.status(201).send({ message: 'User created' });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).send('Cannot find user');
    try {
        if (await bcrypt.compare(req.body.password, user.password)) {
            const token = jwt.sign({ userId: user._id }, JWT_SECRET);
            res.json({ token, email: user.email });
        } else {
            res.send('Not Allowed');
        }
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Devices
app.get('/api/devices', authenticateToken, async (req, res) => {
    try {
        const devices = await Device.find({ userId: req.user.userId });
        res.json(devices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/devices/add', authenticateToken, async (req, res) => {
    try {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const device = new Device({
            userId: req.user.userId,
            pairingCode: code,
            name: 'Pending Device',
            isPaired: false
        });
        await device.save();
        res.json({ code });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/devices/pair', async (req, res) => {
    try {
        const { code, deviceId, name } = req.body;
        const device = await Device.findOne({ pairingCode: code, isPaired: false });
        if (!device) return res.status(404).json({ message: 'Invalid or expired code' });

        device.deviceId = deviceId;
        device.name = name;
        device.isPaired = true;
        await device.save();
        res.json({ success: true, message: 'Device paired successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Data Ingestion (From Child)
app.post('/api/location', async (req, res) => {
    try {
        const { deviceId, latitude, longitude } = req.body;
        const loc = new Location({ deviceId, latitude, longitude });
        await loc.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/apps', async (req, res) => {
    try {
        const { deviceId, apps } = req.body; 
        // apps = [{ packageName, name, usedTime }]
        
        for (const app of apps) {
            await AppRule.findOneAndUpdate(
                { deviceId, packageName: app.packageName },
                { 
                    $set: { appName: app.name, usedToday: app.usedTime || 0 },
                    $setOnInsert: { isBlocked: false, timeLimit: 0 }
                },
                { upsert: true, new: true }
            );
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Dashboard Data
app.get('/api/data/:deviceId/apps', authenticateToken, async (req, res) => {
    try {
        const apps = await AppRule.find({ deviceId: req.params.deviceId });
        res.json(apps);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/data/:deviceId/location', authenticateToken, async (req, res) => {
    try {
        const location = await Location.findOne({ deviceId: req.params.deviceId }).sort({ timestamp: -1 });
        res.json(location || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rule Updates
app.post('/api/rules/update', authenticateToken, async (req, res) => {
    try {
        const { deviceId, packageName, isBlocked, timeLimit } = req.body;
        await AppRule.findOneAndUpdate(
            { deviceId, packageName },
            { isBlocked, timeLimit }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve Dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
