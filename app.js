// --- CONFIG ---
const API_URL = '/api';

// --- STATE ---
let currentDevice = null;
let devices = [];
let locationInterval = null;
let currentApps = []; // New: Local state for apps

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
            if (liveMarker) {
                liveMap.setView(liveMarker.getLatLng(), liveMap.getZoom());
            }
        }, 200);
    }
}

// --- DATA FETCHING: LOCATION ---

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
                    liveMap.setView(pos, liveMap.getZoom()); 
                }
            }

            // 2. UPDATE TEXT STATS
            const timeStr = new Date(loc.timestamp).toLocaleTimeString();
            
            const lastSync = document.getElementById('last-synced-time');
            if(lastSync) lastSync.textContent = timeStr;

            const pingEl = document.getElementById('dash-last-ping');
            if(pingEl) pingEl.textContent = "Ping: " + timeStr;

            // Battery
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
                const speed = loc.speed || 0; 
                speedEl.innerHTML = `${speed.toFixed(1)} <span class="text-xs text-slate-400 font-normal">mph</span>`;
            }
        }
    } catch(e) { console.error("Loc fetch error", e); }
}

// --- DATA FETCHING: APPS (NEW UI) ---

// Helper for first-letter colors
function getAppColor(name) {
    const n = (name || "").toLowerCase();
    if (n.includes('tiktok')) return 'bg-black';
    if (n.includes('youtube')) return 'bg-red-600';
    if (n.includes('roblox')) return 'bg-red-500';
    if (n.includes('instagram')) return 'bg-pink-600';
    if (n.includes('facebook')) return 'bg-blue-600';
    if (n.includes('whatsapp')) return 'bg-green-500';
    if (n.includes('snapchat')) return 'bg-yellow-400';
    if (n.includes('minecraft')) return 'bg-green-700';
    if (n.includes('chrome')) return 'bg-blue-500';
    return 'bg-indigo-600'; // Default
}

async function loadApps(hardwareId) {
    try {
        const res = await authenticatedFetch(`/data/${hardwareId}/apps`);
        currentApps = await res.json(); // Store in global state
        renderAppGrid();
        updateDashboardUsageStats();
    } catch(e) { 
        console.error("App fetch error", e); 
        const container = document.getElementById('app-grid-container');
        if(container) container.innerHTML = `<div class="col-span-full text-center text-red-500">Failed to load apps</div>`;
    }
}

function renderAppGrid() {
    const container = document.getElementById('app-grid-container');
    if (!container) return;
    
    container.innerHTML = '';

    if (currentApps.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center text-slate-500 py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <i data-lucide="smartphone" class="mx-auto mb-2 opacity-50" width="32"></i>
                <p>No apps found on this device.</p>
            </div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    currentApps.forEach((app, index) => {
        // Logic: Determine State
        const isLocked = app.isGlobalLocked === true;
        const hasSchedules = app.schedules && app.schedules.length > 0;
        
        let cardClasses = "relative rounded-xl border-2 transition-all overflow-hidden ";
        let statusBadge = "";
        
        // 1. Determine Colors & Status
        if (!isLocked) {
            // GREEN: Unlocked / Safe
            cardClasses += "bg-green-50 border-green-200 hover:border-green-300";
            statusBadge = `<span class="text-green-700 text-xs font-bold uppercase tracking-wider">Unlocked</span>`;
        } else if (isLocked && !hasSchedules) {
            // RED: Locked completely (No schedule)
            cardClasses += "bg-red-50 border-red-200 shadow-sm shadow-red-100";
            statusBadge = `<div class="bg-red-500 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full flex items-center gap-1"><i data-lucide="lock" width="10"></i> Locked</div>`;
        } else {
            // ORANGE: Locked but has Schedule
            cardClasses += "bg-orange-50 border-orange-200 shadow-sm shadow-orange-100";
            statusBadge = `<div class="bg-orange-500 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full flex items-center gap-1"><i data-lucide="clock" width="10"></i> Scheduled</div>`;
        }

        const appColor = getAppColor(app.appName);
        
        // HTML Construction
        const cardHTML = `
            <div class="${cardClasses}">
                <div class="p-5">
                    <div class="flex flex-col md:flex-row justify-between gap-4">
                        
                        <div class="flex items-center gap-4">
                            <div class="${appColor} w-14 h-14 rounded-2xl shadow-sm flex items-center justify-center text-white text-2xl font-bold shrink-0">
                                ${(app.appName || "?")[0].toUpperCase()}
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-900 text-lg leading-tight">${app.appName || app.packageName}</h4>
                                <div class="flex items-center gap-2 mt-1">
                                    ${statusBadge}
                                    <span class="text-xs text-slate-500 font-medium">| Used: ${app.usedToday || 0}m</span>
                                </div>
                            </div>
                        </div>

                        <button onclick="window.toggleAppLock('${index}')" 
                            class="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm h-10 shrink-0
                            ${isLocked 
                                ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' 
                                : 'bg-green-600 text-white hover:bg-green-700 border border-green-600'
                            }">
                            <i data-lucide="${isLocked ? 'unlock' : 'lock'}" width="16"></i>
                            <span>${isLocked ? 'Unlock' : 'Lock App'}</span>
                        </button>
                    </div>

                    ${isLocked ? `
                        <div class="mt-6 pt-4 border-t ${hasSchedules ? 'border-orange-200' : 'border-red-200'}">
                            
                            ${!hasSchedules ? `
                                <div class="flex items-center justify-between">
                                    <p class="text-xs text-red-600 italic">App is completely blocked.</p>
                                    <button onclick="window.addSchedule('${index}')" class="text-xs font-bold bg-white border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm">
                                        <i data-lucide="plus" width="12"></i> Add Schedule
                                    </button>
                                </div>
                            ` : `
                            
                            <div class="flex items-center justify-between mb-3">
                                    <h5 class="text-xs font-bold text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                                        Active Schedules
                                    </h5>
                                    <button onclick="window.addSchedule('${index}')" class="text-xs font-bold text-orange-600 hover:bg-orange-100 px-2 py-1 rounded transition-colors flex items-center gap-1">
                                        <i data-lucide="plus" width="12"></i> Add Slot
                                    </button>
                                </div>

                                <div class="space-y-2">
                                    ${app.schedules.map(slot => `
                                        <div class="flex items-center gap-2 bg-white border border-orange-200 p-2 rounded-lg shadow-sm">
                                            <span class="text-[10px] font-bold text-orange-600 uppercase bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">Everyday</span>
                                            <div class="flex-1 flex items-center gap-2">
                                                <input type="time" value="${slot.start}" 
                                                    onchange="window.saveSchedule('${index}', '${slot.id}', 'start', this.value)"
                                                    class="bg-slate-50 border border-slate-200 rounded text-xs px-2 py-1 text-slate-700 w-full focus:border-orange-500 focus:bg-white outline-none transition-colors">
                                                <span class="text-slate-300">-</span>
                                                <input type="time" value="${slot.end}" 
                                                    onchange="window.saveSchedule('${index}', '${slot.id}', 'end', this.value)"
                                                    class="bg-slate-50 border border-slate-200 rounded text-xs px-2 py-1 text-slate-700 w-full focus:border-orange-500 focus:bg-white outline-none transition-colors">
                                            </div>
                                            <button onclick="window.removeSchedule('${index}', '${slot.id}')" class="text-slate-400 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-md">
                                                <i data-lucide="trash-2" width="14"></i>
                                            </button>
                                        </div>
                                    `).join('')}
                                </div>
                            `}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });

    if (window.lucide) window.lucide.createIcons();
}

function updateDashboardUsageStats() {
    let totalMinutes = 0;
    let blockedCount = 0;
    currentApps.forEach(app => {
        totalMinutes += (app.usedToday || 0);
        if(app.isGlobalLocked) blockedCount++;
    });

    const usageEl = document.getElementById('dash-total-usage');
    const usageBar = document.getElementById('dash-usage-bar');
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if(usageEl) usageEl.textContent = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    if(usageBar) {
        const pct = Math.min((totalMinutes / 120) * 100, 100); 
        usageBar.style.width = `${pct}%`;
    }

    const secCount = document.getElementById('dash-security-count');
    const secText = document.getElementById('dash-security-text');
    if(secCount) secCount.textContent = blockedCount;
    if(secText) secText.textContent = blockedCount > 0 ? `${blockedCount} apps locked` : "No restrictions active";
}

// --- APP ACTIONS (Exposed to Window for HTML OnClick) ---

window.toggleAppLock = async (idx) => {
    if (!currentDevice) return;
    const app = currentApps[idx];
    const newStatus = !app.isGlobalLocked;
    
    // 1. Optimistic UI Update (Update local state & re-render immediately)
    app.isGlobalLocked = newStatus;
    renderAppGrid(); 
    updateDashboardUsageStats();

    // 2. Server Call
    try {
        await authenticatedFetch('/rules/update', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: currentDevice.deviceId,
                packageName: app.packageName,
                isGlobalLocked: newStatus,
                isBlocked: newStatus // Keeping isBlocked for compatibility if needed
            })
        });
    } catch (err) {
        console.error('Failed to update lock', err);
        // Revert on failure
        app.isGlobalLocked = !newStatus;
        renderAppGrid();
        alert("Failed to save changes. Check connection.");
    }
};

window.addSchedule = async (idx) => {
    const app = currentApps[idx];
    if (!app.schedules) app.schedules = [];
    
    const newSlot = {
        id: Date.now().toString(),
        day: 'Everyday',
        start: '12:00',
        end: '13:00'
    };
    app.schedules.push(newSlot);
    renderAppGrid();

    // Sync changes
    syncAppRules(app);
};

window.removeSchedule = async (appIdx, scheduleId) => {
    const app = currentApps[appIdx];
    app.schedules = app.schedules.filter(s => s.id !== scheduleId);
    renderAppGrid();
    syncAppRules(app);
};

window.saveSchedule = async (appIdx, scheduleId, field, value) => {
    const app = currentApps[appIdx];
    const slot = app.schedules.find(s => s.id === scheduleId);
    if (slot) {
        slot[field] = value;
        syncAppRules(app);
    }
};

async function syncAppRules(app) {
    if (!currentDevice) return;
    try {
        await authenticatedFetch('/rules/update', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: currentDevice.deviceId,
                packageName: app.packageName,
                schedules: app.schedules,
                isGlobalLocked: app.isGlobalLocked
            })
        });
    } catch (err) {
        console.error('Failed to sync rules', err);
    }
}