const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your_super_secret_key_123'; 

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Database Connection
const dbURI = process.env.MONGODB_URI;

mongoose.connect(dbURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// --- Schemas ---
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const DeviceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deviceId: { type: String }, 
    name: { type: String },
    pairingCode: { type: String },
    isPaired: { type: Boolean, default: false }
});

const LocationSchema = new mongoose.Schema({
    deviceId: String,
    latitude: Number,
    longitude: Number,
    batteryLevel: Number, 
    timestamp: { type: Date, default: Date.now }
});

const AppRuleSchema = new mongoose.Schema({
    deviceId: String,
    packageName: String,
    appName: String,
    category: { type: String, default: 'General' }, 
    isGlobalLocked: { type: Boolean, default: false }, 
    schedules: [{ 
        id: String,
        day: { type: String, default: 'Everyday' },
        start: String, // Stores "HH:mm" (24-hour format)
        end: String    // Stores "HH:mm" (24-hour format)
    }],
    timeLimit: { type: Number, default: 0 }, 
    usedToday: { type: Number, default: 0 } 
});


// Web Filter & History Schema
const WebFilterSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    blockedCategories: { type: [String], default: [] },
    blockedUrls: { type: [String], default: [] },
    history: [{
        url: String,
        title: String,
        timestamp: { type: Date, default: Date.now },
        riskScore: { type: Number, default: 0 } // 0-100
    }]
});

// --- NEW SCHEMA: ZONES ---
const ZoneSchema = new mongoose.Schema({
    deviceId: String,
    name: String,
    type: { type: String, enum: ['safe', 'danger'], default: 'safe' },
    alertMessage: String,
    // GeoJSON Polygon
    points: [{
        lat: Number,
        lng: Number
    }],
    createdAt: { type: Date, default: Date.now }
});




const User = mongoose.model('User', UserSchema);
const Device = mongoose.model('Device', DeviceSchema);
const Location = mongoose.model('Location', LocationSchema);
const AppRule = mongoose.model('AppRule', AppRuleSchema);
const WebFilter = mongoose.model('WebFilter', WebFilterSchema);
const Zone = mongoose.model('Zone', ZoneSchema);





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

// 1. Auth
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
            res.status(403).send('Not Allowed');
        }
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// 2. Devices (Parent Side)
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

// 3. Pairing (Child Side)
app.post('/api/devices/pair', async (req, res) => {
    try {
        const { code, deviceId, deviceName } = req.body; 
        const device = await Device.findOne({ pairingCode: code, isPaired: false });
        if (!device) return res.status(404).json({ success: false, message: 'Invalid Code' });

        device.deviceId = deviceId;
        device.name = deviceName || "Child Device";
        device.isPaired = true;
        await device.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Data Sync (Child -> Server)
app.post('/api/location', async (req, res) => {
    try {
        const { deviceId, latitude, longitude, batteryLevel } = req.body;
        const loc = new Location({ deviceId, latitude, longitude, batteryLevel });
        await loc.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/apps', async (req, res) => {
    try {
        const { deviceId, apps } = req.body; 
        
        if (apps && Array.isArray(apps)) {
            for (const app of apps) {
                await AppRule.findOneAndUpdate(
                    { deviceId, packageName: app.packageName },
                    { 
                        $set: { 
                            appName: app.appName, 
                            usedToday: app.minutes || 0,
                            category: app.category || 'General' 
                        },
                        $setOnInsert: { isGlobalLocked: false, timeLimit: 0 }
                    },
                    { upsert: true, new: true }
                );
            }
        }
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// 5. Dashboard Data (Server -> Parent)
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

// 6. Rules (Parent Updates)
app.post('/api/rules/update', authenticateToken, async (req, res) => {
    try {
        // [UPDATED] Accepts isGlobalLocked and schedules
        const { deviceId, packageName, isGlobalLocked, schedules, timeLimit } = req.body;
        
        const updateFields = {};
        if (isGlobalLocked !== undefined) updateFields.isGlobalLocked = isGlobalLocked;
        if (schedules !== undefined) updateFields.schedules = schedules;
        if (timeLimit !== undefined) updateFields.timeLimit = timeLimit;

        await AppRule.findOneAndUpdate(
            { deviceId, packageName },
            { $set: updateFields },
            { new: true }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});




// --- NEW API ROUTES FOR WEB SAFETY ---

// 1. Get Web Config & History
app.get('/api/web/:deviceId', authenticateToken, async (req, res) => {
    try {
        let filter = await WebFilter.findOne({ deviceId: req.params.deviceId });
        
        // Create default if not exists (Mocking history for demo)
        if (!filter) {
            filter = new WebFilter({
                deviceId: req.params.deviceId,
                blockedCategories: ['pornography', 'gambling'],
                blockedUrls: ['gambling-site.com'],
                history: [
                    { title: "Math Homework Help", url: "https://khanacademy.org/math", riskScore: 5, timestamp: new Date(Date.now() - 1000 * 60 * 5) },
                    { title: "Free Game Mods", url: "https://unknown-mods.net/download", riskScore: 85, timestamp: new Date(Date.now() - 1000 * 60 * 30) },
                    { title: "Social Media Login", url: "https://facebook.com", riskScore: 45, timestamp: new Date(Date.now() - 1000 * 60 * 120) },
                    { title: "Wikipedia - History", url: "https://wikipedia.org/wiki/WWII", riskScore: 10, timestamp: new Date(Date.now() - 1000 * 60 * 180) }
                ]
            });
            await filter.save();
        }
        res.json(filter);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Update Configuration (Categories & URLs)
app.post('/api/web/update', authenticateToken, async (req, res) => {
    try {
        const { deviceId, blockedCategories, blockedUrls } = req.body;
        const updateFields = {};
        if (blockedCategories) updateFields.blockedCategories = blockedCategories;
        if (blockedUrls) updateFields.blockedUrls = blockedUrls;

        await WebFilter.findOneAndUpdate(
            { deviceId },
            { $set: updateFields },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// 3. AI Analysis Endpoint
app.post('/api/web/analyze', authenticateToken, async (req, res) => {
    try {
        const { history, blockedCategories } = req.body;
        
        // Prepare prompt for Gemini
        const historyText = history.map(h => `- [${h.riskScore}/100] ${h.title} (${h.url})`).join('\n');
        
        const prompt = `
            Act as a parental safety expert AI.
            
            **Configuration:**
            The parent has explicitly blocked these categories: ${blockedCategories.length > 0 ? blockedCategories.join(', ').toUpperCase() : 'NONE (Monitor only)'}.
            
            **Child's History:**
            ${historyText}
            
            **Instructions:**
            1. Analyze the history against the BLOCKED CATEGORIES. If the child visited sites that fit these categories, flag them as HIGH RISK.
            2. Even if no custom URL blacklist exists, use your knowledge to identify sites that match the blocked categories.
            3. Provide a 2-sentence summary of the child's behavior and any immediate actions the parent should take.
        `;

        // Call Gemini API (Using fetch)
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content) {
            res.json({ analysis: data.candidates[0].content.parts[0].text });
        } else {
            res.json({ analysis: "Could not generate analysis at this time." });
        }
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: "AI Analysis Failed" });
    }
});










// --- NEW API ROUTES FOR ZONES ---

// 1. Get Zones for Device
app.get('/api/zones/:deviceId', authenticateToken, async (req, res) => {
    try {
        const zones = await Zone.find({ deviceId: req.params.deviceId }).sort({ createdAt: -1 });
        res.json(zones);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Create New Zone
app.post('/api/zones/add', authenticateToken, async (req, res) => {
    try {
        const { deviceId, name, type, alertMessage, points } = req.body;
        
        // Validation (Basic)
        if (!deviceId || !name || !points || points.length < 3) {
            return res.status(400).json({ error: "Invalid zone data" });
        }

        const newZone = new Zone({ deviceId, name, type, alertMessage, points });
        await newZone.save();
        res.json({ success: true, zone: newZone });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Delete Zone
app.delete('/api/zones/:zoneId', authenticateToken, async (req, res) => {
    try {
        await Zone.findByIdAndDelete(req.params.zoneId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


















// Serve Frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));