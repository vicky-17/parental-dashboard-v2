// --- CONFIG ---
const API_URL = '/api';

// --- STATE ---
let currentDevice = null;
let devices = [];
let locationInterval = null;
let currentApps = []; 
let modifiedApps = new Set(); // Tracks indices of modified apps

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

    // Create Floating Save Button Container
    const saveBtnHTML = `
        <div id="save-changes-container" class="fixed bottom-6 right-6 z-50 transform translate-y-20 transition-transform duration-300">
            <button onclick="window.saveAllChanges()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-full shadow-lg flex items-center gap-2 animate-bounce-slight">
                <i data-lucide="save" width="20"></i>
                <span>Save Changes</span>
            </button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', saveBtnHTML);
    if (window.lucide) window.lucide.createIcons();
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
    document.getElementById('empty-state').classList.add('hidden');
    
    let activeTabId = document.querySelector('.nav-item.active')?.id.replace('nav-', '') || 'dashboard';
    switchTab(activeTabId); 

    document.getElementById('device-status-header').classList.remove('hidden');
    document.getElementById('current-device-name-header').textContent = device.name;
    
    if (locationInterval) clearInterval(locationInterval);
    
    // Clear modifications on device switch
    modifiedApps.clear();
    toggleSaveButton();

    // [UPDATED] Added loadWebData to the Promise.all
    await Promise.all([ 
        loadLocation(device.deviceId), 
        loadApps(device.deviceId),
        loadWebData(device.deviceId) 
    ]);

    if (!liveMap && document.getElementById('liveMap')) {
        liveMap = L.map('liveMap').setView([20.5937, 78.9629], 5); 
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(liveMap);
    }

    locationInterval = setInterval(() => {
        if(currentDevice) loadLocation(currentDevice.deviceId);
    }, 3000);
}

function showNoDevicesState() {
    currentDevice = null;
    if (locationInterval) clearInterval(locationInterval);
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('device-status-header').classList.add('hidden');
    document.getElementById('empty-state').classList.remove('hidden');
}

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

    if (tabId === 'dashboard' && liveMap) {
        setTimeout(() => {
            liveMap.invalidateSize();
            if (liveMarker) {
                liveMap.setView(liveMarker.getLatLng(), liveMap.getZoom());
            }
        }, 200);
    }
}

async function loadLocation(hardwareId) {
    try {
        const res = await authenticatedFetch(`/data/${hardwareId}/location`);
        const loc = await res.json();
        
        if (loc && loc.latitude) {
            if (liveMap) {
                const pos = [loc.latitude, loc.longitude];
                if (!liveMarker) {
                    liveMarker = L.marker(pos).addTo(liveMap);
                    liveMap.setView(pos, 16); 
                } else {
                    liveMarker.setLatLng(pos);
                }
            }

            const timeStr = new Date(loc.timestamp).toLocaleTimeString();
            document.getElementById('last-synced-time').textContent = timeStr;
            document.getElementById('dash-last-ping').textContent = "Ping: " + timeStr;
            document.getElementById('dash-battery-text').textContent = (loc.batteryLevel || 0) + '%';
            document.getElementById('dash-battery-bar').style.width = (loc.batteryLevel || 0) + '%';
            document.getElementById('dash-lat').textContent = loc.latitude.toFixed(4);
            document.getElementById('dash-lng').textContent = loc.longitude.toFixed(4);
            document.getElementById('dash-address').textContent = `Lat: ${loc.latitude.toFixed(4)}, Lng: ${loc.longitude.toFixed(4)}`;
            document.getElementById('dash-speed').innerHTML = `${(loc.speed || 0).toFixed(1)} <span class="text-xs text-slate-400 font-normal">mph</span>`;
        }
    } catch(e) { console.error("Loc fetch error", e); }
}

function getAppColor(name) {
    const n = (name || "").toLowerCase();
    if (n.includes('tiktok')) return 'bg-black';
    if (n.includes('youtube')) return 'bg-red-600';
    if (n.includes('roblox')) return 'bg-red-500';
    if (n.includes('instagram')) return 'bg-pink-600';
    if (n.includes('facebook')) return 'bg-blue-600';
    if (n.includes('whatsapp')) return 'bg-green-500';
    return 'bg-indigo-600';
}

async function loadApps(hardwareId) {
    try {
        const res = await authenticatedFetch(`/data/${hardwareId}/apps`);
        currentApps = await res.json(); 
        modifiedApps.clear(); // Clear unsaved changes on refresh
        toggleSaveButton();
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
        const isModified = modifiedApps.has(index.toString());
        
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

        // Highlight Modified Cards
        if (isModified) {
            cardClasses += " ring-2 ring-indigo-500 ring-offset-2";
        }

        const appColor = getAppColor(app.appName);
        
        // HTML Construction
        const cardHTML = `
            <div class="${cardClasses}">
                ${isModified ? `<div class="absolute top-0 right-0 bg-indigo-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg z-10">UNSAVED</div>` : ''}

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

// --- NEW SAVE FUNCTIONALITY ---

function markAsModified(idx) {
    modifiedApps.add(idx.toString());
    toggleSaveButton();
    renderAppGrid();
    updateDashboardUsageStats();
}

function toggleSaveButton() {
    const btnContainer = document.getElementById('save-changes-container');
    if (!btnContainer) return;
    
    if (modifiedApps.size > 0) {
        btnContainer.classList.remove('translate-y-20');
    } else {
        btnContainer.classList.add('translate-y-20');
    }
}

window.toggleAppLock = (idx) => {
    if (!currentDevice) return;
    const app = currentApps[idx];
    app.isGlobalLocked = !app.isGlobalLocked;
    markAsModified(idx);
};

window.addSchedule = (idx) => {
    const app = currentApps[idx];
    if (!app.schedules) app.schedules = [];
    
    const newSlot = {
        id: Date.now().toString(),
        day: 'Everyday',
        start: '12:00',
        end: '13:00'
    };
    app.schedules.push(newSlot);
    markAsModified(idx);
};

window.removeSchedule = (appIdx, scheduleId) => {
    const app = currentApps[appIdx];
    app.schedules = app.schedules.filter(s => s.id !== scheduleId);
    markAsModified(appIdx);
};

window.saveSchedule = (appIdx, scheduleId, field, value) => {
    const app = currentApps[appIdx];
    const slot = app.schedules.find(s => s.id === scheduleId);
    if (slot) {
        slot[field] = value;
        markAsModified(appIdx);
    }
};

window.saveAllChanges = async () => {
    if (!currentDevice || modifiedApps.size === 0) return;

    const btn = document.querySelector('#save-changes-container button');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin" width="20"></i> Saving...`;
    if(window.lucide) window.lucide.createIcons();

    try {
        const promises = Array.from(modifiedApps).map(idx => {
            const app = currentApps[parseInt(idx)];
            return authenticatedFetch('/rules/update', {
                method: 'POST',
                body: JSON.stringify({
                    deviceId: currentDevice.deviceId,
                    packageName: app.packageName,
                    schedules: app.schedules,
                    isGlobalLocked: app.isGlobalLocked
                })
            });
        });

        await Promise.all(promises);
        
        // Success
        modifiedApps.clear();
        toggleSaveButton();
        btn.innerHTML = originalText;
        alert("Settings saved successfully!");

    } catch (err) {
        console.error('Failed to save changes', err);
        btn.innerHTML = originalText;
        alert("Failed to save changes. Please try again.");
    }
};









// --- WEB SAFETY LOGIC ---

let webFilterData = {
    blockedCategories: [], // Default AI Categories
    blockedUrls: [],
    history: []
};

// 1. Fetch Data
async function loadWebData(hardwareId) {
    try {
        const res = await authenticatedFetch(`/web/${hardwareId}`);
        webFilterData = await res.json();
        renderWebConfig();
        renderWebHistory();
    } catch(e) {
        console.error("Web Data Error", e);
    }
}

// 2. Render Config (Left Panel)
function renderWebConfig() {
    // Categories (The "Buttons" to show if no URLs are present)
    const categories = ['pornography', 'gambling', 'violence', 'social-media'];
    const catContainer = document.getElementById('category-list');
    
    if (catContainer) {
        catContainer.innerHTML = categories.map(cat => {
            const isBlocked = webFilterData.blockedCategories.includes(cat);
            return `
                <div class="flex items-center justify-between group py-2 border-b border-slate-50 last:border-0">
                    <div class="flex items-center gap-3">
                         <div class="p-1.5 rounded-md ${isBlocked ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}">
                            <i data-lucide="${isBlocked ? 'shield-alert' : 'shield'}" width="16"></i>
                         </div>
                         <span class="text-sm font-medium text-slate-700 capitalize group-hover:text-indigo-600 transition-colors">${cat.replace('-', ' ')}</span>
                    </div>
                    <button onclick="window.toggleWebCategory('${cat}')" 
                        class="w-10 h-5 flex items-center rounded-full p-1 transition-colors duration-300 focus:outline-none ${isBlocked ? 'bg-indigo-600' : 'bg-slate-300'}">
                        <div class="bg-white w-3 h-3 rounded-full shadow-md transform transition-transform duration-300 ${isBlocked ? 'translate-x-5' : 'translate-x-0'}"></div>
                    </button>
                </div>
            `;
        }).join('');
    }

    // URL List
    const urlContainer = document.getElementById('url-list');
    if (urlContainer) {
        if(webFilterData.blockedUrls.length === 0) {
            // [UPDATED] Visual cue that we are relying on Categories/AI
            urlContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center py-6 px-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    <i data-lucide="shield-check" class="text-green-500 mb-2" width="24"></i>
                    <p class="text-xs text-slate-500 font-medium">No custom URLs blocked.</p>
                    <p class="text-[10px] text-slate-400 mt-1">Protection is active using the <b>Blocked Categories</b> above.</p>
                </div>`;
        } else {
            urlContainer.innerHTML = webFilterData.blockedUrls.map(url => `
                <div class="flex items-center justify-between bg-white px-3 py-2.5 rounded-lg border border-slate-200 shadow-sm hover:border-red-200 transition-all group">
                    <div class="flex items-center gap-2 overflow-hidden">
                        <i data-lucide="globe" width="14" class="text-slate-400"></i>
                        <span class="text-xs font-bold text-slate-700 truncate">${url}</span>
                    </div>
                    <button onclick="window.removeBlockedUrl('${url}')" class="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors">
                        <i data-lucide="x" width="14"></i>
                    </button>
                </div>
            `).join('');
        }
    }
    
    if (window.lucide) window.lucide.createIcons();
}

// 3. Render History (Right Panel)
function renderWebHistory() {
    const container = document.getElementById('history-rows');
    if (!container) return;

    if (!webFilterData.history || webFilterData.history.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-12 flex flex-col items-center"><i data-lucide="history" class="mb-2 opacity-50" width="24"></i>No browsing history available</div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    container.innerHTML = webFilterData.history.map(item => {
        const score = item.riskScore || 0;
        let badgeClass = "bg-green-100 text-green-700 border-green-200";
        let scoreLabel = "Safe";
        
        if (score > 80) { 
            badgeClass = "bg-red-100 text-red-700 border-red-200";
            scoreLabel = "High Risk";
        } else if (score > 30) {
            badgeClass = "bg-orange-100 text-orange-700 border-orange-200";
            scoreLabel = "Medium";
        }

        const time = new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        return `
            <div class="px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors grid grid-cols-12 gap-4 items-center group">
                <div class="col-span-3 text-xs font-mono text-slate-400">${time}</div>
                <div class="col-span-7 overflow-hidden">
                    <div class="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">${item.title}</div>
                    <div class="text-[10px] text-slate-400 truncate font-mono">${item.url}</div>
                </div>
                <div class="col-span-2 text-right">
                    <span class="${badgeClass} px-2 py-0.5 rounded text-[10px] font-bold border inline-block min-w-[60px] text-center">
                        ${scoreLabel}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

// 4. Actions (Immediate Save to MongoDB)
async function syncWebConfig() {
    if (!currentDevice) return;
    try {
        await authenticatedFetch('/web/update', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: currentDevice.deviceId,
                blockedCategories: webFilterData.blockedCategories,
                blockedUrls: webFilterData.blockedUrls
            })
        });
    } catch(e) { console.error("Sync failed", e); }
}

window.toggleWebCategory = (cat) => {
    if (webFilterData.blockedCategories.includes(cat)) {
        webFilterData.blockedCategories = webFilterData.blockedCategories.filter(c => c !== cat);
    } else {
        webFilterData.blockedCategories.push(cat);
    }
    renderWebConfig();
    syncWebConfig(); // Saves to DB
};

window.addBlockedUrl = () => {
    const input = document.getElementById('new-url-input');
    const url = input.value.trim();
    
    // Simple validation
    if (url && !webFilterData.blockedUrls.includes(url)) {
        webFilterData.blockedUrls.push(url);
        input.value = ''; // Clear input
        renderWebConfig(); // Update UI
        syncWebConfig(); // Save to DB
    }
};

window.removeBlockedUrl = (url) => {
    webFilterData.blockedUrls = webFilterData.blockedUrls.filter(u => u !== url);
    renderWebConfig();
    syncWebConfig(); // Save to DB
};

// 5. AI Analysis
window.analyzeWebSafety = async () => {
    const btn = document.getElementById('ai-trigger-btn');
    const btnText = document.getElementById('ai-btn-text');
    const box = document.getElementById('ai-insight-box');
    const resultText = document.getElementById('ai-result-text');

    btnText.textContent = "Analyzing...";
    btn.classList.add('opacity-75', 'cursor-wait');
    
    try {
        const res = await authenticatedFetch('/web/analyze', {
            method: 'POST',
            body: JSON.stringify({
                history: webFilterData.history,
                blockedCategories: webFilterData.blockedCategories
            })
        });
        const data = await res.json();
        
        resultText.innerText = data.analysis || "No insights found.";
        box.classList.remove('hidden');
        box.classList.add('animate-fade-in');

    } catch (e) {
        alert("Analysis failed. Please try again.");
    } finally {
        btnText.textContent = "Analyze Risks with AI";
        btn.classList.remove('opacity-75', 'cursor-wait');
    }
};

