// --- Config ---
const API_URL = '/api';

// --- State ---
let currentUser = null;
let currentDevice = null;
let devices = [];

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons if library loaded
    if (window.lucide) window.lucide.createIcons();

    // Check routing
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

    // Check if already logged in
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
        li.className = `device-item p-3 rounded-lg cursor-pointer hover:bg-gray-50 flex items-center gap-3 transition-all ${currentDevice?._id === device._id ? 'active' : ''}`;
        li.innerHTML = `
            <div class="bg-indigo-100 p-2 rounded text-indigo-600">
                <i data-lucide="${device.isPaired ? 'smartphone' : 'loader'}" width="18"></i>
            </div>
            <div>
                <div class="font-medium text-sm text-gray-800">${device.name || 'Pending Device'}</div>
                <div class="text-xs text-gray-500">${device.isPaired ? 'Online' : 'Pairing...'}</div>
            </div>
        `;
        li.onclick = () => selectDevice(device);
        list.appendChild(li);
    });
    if (window.lucide) window.lucide.createIcons();
}

async function selectDevice(device) {
    if (!device.isPaired) return;
    
    currentDevice = device;
    renderDeviceList(); // Update active state

    // Show content, hide empty state
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
        coordsEl.textContent = `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
        timeEl.textContent = `Updated: ${new Date(loc.timestamp).toLocaleString()}`;
        mapLink.href = `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`;
        mapLink.classList.remove('opacity-50', 'pointer-events-none');
    } else {
        coordsEl.textContent = "No data yet";
        timeEl.textContent = "--";
        mapLink.classList.add('opacity-50', 'pointer-events-none');
    }
}

// --- Apps/Rules Logic ---
async function loadApps(hardwareId) {
    const res = await authenticatedFetch(`/data/${hardwareId}/apps`);
    const apps = await res.json();
    const tbody = document.getElementById('app-list-body');
    tbody.innerHTML = '';

    apps.forEach(app => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-medium text-gray-900">${app.appName || app.packageName}</div>
                <div class="text-xs text-gray-400">${app.packageName}</div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">${app.usedToday} min</td>
            <td class="px-6 py-4 text-center">
                <input type="checkbox" class="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                    ${app.isBlocked ? 'checked' : ''} 
                    onchange="updateAppRule('${app.packageName}', this.checked, ${app.timeLimit})">
            </td>
            <td class="px-6 py-4">
                <input type="number" class="w-20 p-1 border rounded text-center text-sm" 
                    value="${app.timeLimit}" min="0" 
                    onchange="updateAppRule('${app.packageName}', ${app.isBlocked}, this.value)">
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Exposed to global scope for HTML inline events
window.updateAppRule = async (packageName, isBlocked, timeLimit) => {
    if (!currentDevice) return;
    
    try {
        await authenticatedFetch('/rules/update', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: currentDevice.deviceId,
                packageName,
                isBlocked,
                timeLimit: parseInt(timeLimit)
            })
        });
        // Optional: Show toast success
    } catch (err) {
        console.error('Failed to update rule', err);
        alert('Failed to save change');
    }
};
