const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
// const bcrypt = require('bcryptjs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


const cron = require('node-cron'); // Ensure node-cron is installed: npm install node-cron



const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your_super_secret_key_123'; 
const DAILY_RESET_TZ = process.env.DAILY_RESET_TZ || process.env.TZ || 'UTC';

// 🔐 In-Memory Pending Pairings Store
// Structure: { 'code': { userId, socketId, timestamp, timeoutId } }
const pendingPairings = {}; 

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
        const user = new User({ email: req.body.email, password: req.body.password });
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
        // Compare plain text strings
        if (req.body.password === user.password) {
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

// Delete Device
app.delete('/api/devices/:deviceId', authenticateToken, async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        // Find and delete device
        const device = await Device.findOne({ 
            _id: deviceId, 
            userId: req.user.userId 
        });

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Delete associated data
        await Location.deleteMany({ deviceId: device.deviceId });
        await AppRule.deleteMany({ deviceId: device.deviceId });
        await WebFilter.deleteOne({ deviceId: device.deviceId });
        await Zone.deleteMany({ deviceId: device.deviceId });
        
        // Delete device itself
        await Device.deleteOne({ _id: deviceId });

        console.log(`🗑️ Deleted device: ${device.name} (${deviceId})`);
        res.json({ success: true, message: 'Device deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancel Pairing (Dashboard cancels before Android connects)
app.post('/api/devices/cancel-pairing', authenticateToken, async (req, res) => {
    try {
        const { code } = req.body;
        
        if (pendingPairings[code]) {
            // Clear timeout
            if (pendingPairings[code].timeoutId) {
                clearTimeout(pendingPairings[code].timeoutId);
            }
            
            delete pendingPairings[code];
            console.log(`❌ Pairing cancelled for code: ${code}`);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Pairing code not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/devices/add', authenticateToken, async (req, res) => {
    try {
        // Generate unique 6-digit code
        let code;
        do {
            code = Math.floor(100000 + Math.random() * 900000).toString();
        } while (pendingPairings[code]); // Ensure uniqueness

        // Store in pending state (not in database yet)
        pendingPairings[code] = {
            userId: req.user.userId,
            socketId: null, // Will be set when socket connects
            timestamp: Date.now()
        };

        // Set 2-minute timeout
        const timeoutId = setTimeout(() => {
            if (pendingPairings[code]) {
                const socketId = pendingPairings[code].socketId;
                
                // Notify dashboard about timeout
                if (socketId && io.sockets.sockets.get(socketId)) {
                    io.to(socketId).emit('pairing_timeout', { code });
                }
                
                delete pendingPairings[code];
                console.log(`⏰ Pairing code ${code} expired`);
            }
        }, 2 * 60 * 1000); // 2 minutes

        pendingPairings[code].timeoutId = timeoutId;

        console.log(`🔑 Generated pairing code: ${code} for user ${req.user.userId}`);
        res.json({ code });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Pairing (Child Side) - Android Confirmation
app.post('/api/devices/pair', async (req, res) => {
    try {
        const { code, deviceId, deviceName } = req.body; 
        
        // Check if code exists in pending pairings
        if (!pendingPairings[code]) {
            return res.status(404).json({ success: false, message: 'Invalid or expired code' });
        }

        const pendingPairing = pendingPairings[code];

        // Clear timeout
        if (pendingPairing.timeoutId) {
            clearTimeout(pendingPairing.timeoutId);
        }

        // Create device in database
        const device = new Device({
            userId: pendingPairing.userId,
            deviceId: deviceId,
            name: deviceName || "Child Device",
            pairingCode: code,
            isPaired: true
        });
        await device.save();

        // Notify dashboard via socket
        if (pendingPairing.socketId && io.sockets.sockets.get(pendingPairing.socketId)) {
            io.to(pendingPairing.socketId).emit('pairing_success', { 
                device: {
                    id: device._id,
                    name: device.name,
                    deviceId: device.deviceId,
                    isPaired: true
                }
            });
        }

        // Remove from pending
        delete pendingPairings[code];

        console.log(`✅ Device paired successfully: ${deviceName} (${deviceId})`);
        res.json({ success: true, deviceId: device._id });
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








// 1. Reset usage at midnight (Server Time)
cron.schedule('0 0 * * *', async () => {
    try {
        console.log('🌅 Resetting daily app usage...');
        await AppRule.updateMany({}, { $set: { usedToday: 0 } });
        console.log('✅ Daily reset complete.');
    } catch (err) {
        console.error('❌ Daily reset failed:', err);
    }
}, { timezone: DAILY_RESET_TZ });

// 2. Updated App Sync Route
app.post('/api/apps', async (req, res) => {
    try {
        const { deviceId, apps } = req.body; 
        
        if (apps && Array.isArray(apps)) {
            for (const app of apps) {
                if (!app || !app.packageName) continue;

                const update = {
                    $set: {
                        appName: app.appName || app.packageName,
                        category: app.category || 'General',
                    },
                    $setOnInsert: { isGlobalLocked: false, timeLimit: 0 }
                };

                // Support both payload formats:
                // - minutes: absolute "today" minutes (preferred)
                // - seconds: delta seconds since last sync (legacy)
                let incomingMinutes = NaN;
                if (app.minutes !== undefined && app.minutes !== null) {
                    incomingMinutes = Number(app.minutes);
                }

                let incomingSeconds = NaN;
                if (app.seconds !== undefined && app.seconds !== null) {
                    incomingSeconds = Number(app.seconds);
                }

                if (Number.isFinite(incomingMinutes)) {
                    update.$set.usedToday = Math.max(0, incomingMinutes);
                } else if (Number.isFinite(incomingSeconds)) {
                    update.$inc = { usedToday: Math.max(0, incomingSeconds) / 60 };
                } else if (app.initialSync) {
                    update.$set.usedToday = 0;
                }

                await AppRule.findOneAndUpdate(
                    { deviceId, packageName: app.packageName },
                    update,
                    { upsert: true }
                );
            }
        }
        res.json({ success: true });
    } catch (error) {
        console.error("Error updating app usage:", error);
        res.status(500).json({ error: error.message });
    }
});

// [ADD THIS NEW ROUTE]
// 7. Get Blocked Apps List (For Android Sync)
// [FIXED] 7. Get Blocked Apps List (Removed authenticateToken for device access)
app.get('/api/rules/blocked/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        // Find apps that are either:
        // 1. Globally Locked (isGlobalLocked = true)
        // 2. Time Limit Exceeded (timeLimit > 0 AND usedToday >= timeLimit)
        const rules = await AppRule.find({
            deviceId: deviceId,
            $or: [
                { isGlobalLocked: true },
                { $expr: { $and: [ { $gt: ["$timeLimit", 0] }, { $gte: ["$usedToday", "$timeLimit"] } ] } }
            ]
        });

        // Return just the package names array
        const blockedPackages = rules.map(r => r.packageName);
        res.json({ blockedPackages });
        
    } catch (error) {
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
// ------------------------------------------
// 1. POST: RECEIVE Browser History from App
// ------------------------------------------
app.post('/api/browser-history', async (req, res) => {
    try {
        const { deviceId, history } = req.body; // history is an array: ["url|time", "url|time"]

        if (!deviceId || !history || history.length === 0) {
            return res.status(400).json({ error: "Missing data" });
        }

        let filter = await WebFilter.findOne({ deviceId: deviceId });
        
        // Create new record if device doesn't exist
        if (!filter) {
            filter = new WebFilter({
                deviceId: deviceId,
                blockedCategories: [],
                blockedUrls: [],
                history: []
            });
        }

        // Parse the Android data string ("url|timestamp") into objects
        const newEntries = history.map(item => {
            const parts = item.split('|');
            const url = parts[0];
            const timestamp = parseInt(parts[1]) || Date.now();
            
            return {
                title: "Visited Site", // Title is not sent by accessibility service easily
                url: url,
                riskScore: 0, // You can add logic here to check if URL is bad
                timestamp: new Date(timestamp)
            };
        });

        // Add to history and save
        filter.history.push(...newEntries);
        await filter.save();

        console.log(`✅ Saved ${newEntries.length} history items for ${deviceId}`);
        res.json({ success: true });

    } catch (error) {
        console.error("Save History Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ------------------------------------------
// 2. GET: SEND Web Config & History to Web Dashboard
// ------------------------------------------
app.get('/api/web/:deviceId', authenticateToken, async (req, res) => {
    try {
        let filter = await WebFilter.findOne({ deviceId: req.params.deviceId });

        // If no data exists, return an empty object instead of creating FAKE data
        if (!filter) {
            return res.json({ 
                deviceId: req.params.deviceId,
                history: [] 
            });
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






// Alert Schema to store notifications
const AlertSchema = new mongoose.Schema({
    deviceId: String,
    message: String,
    type: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
    timestamp: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false }
});
const Alert = mongoose.model('Alert', AlertSchema);

// ... [Existing Routes] ...

// HELPER: Ray-Casting Algorithm for Point in Polygon
function isPointInPolygon(point, vs) {
    // point = {lat, lng}, vs = [{lat, lng}, ...]
    let x = point.lat, y = point.lng;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].lat, yi = vs[i].lng;
        let xj = vs[j].lat, yj = vs[j].lng;
        
        let intersect = ((yi > y) != (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// UPDATED: Location Endpoint with Calculation Logic
app.post('/api/location', async (req, res) => {
    try {
        const { deviceId, latitude, longitude, batteryLevel } = req.body;
        
        // 1. Save Location
        const loc = new Location({ deviceId, latitude, longitude, batteryLevel });
        await loc.save();

        // 2. Perform Geofence Calculation
        // Fetch all zones for this device
        const zones = await Zone.find({ deviceId });
        
        for (const zone of zones) {
            const isInside = isPointInPolygon({ lat: latitude, lng: longitude }, zone.points);
            
            // Logic: 
            // If Type is 'danger' AND user is INSIDE -> Alert
            // If Type is 'safe' -> You might alert on EXIT (requires tracking previous state), 
            // for simplicity here we alert on ENTRY to safe zone as a "Check-in" notification.
            
            if (isInside) {
                // Check if we recently sent an alert to avoid spamming (e.g., last 5 mins)
                const lastAlert = await Alert.findOne({ 
                    deviceId, 
                    message: zone.alertMessage 
                }).sort({ timestamp: -1 });

                const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
                
                if (!lastAlert || lastAlert.timestamp < fiveMinsAgo) {
                    // Create Notification
                    console.log(`[GEOFENCE] Breach detected: ${zone.name}`);
                    const alertType = zone.type === 'danger' ? 'critical' : 'info';
                    
                    await new Alert({
                        deviceId,
                        message: `Geofence Trigger: ${zone.alertMessage}`,
                        type: alertType
                    }).save();
                }
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to fetch alerts (Frontend can poll this)
app.get('/api/alerts/:deviceId', authenticateToken, async (req, res) => {
    const alerts = await Alert.find({ deviceId: req.params.deviceId }).sort({ timestamp: -1 }).limit(10);
    res.json(alerts);
});

// -------------------------------------------------------





// ... [Existing Imports & Schemas] ...

// --- NEW SCHEMA: SETTINGS ---
const SettingsSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    bedtimeWeeknight: { type: String, default: "21:00" },
    bedtimeWeekend: { type: String, default: "23:00" },
    uninstallProtection: { type: Boolean, default: false },
    locationTracking: { type: Boolean, default: true }
});

const Settings = mongoose.model('Settings', SettingsSchema);

// ... [Existing Middleware & DB Connection] ...

// --- NEW API ROUTES FOR SETTINGS ---

// 1. Get Settings
app.get('/api/settings/:deviceId', authenticateToken, async (req, res) => {
    try {
        let settings = await Settings.findOne({ deviceId: req.params.deviceId });
        
        // Create default if not exists
        if (!settings) {
            settings = new Settings({ deviceId: req.params.deviceId });
            await settings.save();
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Update Settings
app.post('/api/settings/update', authenticateToken, async (req, res) => {
    try {
        const { deviceId, bedtimeWeeknight, bedtimeWeekend, uninstallProtection, locationTracking } = req.body;
        
        const settings = await Settings.findOneAndUpdate(
            { deviceId },
            { $set: { bedtimeWeeknight, bedtimeWeekend, uninstallProtection, locationTracking } },
            { new: true, upsert: true }
        );
        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ... [Rest of Server Code] ...





// Serve Frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

// ============================================
// 🔌 WEBSOCKET HANDLERS
// ============================================

io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Dashboard registers for pairing updates
    socket.on('register_pairing', (data) => {
        const { code } = data;
        
        if (pendingPairings[code]) {
            pendingPairings[code].socketId = socket.id;
            console.log(`📱 Dashboard registered for pairing code: ${code}`);
        }
    });

    // Delete device via socket
    socket.on('delete_device', async (data) => {
        try {
            const { deviceId, token } = data;
            
            // Verify token
            const decoded = jwt.verify(token, JWT_SECRET);
            
            const device = await Device.findOne({ 
                _id: deviceId, 
                userId: decoded.userId 
            });

            if (!device) {
                socket.emit('delete_error', { error: 'Device not found' });
                return;
            }

            // Delete associated data
            await Location.deleteMany({ deviceId: device.deviceId });
            await AppRule.deleteMany({ deviceId: device.deviceId });
            await WebFilter.deleteOne({ deviceId: device.deviceId });
            await Zone.deleteMany({ deviceId: device.deviceId });
            
            // Delete device
            await Device.deleteOne({ _id: deviceId });

            socket.emit('delete_success', { deviceId });
            console.log(`🗑️ Device deleted via socket: ${device.name}`);
        } catch (error) {
            socket.emit('delete_error', { error: error.message });
        }
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
    });
});

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
















