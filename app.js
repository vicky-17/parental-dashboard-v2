// --- CONFIG ---
const API_URL = '/api'; // Use full URL if testing separate frontend

// --- STATE ---
let currentDevice = null;
let devices = [];
let locationInterval = null;

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) window.lucide.createIcons();
    
    // Auth Check
    const token = localStorage.getItem('token');
    if (!token && document.getElementById('device-list')) {
        window.location.href = 'index.html'; // Redirect to login if not authenticated
    } else if (token) {
        initDashboard();
    }

    // Sidebar Mobile Toggle
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
    // Logout Handler
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    });

    // Add Device Handler
    document.getElementById('add-device-btn').addEventListener('click', async () => {
        try {
            const res = await authenticatedFetch('/devices/add', { method: 'POST' });
            const data = await res.json();
            document.getElementById('pairing-code-display').textContent = data.code;
            document.getElementById('pairing-modal').classList.remove('hidden');
            loadDevices(); 
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
    if (!device.isPaired) {
        alert("Device not paired yet.");
        return;
    }
    
    currentDevice = device;
    renderDeviceList(); 

    // UI Updates
    document.getElementById('empty-state').classList.add('hidden');
    // Ensure dashboard tab is visible if no tab selected
    if(document.querySelector('.tab-content:not(.hidden)') === null) {
        switchTab('dashboard');
    } else {
        // Re-show current tab
        const activeTab = document.querySelector('.nav-item.active').id.replace('nav-', '');
        switchTab(activeTab);
    }

    document.getElementById('device-status-header').classList.remove('hidden');
    document.getElementById('current-device-name-header').textContent = device.name;
    document.getElementById('active-device-name').textContent = device.name;

    // Load Data
    if (locationInterval) clearInterval(locationInterval);
    await Promise.all([ loadLocation(device.deviceId), loadApps(device.deviceId) ]);
    
    // Live Poll (every 3s)
    locationInterval = setInterval(() => loadLocation(device.deviceId), 3000);
}

// --- TAB SWITCHING ---

function switchTab(tabId) {
    // Hide all
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    // Show target
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    
    // Sidebar Active State
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active', 'bg-indigo-50', 'text-indigo-600');
        el.classList.add('text-slate-600', 'hover:bg-slate-50');
    });
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if(activeBtn) {
        activeBtn.classList.add('active', 'bg-indigo-50', 'text-indigo-600');
        activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-50');
    }

    // Title
    const titles = {
        'dashboard': 'Overview',
        'apps': 'App Rules & Usage',
        'web': 'Web Safety',
        'location': 'Geofencing & Map',
        'settings': 'Device Settings'
    };
    document.getElementById('page-title').textContent = titles[tabId] || 'Dashboard';
}

// --- DATA FETCHING ---

async function loadLocation(hardwareId) {
    try {
        const res = await authenticatedFetch(`/data/${hardwareId}/location`);
        const loc = await res.json();
        
        if (loc && loc.latitude) {
            const timeStr = new Date(loc.timestamp).toLocaleTimeString();
            const coordsStr = `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
            
            // Dashboard Widget
            const dashCoords = document.getElementById('map-coords');
            if(dashCoords) dashCoords.textContent = coordsStr;
            const dashTime = document.getElementById('map-time');
            if(dashTime) dashTime.textContent = "Updated: " + timeStr;
            
            document.getElementById('stat-battery').textContent = (loc.batteryLevel || 0) + '%';
            document.getElementById('map-battery-text').textContent = (loc.batteryLevel || 0) + '%';
            document.getElementById('map-battery-bar').style.width = (loc.batteryLevel || 0) + '%';
            
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

        document.getElementById('stat-apps-count').textContent = apps.length;
    } catch(e) { console.error("App fetch error", e); }
}

// Global update function
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
        // Reload apps to reflect state
        loadApps(currentDevice.deviceId);
    } catch (err) {
        console.error('Failed to update rule', err);
    }
};