// --- Config ---
const API_URL = '/api';

// --- State ---
let currentDevice = null;
let devices = [];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (window.lucide) window.lucide.createIcons();

    // Determine if we are on Login Page or Dashboard
    if (document.getElementById('auth-form')) {
        initAuth();
    } else if (document.getElementById('device-list')) {
        initDashboard();
    }
});

// --- Auth Module ---
function initAuth() {
    const form = document.getElementById('auth-form');
    const toggleBtn = document.getElementById('toggle-auth');
    const toggleText = document.getElementById('toggle-text');
    const submitBtn = document.getElementById('submit-btn');
    const errorMsg = document.getElementById('error-message');
    let isLogin = true;

    // Auto-redirect if token exists
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
                // Auto login after register
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

    // Event Listeners
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
            loadDevices(); // Refresh list to show pending
        } catch (err) {
            alert('Failed to generate code');
        }
    });

    await loadDevices();
}

// --- Helper: Authenticated Fetch ---
async function authenticatedFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };
    
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
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
    } catch (err) {
        console.error('Error loading devices', err);
    }
}

function renderDeviceList() {
    const list = document.getElementById('device-list');
    list.innerHTML = '';
    
    devices.forEach(device => {
        const li = document.createElement('li');
        // Styling based on selection and pairing status
        const isSelected = currentDevice && currentDevice._id === device._id;
        li.className = `p-3 rounded-lg cursor-pointer flex items-center gap-3 transition-all mb-1 ${
            isSelected ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-50 border border-transparent'
        }`;
        
        li.innerHTML = `
            <div class="${device.isPaired ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'} p-2 rounded-lg">
                <i data-lucide="${device.isPaired ? 'smartphone' : 'loader'}" width="20"></i>
            </div>
            <div>
                <div class="font-bold text-sm text-gray-800">${device.name || 'Unknown Device'}</div>
                <div class="text-xs ${device.isPaired ? 'text-green-600 font-medium' : 'text-gray-400'}">
                    ${device.isPaired ? 'Online' : 'Pairing Pending...'}
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
        alert("This device is not paired yet. Please connect the child's phone first.");
        return;
    }
    
    currentDevice = device;
    renderDeviceList(); // Refresh sidebar styling

    // Show Content
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('dashboard-content').classList.remove('hidden');
    document.getElementById('device-header').classList.remove('hidden');
    document.getElementById('empty-header').classList.add('hidden');

    // Update Header
    document.getElementById('current-device-name').textContent = device.name;
    
    // Load Data
    await Promise.all([
        loadLocation(device.deviceId),
        loadApps(device.deviceId)
    ]);
}

// --- Location Logic ---
async function loadLocation(hardwareId) {
    const res = await authenticatedFetch(`/data/${hardwareId}/location`);
    const loc = await res.json();
    
    const coordsEl = document.getElementById('location-coords');
    const timeEl = document.getElementById('location-time');
    const mapLink = document.getElementById('maps-link');

    if (loc && loc.latitude) {
        coordsEl.textContent = `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
        timeEl.textContent = `Updated: ${new Date(loc.timestamp).toLocaleTimeString()}`;
        // FIXED: Correct Google Maps Link
        mapLink.href = `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`;
        mapLink.classList.remove('opacity-50', 'pointer-events-none');
    } else {
        coordsEl.textContent = "Waiting for data...";
        timeEl.textContent = "Last updated: Never";
        mapLink.classList.add('opacity-50', 'pointer-events-none');
    }
}

// --- Apps/Rules Logic ---
async function loadApps(hardwareId) {
    const res = await authenticatedFetch(`/data/${hardwareId}/apps`);
    const apps = await res.json();
    const tbody = document.getElementById('app-list-body');
    tbody.innerHTML = '';

    if (apps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-400">No apps synced yet. Open the child app to sync.</td></tr>`;
        return;
    }

    apps.forEach(app => {
        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 transition-colors";
        row.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-gray-800">${app.appName || app.packageName}</div>
                <div class="text-xs text-gray-400 font-mono">${app.packageName}</div>
            </td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    ${app.usedToday} min
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer" 
                        ${app.isBlocked ? 'checked' : ''} 
                        onchange="updateAppRule('${app.packageName}', this.checked, ${app.timeLimit})">
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                </label>
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                    <input type="number" class="w-20 p-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value="${app.timeLimit}" min="0" 
                        onchange="updateAppRule('${app.packageName}', ${app.isBlocked}, this.value)">
                    <span class="text-xs text-gray-400">min</span>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Global function for inline events
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
        // Feedback handled by UI state persistence, no alert needed unless error
    } catch (err) {
        console.error('Failed to update rule', err);
        alert('Failed to save settings. Check connection.');
    }
};