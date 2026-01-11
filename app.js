// --- CONFIG ---
const API_URL = '/api';

// --- STATE ---
let currentDevice = null;
let devices = [];
let locationInterval = null;
let map = null;
let marker = null;

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) window.lucide.createIcons();
    
    const token = localStorage.getItem('token');
    if (!token && document.getElementById('device-list')) {
        window.location.href = 'index.html'; 
    } else if (token) {
        initDashboard();
        initMap();
    }

    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.getElementById('mobile-menu-btn');
    if(menuBtn) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('-translate-x-full');
        });
    }
});

// --- CORE DASHBOARD LOGIC ---

async function initDashboard() {
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    });

    document.getElementById('add-device-btn').addEventListener('click', async () => {
        try {
            const res = await authenticatedFetch('/devices/add', { method: 'POST' });
            const data = await res.json();
            document.getElementById('pairing-code-display').textContent = data.code;
            document.getElementById('pairing-modal').classList.remove('hidden');
            // Don't reload devices here immediately, wait for user to finish pairing
        } catch (err) {
            alert('Failed to generate code');
        }
    });

    // Initial Load
    await loadDevices();
}

async function authenticatedFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
        throw new Error('Unauthorized');
    }
    return res;
}

// --- DEVICE MANAGEMENT ---

async function loadDevices() {
    try {
        const res = await authenticatedFetch('/devices');
        devices = await res.json();
        renderDeviceList();
        document.getElementById('device-count').textContent = devices.length;

        // --- NEW: AUTO-SELECT LOGIC ---
        if (devices.length > 0) {
            // If no device is currently selected, OR the selected one is gone
            // Select the FIRST device (Top of the list)
            if (!currentDevice || !devices.find(d => d._id === currentDevice._id)) {
                selectDevice(devices[0]);
            }
        } else {
            // No devices exist at all -> Show Force Add Prompt
            showNoDevicesState();
        }

    } catch (err) {
        console.error('Error loading devices', err);
    }
}

function renderDeviceList() {
    const list = document.getElementById('device-list');
    list.innerHTML = '';
    
    devices.forEach(device => {
        const li = document.createElement('li');
        const isSelected = currentDevice && currentDevice._id === device._id;
        li.className = `p-2 rounded-lg cursor-pointer flex items-center gap-2 transition-all ${
            isSelected ? 'bg-indigo-50 border border-indigo-200 shadow-sm' : 'hover:bg-slate-100 border border-transparent'
        }`;
        
        li.innerHTML = `
            <div class="${device.isPaired ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'} p-1.5 rounded-md shrink-0">
                <i data-lucide="${device.isPaired ? 'smartphone' : 'loader'}" width="14"></i>
            </div>
            <div class="overflow-hidden">
                <div class="font-bold text-xs text-slate-700 truncate">${device.name || 'Unknown Device'}</div>
                <div class="text-[10px] ${device.isPaired ? 'text-green-600' : 'text-slate-400'}">
                    ${device.isPaired ? 'Online' : 'Pending'}
                </div>
            </div>
        `;
        li.onclick = () => selectDevice(device);
        list.appendChild(li);
    });
    if (window.lucide) window.lucide.createIcons();
}

async function selectDevice(device) {
    currentDevice = device;
    renderDeviceList(); 

    // UI Updates
    document.getElementById('empty-state').classList.add('hidden');
    
    // Ensure we are on a valid tab
    let activeTabId = document.querySelector('.nav-item.active')?.id.replace('nav-', '') || 'dashboard';
    switchTab(activeTabId); 

    document.getElementById('device-status-header').classList.remove('hidden');
    document.getElementById('current-device-name-header').textContent = device.name;
    document.getElementById('active-device-name').textContent = device.name;

    // Load Data
    if (locationInterval) clearInterval(locationInterval);
    await Promise.all([ loadLocation(device.deviceId), loadApps(device.deviceId) ]);
    
    // Live Poll (every 3s)
    locationInterval = setInterval(() => loadLocation(device.deviceId), 3000);
}

function showNoDevicesState() {
    currentDevice = null;
    if (locationInterval) clearInterval(locationInterval);

    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('device-status-header').classList.add('hidden');
    document.getElementById('active-device-name').textContent = "No Devices";

    // Show Custom Empty State
    const emptyState = document.getElementById('empty-state');
    emptyState.classList.remove('hidden');
    emptyState.innerHTML = `
        <div class="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
            <i data-lucide="smartphone" width="40" class="text-indigo-600"></i>
        </div>
        <h3 class="text-xl font-bold text-slate-800 mb-2">No Connected Devices</h3>
        <p class="text-slate-500 mb-8 max-w-sm text-center">You haven't paired any devices yet. Add a child's device to start monitoring.</p>
        <button onclick="document.getElementById('add-device-btn').click()" class="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2">
            <i data-lucide="plus" width="20"></i> Add New Device
        </button>
    `;
    if (window.lucide) window.lucide.createIcons();
}

// --- TAB SWITCHING ---

function switchTab(tabId) {
    // 1. Update Navigation Styling (Always allow clicking tabs visually)
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active', 'bg-indigo-50', 'text-indigo-600');
        el.classList.add('text-slate-600', 'hover:bg-slate-50');
    });
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if(activeBtn) {
        activeBtn.classList.add('active', 'bg-indigo-50', 'text-indigo-600');
        activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-50');
    }

    // 2. BLOCK CONTENT if no device exists
    if (devices.length === 0) {
        showNoDevicesState();
        return; // Stop here, don't show tab content
    }

    // 3. Hide all tabs and Show Target
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('empty-state').classList.add('hidden'); // Hide empty state if showing tab
    
    const target = document.getElementById(`view-${tabId}`);
    if(target) target.classList.remove('hidden');

    // 4. Update Header Title
    const titles = {
        'dashboard': 'Overview',
        'apps': 'App Rules & Usage',
        'web': 'Web Safety',
        'location': 'Geofencing & Map',
        'settings': 'Device Settings'
    };
    document.getElementById('page-title').textContent = titles[tabId] || 'Dashboard';
}

// --- MAP LOGIC ---
function initMap() {
    // Initialize map centered on world (will zoom to child later)
    map = L.map('map', { zoomControl: false }).setView([20, 0], 2);
    
    // Add Free OpenStreetMap Tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    
    // Move Zoom controls to bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);
}

function updateMap(lat, lng) {
    if (!map) return;

    // Custom Icon: Small Dot + Label Text
    const customIcon = L.divIcon({
        className: 'custom-pin',
        html: `
            <div style="position: relative;">
                <div class="pin-dot"></div>
                <div class="pin-label">Child</div>
            </div>
        `,
        iconSize: [12, 12],
        iconAnchor: [6, 6] // Center the dot
    });

    if (marker) {
        marker.setLatLng([lat, lng]);
    } else {
        marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
    }

    // Zoom to exact location (Level 16 is street view)
    map.setView([lat, lng], 16);
}

// --- DATA FETCHING (Unchanged logic) ---

async function loadLocation(hardwareId) {
    try {
        const res = await authenticatedFetch(`/data/${hardwareId}/location`);
        const loc = await res.json();
        
        if (loc && loc.latitude) {
            updateMap(loc.latitude, loc.longitude);
            const timeStr = new Date(loc.timestamp).toLocaleTimeString();
            const coordsStr = `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
            
            // Dashboard Widget
            const dashCoords = document.getElementById('map-coords');
            if(dashCoords) dashCoords.textContent = coordsStr;
            const dashTime = document.getElementById('map-time');
            if(dashTime) dashTime.textContent = "Updated: " + timeStr;
            
            const bat = document.getElementById('stat-battery');
            if(bat) bat.textContent = (loc.batteryLevel || 0) + '%';
            
            const mapBatText = document.getElementById('map-battery-text');
            const mapBatBar = document.getElementById('map-battery-bar');
            if(mapBatText) mapBatText.textContent = (loc.batteryLevel || 0) + '%';
            if(mapBatBar) mapBatBar.style.width = (loc.batteryLevel || 0) + '%';
            
            document.getElementById('last-synced-time').textContent = timeStr;
        }
    } catch(e) { console.error("Loc fetch error", e); }
}

async function loadApps(hardwareId) {
    try {
        const res = await authenticatedFetch(`/data/${hardwareId}/apps`);
        const apps = await res.json();
        const tbody = document.getElementById('app-list-body');
        
        tbody.innerHTML = '';
        let totalMinutes = 0;

        apps.forEach(app => {
            totalMinutes += (app.usedToday || 0);
            const row = document.createElement('tr');
            row.className = "hover:bg-slate-50 transition-colors border-b border-slate-50";
            row.innerHTML = `
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg uppercase">
                            ${(app.appName || "?")[0]}
                        </div>
                        <div>
                            <div class="font-bold text-slate-800">${app.appName || app.packageName}</div>
                            <div class="text-xs text-slate-400 font-mono">${app.packageName}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        ${app.usedToday || 0} min
                    </span>
                </td>
                <td class="px-6 py-4 text-center">
                    <button onclick="updateAppRule('${app.packageName}', ${!app.isBlocked}, ${app.timeLimit})" 
                        class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${app.isBlocked ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}">
                        ${app.isBlocked ? 'Blocked' : 'Active'}
                    </button>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                        <input type="number" class="w-16 p-1.5 border border-slate-300 rounded-lg text-center text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                            value="${app.timeLimit}" min="0" 
                            onchange="updateAppRule('${app.packageName}', ${app.isBlocked}, this.value)">
                        <span class="text-xs text-slate-400">min</span>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        const appCount = document.getElementById('stat-apps-count');
        if(appCount) appCount.textContent = apps.length;
        
    } catch(e) { console.error("App fetch error", e); }
}

window.updateAppRule = async (packageName, isBlocked, timeLimit) => {
    if (!currentDevice) return;
    try {
        await authenticatedFetch('/rules/update', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: currentDevice.deviceId,
                packageName,
                isBlocked,
                timeLimit: parseInt(timeLimit) || 0
            })
        });
        loadApps(currentDevice.deviceId);
    } catch (err) {
        console.error('Failed to update rule', err);
    }
};







function renderDashboard(loc, apps) {
    // 1. Calculate Metrics
    let totalMinutes = 0;
    let blockedCount = 0;
    
    apps.forEach(app => {
        totalMinutes += (app.usedToday || 0);
        if (app.isBlocked) blockedCount++;
    });

    // 2. Update Security Card
    const secCountEl = document.getElementById('dash-security-count');
    const secTextEl = document.getElementById('dash-security-text');
    if(secCountEl) secCountEl.textContent = blockedCount;
    if(secTextEl) secTextEl.textContent = blockedCount > 0 ? "Apps currently blocked" : "No active blocks";

    // 3. Update Screen Time Card
    const usageEl = document.getElementById('dash-total-usage');
    const usageBar = document.getElementById('dash-usage-bar');
    if(usageEl) usageEl.textContent = `${totalMinutes}m`;
    if(usageBar) {
        // Assuming 120 minutes (2 hours) is the 100% mark for visual reference
        const pct = Math.min((totalMinutes / 120) * 100, 100); 
        usageBar.style.width = `${pct}%`;
    }

    // 4. Update System Status
    const pingEl = document.getElementById('dash-last-ping');
    if(pingEl && loc.timestamp) {
        pingEl.textContent = "Ping: " + new Date(loc.timestamp).toLocaleTimeString();
    }

    // 5. Update Map & Telemetry
    if (loc && loc.latitude) {
        // Battery
        document.getElementById('dash-battery-text').textContent = (loc.batteryLevel || 0) + '%';
        document.getElementById('dash-battery-bar').style.width = (loc.batteryLevel || 0) + '%';
        
        // Coords
        document.getElementById('dash-lat').textContent = loc.latitude.toFixed(4);
        document.getElementById('dash-lng').textContent = loc.longitude.toFixed(4);
        
        // Speed (Mocking it for now as loc.speed might not exist yet)
        const speed = loc.speed || 0;
        document.getElementById('dash-speed').innerHTML = `${speed.toFixed(1)} <span class="text-xs text-slate-400 font-normal">mph</span>`;
        document.getElementById('map-status-tag').textContent = `Live • ${speed.toFixed(1)} mph`;

        // Address (Placeholder - Requires Reverse Geocoding API in real app)
        // For now, we show a clean formatted string of coords
        document.getElementById('dash-address').textContent = `Near ${loc.latitude.toFixed(3)}, ${loc.longitude.toFixed(3)}`;
    }
}





