// --- Config ---
const API_URL = '/api';

// --- State ---
let currentDevice = null;
let devices = [];
let locationInterval = null;

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) window.lucide.createIcons();
    if (document.getElementById('auth-form')) initAuth();
    if (document.getElementById('device-list')) initDashboard();
});

// --- Tab Logic ---
function switchTab(tabId) {
    // 1. Hide all contents
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    
    // 2. Show target content
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    
    // 3. Update Sidebar Active State
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('bg-indigo-50', 'text-indigo-600');
        el.classList.add('text-slate-600', 'hover:bg-slate-50');
    });
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if(activeBtn) {
        activeBtn.classList.add('bg-indigo-50', 'text-indigo-600');
        activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-50');
    }

    // 4. Update Title
    const titles = {
        'dashboard': 'Overview',
        'apps': 'App Rules & Usage',
        'web': 'Web Safety',
        'location': 'Geofencing & Map',
        'settings': 'Device Settings'
    };
    document.getElementById('page-title').textContent = titles[tabId] || 'Dashboard';
}

// --- Auth Module ---
function initAuth() {
    const form = document.getElementById('auth-form');
    const toggleBtn = document.getElementById('toggle-auth');
    const submitBtn = document.getElementById('submit-btn');
    const errorMsg = document.getElementById('error-message');
    const toggleText = document.getElementById('toggle-text');
    let isLogin = true;

    if (localStorage.getItem('token')) {
        window.location.href = 'dashboard.html';
        return;
    }

    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        submitBtn.textContent = isLogin ? 'Sign In' : 'Create Account';
        toggleText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
        toggleBtn.textContent = isLogin ? "Sign up" : "Log in";
        errorMsg.classList.add('hidden');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const endpoint = isLogin ? '/auth/login' : '/auth/register';

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';
            
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!res.ok) throw new Error(await res.text());

            if (isLogin) {
                const data = await res.json();
                localStorage.setItem('token', data.token);
                window.location.href = 'dashboard.html';
            } else {
                const loginRes = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await loginRes.json();
                localStorage.setItem('token', data.token);
                window.location.href = 'dashboard.html';
            }
        } catch (err) {
            errorMsg.textContent = err.message.replace(/['"]+/g, '');
            errorMsg.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isLogin ? 'Sign In' : 'Create Account';
        }
    });
}

// --- Dashboard Module ---
async function initDashboard() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

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

// --- Device Logic ---
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
        li.className = `p-2 rounded-lg cursor-pointer flex items-center gap-3 transition-all ${
            isSelected ? 'bg-indigo-50 border border-indigo-200 shadow-sm' : 'hover:bg-slate-100 border border-transparent'
        }`;
        
        li.innerHTML = `
            <div class="${device.isPaired ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'} p-1.5 rounded-md">
                <i data-lucide="${device.isPaired ? 'smartphone' : 'loader'}" width="16"></i>
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

    // Hide Empty State, Show Main
    document.getElementById('empty-state').classList.add('hidden');
    // Ensure active tab content is visible (usually dashboard is default)
    // We don't hide 'main-content-area', we show the tabs inside it.
    
    // Default to dashboard tab if none selected
    if(document.querySelector('.tab-content:not(.hidden)') === null) {
        switchTab('dashboard');
    } else {
        // Re-trigger visual updates for current tab
        const activeTab = document.querySelector('.nav-item.bg-indigo-50').id.replace('nav-', '');
        switchTab(activeTab);
    }

    document.getElementById('device-status-header').classList.remove('hidden');
    document.getElementById('current-device-name-header').textContent = device.name;

    // Load Data
    if (locationInterval) clearInterval(locationInterval);
    await Promise.all([ loadLocation(device.deviceId), loadApps(device.deviceId) ]);
    
    // Live Poll
    locationInterval = setInterval(() => loadLocation(device.deviceId), 3000);
}

// --- Data Logic ---
async function loadLocation(hardwareId) {
    const res = await authenticatedFetch(`/data/${hardwareId}/location`);
    const loc = await res.json();
    
    // Elements in Dashboard Tab
    const dashCoords = document.getElementById('dash-coords');
    const dashTime = document.getElementById('dash-last-seen');
    const dashBattery = document.getElementById('dash-battery');
    
    // Elements in Location Tab
    const tabCoords = document.getElementById('loc-tab-coords');
    const tabLink = document.getElementById('loc-tab-maps-link');

    if (loc && loc.latitude) {
        const timeStr = new Date(loc.timestamp).toLocaleTimeString();
        const coordsStr = `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
        
        if(dashCoords) dashCoords.textContent = coordsStr;
        if(dashTime) dashTime.textContent = timeStr;
        if(dashBattery) dashBattery.textContent = (loc.batteryLevel || '--') + '%';
        
        if(tabCoords) tabCoords.textContent = coordsStr;
        if(tabLink) tabLink.href = `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`;
        
        document.getElementById('last-synced-time').textContent = timeStr;
    }
}

async function loadApps(hardwareId) {
    const res = await authenticatedFetch(`/data/${hardwareId}/apps`);
    const apps = await res.json();
    const tbody = document.getElementById('app-list-body');
    const totalUsageEl = document.getElementById('dash-total-usage');
    
    tbody.innerHTML = '';
    let totalMinutes = 0;

    apps.forEach(app => {
        totalMinutes += (app.usedToday || 0);
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50 transition-colors";
        row.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800">${app.appName || app.packageName}</div>
                <div class="text-xs text-slate-400 font-mono">${app.packageName}</div>
            </td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                    ${app.usedToday || 0} min
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer" 
                        ${app.isBlocked ? 'checked' : ''} 
                        onchange="updateAppRule('${app.packageName}', this.checked, ${app.timeLimit})">
                    <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
                </label>
            </td>
            <td class="px-6 py-4">
                <input type="number" class="w-16 p-1 border border-slate-300 rounded text-center text-xs focus:ring-2 focus:ring-indigo-500 outline-none" 
                    value="${app.timeLimit}" min="0" 
                    onchange="updateAppRule('${app.packageName}', ${app.isBlocked}, this.value)">
            </td>
        `;
        tbody.appendChild(row);
    });

    if(totalUsageEl) totalUsageEl.textContent = `${totalMinutes} min`;
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
    } catch (err) {
        console.error('Failed to update rule', err);
    }
};