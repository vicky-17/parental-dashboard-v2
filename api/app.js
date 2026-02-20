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

let currentSortMode = 'usage';

function toMinutes(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function formatUsedMinutes(value) {
    return `${Math.round(toMinutes(value))}m`;
}


// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // --- INSERT THIS SECTION START ---
    
    const authForm = document.getElementById('auth-form');
    
    // Only run this logic if we are on the login page (index.html)
    if (authForm) {
        const toggleBtn = document.getElementById('toggle-auth');
        const submitBtn = document.getElementById('submit-btn');
        const toggleText = document.getElementById('toggle-text');
        const errorMsg = document.getElementById('error-message');
        let isLogin = true; // Tracks if user is trying to Login or Register

        // 1. Handle Toggle (Switch between Login and Signup)
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                isLogin = !isLogin; // Flip the state
                
                // Update UI Text
                submitBtn.textContent = isLogin ? 'Sign In' : 'Create Account';
                toggleText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
                toggleBtn.textContent = isLogin ? 'Sign up' : 'Log in';
                errorMsg.classList.add('hidden'); // Clear errors
            });
        }

        // 2. Handle Form Submission (Send data to Server)
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            // Basic Validation
            if (!email || !password) {
                errorMsg.textContent = "Please enter both email and password.";
                errorMsg.classList.remove('hidden');
                return;
            }

            try {
                // Determine which endpoint to hit based on isLogin state
                const endpoint = isLogin ? '/auth/login' : '/auth/register';
                
                const res = await fetch(`${API_URL}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();

                if (!res.ok) throw new Error(data.message || 'Action failed');

                if (isLogin) {
                    // Login Success: Save token & Redirect
                    localStorage.setItem('token', data.token);
                    window.location.href = 'dashboard.html'; // Or '/dashboard' depending on your server routes
                } else {
                    // Register Success: Switch back to login view
                    alert("Account created! Please sign in.");
                    toggleBtn.click(); // Programmatically switch to login view
                }

            } catch (err) {
                errorMsg.textContent = err.message;
                errorMsg.classList.remove('hidden');
            }
        });
    }



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

    // Request notification permissions after the dashboard loads
    setupPushNotifications();
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
        loadWebData(device.deviceId),
        loadZones(device.deviceId),
        loadSettings(device.deviceId)
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

    // 1. Dashboard Map Refresh
    if (tabId === 'dashboard' && liveMap) {
        setTimeout(() => {
            liveMap.invalidateSize();
            if (liveMarker) {
                liveMap.setView(liveMarker.getLatLng(), liveMap.getZoom());
            }
        }, 200);
    }

    // [NEW] 2. Geofencing Map Initialization
    if (tabId === 'location') {
        setTimeout(() => {
            // Initialize map if it doesn't exist yet
            if (!geofenceMap) {
                initGeofenceMap();
            } else {
                geofenceMap.invalidateSize(); // Fixes partial rendering
            }

            // Auto-zoom to child's last known location
            if (lastKnownLocation && geofenceMap) {
                geofenceMap.setView([lastKnownLocation.lat, lastKnownLocation.lng], 15);
            }
            
            // Ensure zones are drawn
            renderZonesOnMap();
        }, 200);
    }
}

async function loadLocation(hardwareId) {
    try {
        const res = await authenticatedFetch(`/data/${hardwareId}/location`);
        const loc = await res.json();
        
        if (loc && loc.latitude) {
            // [NEW] Save for Geofencing use
            lastKnownLocation = { lat: loc.latitude, lng: loc.longitude };

            if (liveMap) {
                const pos = [loc.latitude, loc.longitude];
                if (!liveMarker) {
                    liveMarker = L.marker(pos).addTo(liveMap);
                    liveMap.setView(pos, 16); 
                } else {
                    liveMarker.setLatLng(pos);
                }
            }
            // ... (Rest of your UI update code: battery, speed, etc.) ...
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







// --- SORTING LOGIC ---

function applyAppSort() {
    if (!currentApps) return;

    currentApps.sort((a, b) => {
        const nameA = (a.appName || a.packageName || "").toLowerCase();
        const nameB = (b.appName || b.packageName || "").toLowerCase();

        switch (currentSortMode) {
            case 'usage':
                // Higher usage first (descending)
                return toMinutes(b.usedToday) - toMinutes(a.usedToday);
            
            case 'alpha':
                // A-Z (ascending)
                return nameA.localeCompare(nameB);
            
            case 'locked':
                // Locked (true) comes before Unlocked (false)
                return (b.isGlobalLocked === true ? 1 : 0) - (a.isGlobalLocked === true ? 1 : 0);

            case 'unlocked':
                // Unlocked (false) comes before Locked (true)
                return (a.isGlobalLocked === true ? 1 : 0) - (b.isGlobalLocked === true ? 1 : 0);
                
            default:
                return 0;
        }
    });
}

window.handleSortChange = (mode) => {
    currentSortMode = mode;
    applyAppSort();
    renderAppGrid(); // Re-render the grid with new order
};








async function loadApps(hardwareId) {
    try {
        const res = await authenticatedFetch(`/data/${hardwareId}/apps`);
        currentApps = await res.json(); 
        modifiedApps.clear(); // Clear unsaved changes on refresh
        toggleSaveButton();
        applyAppSort();
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
                                        <span class="text-xs text-slate-500 font-medium">| Used: ${formatUsedMinutes(app.usedToday)}</span>
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
        totalMinutes += toMinutes(app.usedToday);
        if(app.isGlobalLocked) blockedCount++;
    });

    const usageEl = document.getElementById('dash-total-usage');
    const usageBar = document.getElementById('dash-usage-bar');
    const roundedTotal = Math.round(totalMinutes);
    const hrs = Math.floor(roundedTotal / 60);
    const mins = roundedTotal % 60;

    if(usageEl) usageEl.textContent = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    if(usageBar) {
        const pct = Math.min((roundedTotal / 120) * 100, 100); 
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

// ------------------------------------------------------------------------------





// --- GEOFENCING LOGIC ---

let currentZones = [];
let geofenceMap = null;
let drawingLayer = null; // LayerGroup for drawing points/lines
let drawnPoints = []; // Array of {lat, lng}
let isDrawing = false;
let zoneLayers = []; // Store references to rendered polygons to remove them easily
let lastKnownLocation = null;



// 1. Fetch Zones
async function loadZones(hardwareId) {
    try {
        const res = await authenticatedFetch(`/zones/${hardwareId}`);
        currentZones = await res.json();
        renderZoneList();
        renderZonesOnMap();
    } catch(e) {
        console.error("Zone fetch error", e);
    }
}

// 2. Initialize/Render Map
function initGeofenceMap() {
    // Only create if it doesn't exist
    if (!geofenceMap && document.getElementById('geofenceMap')) {
        geofenceMap = L.map('geofenceMap').setView([20.5937, 78.9629], 5);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(geofenceMap);

        geofenceMap.on('click', (e) => {
            if (isDrawing) {
                addDrawingPoint(e.latlng);
            }
        });
    }
}


// [NEW] Zoom to specific zone when clicked in the list
window.focusOnZone = (id) => {
    // 1. Find the zone data
    const zone = currentZones.find(z => z._id === id);
    if (!zone || !geofenceMap || !zone.points || zone.points.length === 0) return;

    // 2. Create a temporary polygon to calculate bounds
    const polygon = L.polygon(zone.points);
    
    // 3. Fly to that area
    geofenceMap.flyToBounds(polygon.getBounds(), { padding: [50, 50], duration: 1.5 });
    
    // 4. Open its popup if we found the layer
    const layer = zoneLayers.find(l => l.zoneId === id);
    if(layer) layer.openPopup();
};


// 3. Render Zones Visuals on Map
function renderZonesOnMap() {
    if (!geofenceMap) return;

    // Clear old layers
    zoneLayers.forEach(layer => geofenceMap.removeLayer(layer));
    zoneLayers = [];

    currentZones.forEach(zone => {
        if (!zone.points || zone.points.length < 3) return;

        const color = zone.type === 'safe' ? '#22c55e' : '#ef4444'; 
        const polygon = L.polygon(zone.points, {
            color: color,
            fillColor: color,
            fillOpacity: 0.2,
            weight: 2
        }).addTo(geofenceMap);
        
        polygon.bindPopup(`<b>${zone.name}</b><br>${zone.type === 'safe' ? 'Safe Zone' : 'Danger Zone'}`);
        
        // Tag layer with ID for lookup later
        polygon.zoneId = zone._id; 
        zoneLayers.push(polygon);
    });
}

// 4. Drawing Logic (Frontend)
window.startDrawingZone = () => {
    if(!geofenceMap) initGeofenceMap();
    
    // If we have a location, ensure we are looking at it before drawing
    if (lastKnownLocation) {
        geofenceMap.setView([lastKnownLocation.lat, lastKnownLocation.lng], 16);
    }

    isDrawing = true;
    drawnPoints = [];
    
    document.getElementById('geofenceMap').classList.add('drawing-cursor');
    document.getElementById('map-controls').classList.remove('hidden');
    document.getElementById('drawing-instructions').classList.remove('hidden');
    
    if (drawingLayer) geofenceMap.removeLayer(drawingLayer);
    drawingLayer = L.layerGroup().addTo(geofenceMap);
};

function addDrawingPoint(latlng) {
    drawnPoints.push(latlng);
    
    // Visual feedback
    L.circleMarker(latlng, { radius: 5, color: '#4f46e5' }).addTo(drawingLayer);
    
    if (drawnPoints.length > 1) {
        L.polyline(drawnPoints, { color: '#4f46e5', dashArray: '5, 5' }).addTo(drawingLayer);
    }
}

window.cancelDrawing = () => {
    isDrawing = false;
    drawnPoints = [];
    if (drawingLayer) drawingLayer.clearLayers();
    
    document.getElementById('geofenceMap').classList.remove('drawing-cursor');
    document.getElementById('map-controls').classList.add('hidden');
    document.getElementById('drawing-instructions').classList.add('hidden');
};

window.finishDrawing = () => {
    if (drawnPoints.length < 3) {
        alert("A zone must have at least 3 points.");
        return;
    }
    
    // Show Modal to save
    document.getElementById('create-zone-modal').classList.remove('hidden');
    document.getElementById('zone-name').value = '';
    document.getElementById('zone-alert').value = 'Entered Zone';
};

window.closeZoneModal = () => {
    document.getElementById('create-zone-modal').classList.add('hidden');
};

// 5. Save Logic (Connects to Server)
window.saveNewZone = async () => {
    const name = document.getElementById('zone-name').value;
    const type = document.querySelector('input[name="zone-type"]:checked').value;
    const alertMsg = document.getElementById('zone-alert').value;

    if (!name) return alert("Name is required");

    try {
        const res = await authenticatedFetch('/zones/add', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: currentDevice.deviceId,
                name: name,
                type: type,
                alertMessage: alertMsg,
                points: drawnPoints // Sending the clicked points
            })
        });
        
        // Cleanup
        window.closeZoneModal();
        window.cancelDrawing();
        
        // Refresh
        await loadZones(currentDevice.deviceId);

    } catch (e) {
        alert("Failed to save zone.");
    }
};

window.deleteZone = async (id) => {
    if(!confirm("Delete this zone?")) return;
    try {
        await authenticatedFetch(`/zones/${id}`, { method: 'DELETE' });
        await loadZones(currentDevice.deviceId);
    } catch(e) { alert("Delete failed"); }
};

// 6. Render List (Side Panel)
function renderZoneList() {
    const container = document.getElementById('zone-list-container');
    if (!container) return;

    if (currentZones.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                <i data-lucide="map" class="mx-auto mb-2 opacity-50" width="24"></i>
                <p class="text-xs">No zones configured.</p>
            </div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    container.innerHTML = currentZones.map(zone => {
        const isSafe = zone.type === 'safe';
        return `
            <div onclick="window.focusOnZone('${zone._id}')"
            class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-pointer transition-all hover:border-indigo-400 hover:shadow-md group relative">
                
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-bold text-slate-800 text-sm">${zone.name}</h4>
                        <span class="text-[10px] font-bold uppercase mt-1 inline-block ${isSafe ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'} px-2 py-0.5 rounded-full">
                            ${isSafe ? 'Safe Zone' : 'Danger Zone'}
                        </span>
                    </div>
                    <button onclick="event.stopPropagation(); window.deleteZone('${zone._id}')" class="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors">
                        <i data-lucide="trash-2" width="16"></i>
                    </button>
                </div>

                <div class="mt-3 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-start gap-2">
                    <i data-lucide="bell-ring" class="text-slate-400 shrink-0 mt-0.5" width="12"></i>
                    <p class="text-xs text-slate-500 leading-snug">
                        <span class="font-semibold text-slate-600">Alert:</span> "${zone.alertMessage || 'No message set'}"
                    </p>
                </div>
            </div>
        `;
    }).join('');
    
    if (window.lucide) window.lucide.createIcons();
}





window.focusOnZone = (id) => {
    // 1. Find the zone data
    const zone = currentZones.find(z => z._id === id);
    if (!zone || !geofenceMap || !zone.points || zone.points.length === 0) return;

    // 2. Create a temporary polygon to get the boundaries
    const polygon = L.polygon(zone.points);
    
    // 3. Zoom the map to fit that polygon exactly
    geofenceMap.fitBounds(polygon.getBounds(), { padding: [50, 50] });
};


// ------------------------------------------------------------------------------------------









// ... [Existing Code] ...

// --- SETTINGS LOGIC ---

let deviceSettings = {
    bedtimeWeeknight: "21:00",
    bedtimeWeekend: "23:00",
    uninstallProtection: false,
    locationTracking: true
};

// 1. Fetch Settings
async function loadSettings(hardwareId) {
    try {
        const res = await authenticatedFetch(`/settings/${hardwareId}`);
        deviceSettings = await res.json();
        renderSettingsUI();
    } catch(e) {
        console.error("Settings fetch error", e);
    }
}

// 2. Render UI (Populate Form)
function renderSettingsUI() {
    // Inputs
    const weekInput = document.getElementById('set-bed-week');
    const weekendInput = document.getElementById('set-bed-weekend');
    
    if (weekInput) weekInput.value = deviceSettings.bedtimeWeeknight || "21:00";
    if (weekendInput) weekendInput.value = deviceSettings.bedtimeWeekend || "23:00";

    // Toggles
    updateToggleVisuals('uninstallProtection', deviceSettings.uninstallProtection);
    updateToggleVisuals('locationTracking', deviceSettings.locationTracking);
}

// Helper for Toggles
function updateToggleVisuals(key, isActive) {
    const btn = document.getElementById(`btn-${key}`);
    const knob = document.getElementById(`knob-${key}`);
    
    if (!btn || !knob) return;

    if (isActive) {
        btn.classList.remove('bg-slate-300');
        btn.classList.add('bg-green-500');
        knob.classList.remove('translate-x-0');
        knob.classList.add('translate-x-6');
    } else {
        btn.classList.add('bg-slate-300');
        btn.classList.remove('bg-green-500');
        knob.classList.add('translate-x-0');
        knob.classList.remove('translate-x-6');
    }
}

// 3. User Actions
window.toggleSettingSwitch = (key) => {
    // Update State
    deviceSettings[key] = !deviceSettings[key];
    // Update Visuals
    updateToggleVisuals(key, deviceSettings[key]);
};

window.saveDeviceSettings = async () => {
    if (!currentDevice) return;

    // Read Input Values
    deviceSettings.bedtimeWeeknight = document.getElementById('set-bed-week').value;
    deviceSettings.bedtimeWeekend = document.getElementById('set-bed-weekend').value;

    const btn = document.getElementById('save-settings-btn');
    const originalContent = btn.innerHTML;
    
    // Loading State
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin" width="18"></i> <span>Saving...</span>`;
    if(window.lucide) window.lucide.createIcons();

    try {
        await authenticatedFetch('/settings/update', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: currentDevice.deviceId,
                ...deviceSettings
            })
        });

        // Success State
        btn.innerHTML = `<i data-lucide="check" width="18"></i> <span>Saved!</span>`;
        if(window.lucide) window.lucide.createIcons();
        btn.classList.remove('bg-slate-900', 'hover:bg-slate-800');
        btn.classList.add('bg-green-600', 'hover:bg-green-700');

        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.classList.add('bg-slate-900', 'hover:bg-slate-800');
            btn.classList.remove('bg-green-600', 'hover:bg-green-700');
            btn.disabled = false;
            if(window.lucide) window.lucide.createIcons();
        }, 2000);

    } catch (e) {
        alert("Failed to save settings.");
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
};

// --------------------------------------------------------------------






// ==========================================
// --- DELETE DEVICE LOGIC ---
// ==========================================

window.openDeleteModal = () => {
    if (!currentDevice) return;
    // Set the name in the modal so the user knows what they are deleting
    document.getElementById('del-device-name').textContent = currentDevice.name || "this device";
    document.getElementById('delete-modal').classList.remove('hidden');
};

window.confirmDeleteDevice = async () => {
    if (!currentDevice) return;
    
    // Show loading state on the button
    const btn = document.querySelector('#delete-modal .bg-red-600');
    const originalText = btn.innerText;
    btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin inline mr-1" width="14"></i> Removing...`;
    btn.disabled = true;

    try {
        // Call the Delete API
        await authenticatedFetch(`/devices/${currentDevice._id}`, { method: 'DELETE' });
        
        // Hide Modal
        document.getElementById('delete-modal').classList.add('hidden');
        
        // Reset Button
        btn.innerText = originalText;
        btn.disabled = false;

        // Clear current device and reload list
        currentDevice = null;
        await loadDevices(); // This will auto-select the next available device or show empty state
        
        // Switch to dashboard tab to avoid staying on a broken settings page
        switchTab('dashboard');

    } catch (err) {
        console.error(err);
        alert("Failed to delete device. Please try again.");
        btn.innerText = originalText;
        btn.disabled = false;
    }
};





// --- PUSH NOTIFICATION SETUP ---

// WARNING: Put your actual VAPID_PUBLIC_KEY here. 
// It is 100% safe to expose the PUBLIC key in frontend code. 
// NEVER expose the PRIVATE key here.
const PUBLIC_VAPID_KEY = 'BBpkG463YcRpIx2KyONqYXH2j3QpOYPNW42WE4s0cg8PAJ_YJ1hCaxKvrIMRseQvl3lNxZOviQl1Ko5mXEhbHJY';

async function setupPushNotifications() {
    // 1. Check if the browser supports Service Workers and Push Notifications
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            // 2. Register the Service Worker (sw.js)
            const register = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ Service Worker Registered');

            // 3. Ask the parent for permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('❌ Push permission denied by user.');
                return;
            }

            // 4. Subscribe the browser to the Push Service (Google/Apple)
            const subscription = await register.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
            });

            // 5. Send the subscription to your Node.js server to save in MongoDB
            await authenticatedFetch('/notifications/subscribe', {
                method: 'POST',
                body: JSON.stringify(subscription)
            });
            
            console.log('✅ Successfully subscribed to Push Notifications!');

        } catch (error) {
            console.error('❌ Push Setup Error:', error);
        }
    } else {
        console.warn('Push messaging is not supported in this browser.');
    }
}

// Helper function required by the Web Push protocol to format your public key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}




























