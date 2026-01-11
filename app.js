// --- CONFIG ---
const API_URL = '/api';

// --- STATE ---
let currentDevice = null;
let devices = [];
let locationInterval = null;

let liveMap = null;
let liveMarker = null;


// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) window.lucide.createIcons();
    
    const token = localStorage.getItem('token');
    if (!token && document.getElementById('device-list')) {
        window.location.href = 'index.html'; 
    } else if (token) {
        initDashboard();
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

        if (devices.length > 0) {
            if (!currentDevice || !devices.find(d => d._id === currentDevice._id)) {
                selectDevice(devices[0]);
            }
        } else {
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
    
    // Initial Data Load
    if (locationInterval) clearInterval(locationInterval);
    await Promise.all([ loadLocation(device.deviceId), loadApps(device.deviceId) ]);

    // Initialize Map if not already done
    if (!liveMap && document.getElementById('liveMap')) {
        liveMap = L.map('liveMap').setView([20.5937, 78.9629], 5); 
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(liveMap);
    }

    // Start Live Polling (every 3s)
    locationInterval = setInterval(() => {
        if(currentDevice) loadLocation(currentDevice.deviceId);
    }, 3000);
}

function showNoDevicesState() {
    currentDevice = null;
    if (locationInterval) clearInterval(locationInterval);

    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('device-status-header').classList.add('hidden');

    const emptyState = document.getElementById('empty-state');
    emptyState.classList.remove('hidden');
}

// --- TAB SWITCHING ---

function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active', 'bg-indigo-50', 'text-indigo-600');
        el.classList.add('text-slate-600', 'hover:bg-slate-50');
    });
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if(activeBtn) {
        activeBtn.classList.add('active', 'bg-indigo-50', 'text-indigo-600');
        activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-50');
    }

    if (devices.length === 0) {
        showNoDevicesState();
        return;
    }

    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('empty-state').classList.add('hidden'); 
    
    const target = document.getElementById(`view-${tabId}`);
    if(target) target.classList.remove('hidden');

    const titles = {
        'dashboard': 'Overview',
        'apps': 'App Rules & Usage',
        'web': 'Web Safety',
        'location': 'Geofencing & Map',
        'settings': 'Device Settings'
    };
    document.getElementById('page-title').textContent = titles[tabId] || 'Dashboard';

    // FIX: Resize map when tab is shown to prevent grey area
    if (tabId === 'dashboard' && liveMap) {
        setTimeout(() => {
            liveMap.invalidateSize();
            // Re-center map on last marker if available
            if (liveMarker) {
                liveMap.setView(liveMarker.getLatLng(), liveMap.getZoom());
            }
        }, 200);
    }
}

// --- DATA FETCHING ---

async function loadLocation(hardwareId) {
    try {
        const res = await authenticatedFetch(`/data/${hardwareId}/location`);
        const loc = await res.json();
        
        if (loc && loc.latitude) {
            // 1. UPDATE MAP
            if (liveMap) {
                const pos = [loc.latitude, loc.longitude];
                if (!liveMarker) {
                    liveMarker = L.marker(pos).addTo(liveMap);
                    liveMap.setView(pos, 16); 
                } else {
                    liveMarker.setLatLng(pos);
                    // Optional: Pan map to follow device
                    liveMap.setView(pos, liveMap.getZoom()); 
                }
            }

            // 2. UPDATE TEXT STATS (Matched to dashboard.html IDs)
            const timeStr = new Date(loc.timestamp).toLocaleTimeString();
            
            const lastSync = document.getElementById('last-synced-time');
            if(lastSync) lastSync.textContent = timeStr;

            const pingEl = document.getElementById('dash-last-ping');
            if(pingEl) pingEl.textContent = "Ping: " + timeStr;

            // Battery (Fixed ID selection)
            const batText = document.getElementById('dash-battery-text');
            const batBar = document.getElementById('dash-battery-bar');
            if(batText) batText.textContent = (loc.batteryLevel || 0) + '%';
            if(batBar) batBar.style.width = (loc.batteryLevel || 0) + '%';
            
            // Coordinates
            const latEl = document.getElementById('dash-lat');
            const lngEl = document.getElementById('dash-lng');
            if(latEl) latEl.textContent = loc.latitude.toFixed(4);
            if(lngEl) lngEl.textContent = loc.longitude.toFixed(4);

            // Address Placeholder
            const addrEl = document.getElementById('dash-address');
            if(addrEl) addrEl.textContent = `Lat: ${loc.latitude.toFixed(4)}, Lng: ${loc.longitude.toFixed(4)}`;

            // Speed
            const speedEl = document.getElementById('dash-speed');
            if(speedEl) {
                // Assuming speed comes from API, or default to 0
                const speed = loc.speed || 0; 
                speedEl.innerHTML = `${speed.toFixed(1)} <span class="text-xs text-slate-400 font-normal">mph</span>`;
            }
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
        let blockedCount = 0;

        apps.forEach(app => {
            totalMinutes += (app.usedToday || 0);
            if(app.isBlocked) blockedCount++;

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

        // Update Dashboard Usage Stats
        const usageEl = document.getElementById('dash-total-usage');
        const usageBar = document.getElementById('dash-usage-bar');
        // Calculate hours and minutes
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;

        // Display as "2h 15m" or just "45m" if under an hour
        if(usageEl) {
            usageEl.textContent = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
        }
        if(usageBar) {
            const pct = Math.min((totalMinutes / 120) * 100, 100); 
            usageBar.style.width = `${pct}%`;
        }

        const secCount = document.getElementById('dash-security-count');
        const secText = document.getElementById('dash-security-text');
        if(secCount) secCount.textContent = blockedCount;
        if(secText) secText.textContent = blockedCount > 0 ? `${blockedCount} apps blocked` : "No threats detected";

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