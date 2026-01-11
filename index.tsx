import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Shield, 
  Smartphone, 
  MapPin, 
  Clock, 
  Activity, 
  Settings, 
  AlertTriangle,
  BrainCircuit,
  Lock,
  Unlock,
  Menu,
  X,
  Globe,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  AlertOctagon,
  CheckCircle,
  Radio,
  LogOut,
  ArrowLeft
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// --- Configuration ---
// Ideally this comes from env vars, but handling securely in frontend requires a backend proxy for real production safety
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "YOUR_API_KEY" });

// --- MongoDB-like Types ---

interface TimeSlot {
  id: string;
  start: string;
  end: string;
  days: string[]; // e.g., ['Mon', 'Tue']
}

interface AppRule {
  _id?: string; // MongoDB ID
  id?: string;
  appName: string;
  packageName: string;
  category: string;
  icon: string;
  color: string;
  isGlobalLocked: boolean; // "Red" mode - overrides everything
  schedules: TimeSlot[];   // "Orange" mode - allowed only during these times if not locked
  dailyUsageLimitMinutes: number;
  usedTodayMinutes: number;
}

interface Zone {
  _id?: string;
  id?: string;
  name: string;
  type: 'safe' | 'danger';
  points: { lat: number; lng: number }[]; // Polygon points
  alertMessage: string;
}

interface WebFilter {
  blockedCategories: string[]; // e.g. "adult", "gambling"
  blockedUrls: string[];
  history: { url: string; timestamp: string; title: string; riskScore: number }[];
}

interface DeviceSettings {
  bedtimeWeeknight: string;
  bedtimeWeekend: string;
  uninstallProtection: boolean;
  locationTracking: boolean;
}

interface Device {
    _id: string;
    deviceId: string;
    name: string;
    isPaired: boolean;
}

// --- AUTH COMPONENTS ---

const AuthScreen = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      if (isRegister) {
        setIsRegister(false); // Go to login
        alert("Account created! Please login.");
      } else {
        onLogin(data.token, data.email);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-96">
        <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Shield className="text-white" size={24} />
            </div>
        </div>
        <h2 className="text-2xl font-bold mb-2 text-center text-slate-800">ParentalWatch</h2>
        <p className="text-center text-slate-500 mb-6">{isRegister ? "Create your parent account" : "Sign in to monitor devices"}</p>
        
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm flex items-center gap-2"><AlertTriangle size={16}/>{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
              <input className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" type="email" placeholder="parent@example.com" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
              <input className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
          </div>
          <button className="w-full bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
            {isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>
        
        <div className="mt-6 text-center border-t border-slate-100 pt-4">
            <button onClick={() => setIsRegister(!isRegister)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            {isRegister ? "Already have an account? Sign In" : "New to ParentalWatch? Create Account"}
            </button>
        </div>
      </div>
    </div>
  );
};

// --- DEVICE SELECTOR ---

const DeviceList = ({ token, onSelectDevice, onLogout }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
        const res = await fetch('/api/devices', {
        headers: { 'Authorization': `Bearer ${token}` }
        });
        if(res.status === 401) { onLogout(); return; }
        const data = await res.json();
        setDevices(Array.isArray(data) ? data : []);
    } catch(e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const generateCode = async () => {
    const res = await fetch('/api/devices/add', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: "New Device" })
    });
    const data = await res.json();
    setPairingCode(data.code);
    fetchDevices(); // Refresh list to show the new pending device
  };

  if(loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading Devices...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-10">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <Shield className="text-indigo-600" size={32}/> 
                My Devices
            </h1>
            <button onClick={onLogout} className="text-slate-500 hover:text-red-600 flex items-center gap-2 px-4 py-2 hover:bg-red-50 rounded-lg transition-colors">
                <LogOut size={20} /> Sign Out
            </button>
        </div>
        
        {pairingCode && (
          <div className="bg-indigo-50 border-l-4 border-indigo-500 p-6 mb-8 rounded-r-xl shadow-sm flex items-center justify-between">
            <div>
                <h3 className="font-bold text-indigo-900 text-lg mb-1">Device Ready to Pair</h3>
                <p className="text-indigo-700">Enter this code on the child's device to link it to your account.</p>
            </div>
            <div className="bg-white px-6 py-3 rounded-lg border-2 border-indigo-100 shadow-sm">
                <span className="text-4xl font-mono font-bold text-slate-900 tracking-widest">{pairingCode}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map(dev => (
            <div key={dev._id} 
                 onClick={() => dev.isPaired && onSelectDevice(dev.deviceId || dev._id)}
                 className={`bg-white p-6 rounded-2xl border-2 transition-all group relative overflow-hidden
                    ${dev.isPaired 
                        ? 'border-transparent hover:border-indigo-500 shadow-sm hover:shadow-xl cursor-pointer' 
                        : 'border-slate-200 border-dashed opacity-80'}`}>
              
              <div className="absolute top-0 right-0 p-4">
                  <div className={`w-3 h-3 rounded-full ${dev.isPaired ? 'bg-green-500 animate-pulse' : 'bg-orange-300'}`}></div>
              </div>

              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${dev.isPaired ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                <Smartphone size={32} />
              </div>
              
              <h3 className="font-bold text-xl text-slate-900 mb-1">{dev.name}</h3>
              <p className="text-sm font-medium text-slate-500 mb-4">{dev.isPaired ? "Online • Monitoring Active" : "Pending Pairing..."}</p>
              
              {dev.isPaired ? (
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm group-hover:underline">
                      View Dashboard <ArrowLeft className="rotate-180" size={16}/>
                  </div>
              ) : (
                  <div className="bg-slate-100 text-slate-500 text-xs py-1 px-3 rounded inline-block">
                      Waiting for connection...
                  </div>
              )}
            </div>
          ))}
          
          <button onClick={generateCode} className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-2xl hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50/50 text-slate-400 transition-all min-h-[200px]">
            <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4 shadow-sm">
                <Plus size={32} />
            </div>
            <span className="font-bold text-lg">Add New Device</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

const App = () => {
  // 1. Auth & Navigation State
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  
  // 2. Dashboard UI State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState("Never");
  const [loading, setLoading] = useState(false); // Initial loading state handled by useEffect

  // 3. Data State
  const [apps, setApps] = useState<AppRule[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [webFilter, setWebFilter] = useState<WebFilter>({ 
      blockedCategories: [], blockedUrls: [], history: [] 
  });
  const [settings, setSettings] = useState<DeviceSettings>({
    bedtimeWeeknight: '21:00',
    bedtimeWeekend: '23:00',
    uninstallProtection: true,
    locationTracking: true
  });

  // 4. Live Location & AI State
  const [currentLocation, setCurrentLocation] = useState({
    lat: 40.7128, lng: -74.0060, address: "Waiting for update...",
    speed: 0, batteryLevel: 0, timestamp: new Date()
  });
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // --- Handlers ---
  const handleLogin = (tok: string, email: string) => {
    setToken(tok);
    localStorage.setItem('token', tok);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
    setSelectedDeviceId(null);
  };

  // --- CONDITIONAL RENDERING ---
  if (!token) return <AuthScreen onLogin={handleLogin} />;
  if (!selectedDeviceId) return <DeviceList token={token} onSelectDevice={setSelectedDeviceId} onLogout={handleLogout} />;

  // --- DATA FETCHING (Only runs when device is selected) ---
  useEffect(() => {
    if (!selectedDeviceId || !token) return;

    const fetchData = async () => {
      try {
        if(apps.length === 0) setLoading(true); // Only show full loader on first load
        
        const headers = { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        };

        const [appRes, zoneRes, settingRes, webRes, locRes] = await Promise.all([
          fetch(`/api/data/${selectedDeviceId}/apps`, { headers }),
          fetch('/api/zones', { headers }),
          fetch('/api/settings', { headers }),
          fetch('/api/web/history', { headers }),
          fetch(`/api/data/${selectedDeviceId}/location`, { headers })
        ]);
        
        if (appRes.status === 401 || appRes.status === 403) {
            handleLogout();
            return;
        }

        const appData = await appRes.json();
        const zoneData = await zoneRes.json();
        const settingData = await settingRes.json();
        const webData = await webRes.json();
        const locData = await locRes.json();

        // Update State
        if(Array.isArray(appData)) setApps(appData);
        if(Array.isArray(zoneData)) setZones(zoneData);
        if(webData) setWebFilter(webData);
        
        if(settingData.settings) {
            setSettings(prev => ({ ...prev, ...settingData.settings }));
        } else {
            setSettings(prev => ({ ...prev, ...settingData }));
        }

        if (locData && locData.latitude) {
            setCurrentLocation({
                lat: locData.latitude,
                lng: locData.longitude,
                address: `Last Ping: ${new Date(locData.timestamp).toLocaleTimeString()}`,
                speed: 0,
                batteryLevel: locData.batteryLevel || 0,
                timestamp: new Date(locData.timestamp)
            });
        }

        setLastSynced(new Date().toLocaleTimeString());
      } catch (err) {
        console.error("Failed to connect to server:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [selectedDeviceId, token]); 

  // --- ACTIONS ---

  const handleSync = async () => {
    setIsSyncing(true);
    try {
       await fetch('/api/settings', {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(settings)
       });
       setLastSynced(new Date().toLocaleTimeString());
    } catch(e) {
       alert("Sync failed");
    } finally {
       setIsSyncing(false);
    }
  };

  const toggleGlobalLock = (id: string) => {
    setApps(apps.map(app => (app._id === id || app.id === id) ? { ...app, isGlobalLocked: !app.isGlobalLocked } : app));
  };

  const addSchedule = (appId: string) => {
    setApps(apps.map(app => {
      if (app.id === appId || app._id === appId) {
        return {
          ...app,
          schedules: [...app.schedules, { id: Date.now().toString(), start: '12:00', end: '13:00', days: ['All'] }]
        };
      }
      return app;
    }));
  };

  const removeSchedule = (appId: string, slotId: string) => {
    setApps(apps.map(app => {
      if (app.id === appId || app._id === appId) {
        return { ...app, schedules: app.schedules.filter(s => s.id !== slotId) };
      }
      return app;
    }));
  };

  const updateSchedule = (appId: string, slotId: string, field: 'start' | 'end', value: string) => {
    setApps(apps.map(app => {
      if (app.id === appId || app._id === appId) {
        return {
          ...app,
          schedules: app.schedules.map(s => s.id === slotId ? { ...s, [field]: value } : s)
        };
      }
      return app;
    }));
  };

  const analyzeWebSafety = async () => {
    setAnalyzing(true);
    try {
      const prompt = `
        Analyze this browser history for a child. 
        History: ${JSON.stringify(webFilter.history)}
        Blocked Categories: ${webFilter.blockedCategories.join(', ')}
        1. Flag any suspicious URLs.
        2. Give a safety score (0-100).
      `;
      const res = await ai.models.generateContent({ model: 'gemini-2.5-flash-latest', contents: prompt });
      setAiAnalysis(res.text);
    } catch (e) {
      setAiAnalysis("AI Service Unavailable. Check API Key.");
    } finally {
      setAnalyzing(false);
    }
  };

  const NavItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        activeTab === id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-indigo-50'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center text-indigo-600 font-bold bg-slate-50">Loading Device Data...</div>;

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Shield className="text-white" size={18} />
            </div>
            <h1 className="text-xl font-bold text-slate-800">ParentalWatch</h1>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <NavItem id="dashboard" icon={Activity} label="Dashboard" />
            <NavItem id="usage" icon={Clock} label="App Rules & Usage" />
            <NavItem id="web" icon={Globe} label="Web Safety" />
            <NavItem id="location" icon={MapPin} label="Geofencing" />
            <NavItem id="settings" icon={Settings} label="Device Settings" />
          </nav>
          <div className="p-4 border-t border-slate-100">
             <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-3">
                <p className="text-xs text-slate-500 font-bold uppercase mb-1">Active Device</p>
                <div className="flex items-center gap-2">
                    <Smartphone size={14} className="text-indigo-600"/>
                    <span className="text-sm font-semibold truncate">{selectedDeviceId}</span>
                </div>
             </div>
             <button onClick={() => setSelectedDeviceId(null)} className="w-full py-2 text-sm text-slate-600 hover:text-indigo-600 font-medium flex items-center justify-center gap-2 mb-2">
                <ArrowLeft size={16}/> Switch Device
             </button>
             <button onClick={handleLogout} className="w-full py-2 text-sm text-red-600 bg-red-50 rounded hover:bg-red-100 flex items-center justify-center gap-2">
                <LogOut size={16}/> Sign Out
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden lg:pl-64">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-2 text-slate-600">
                <Menu size={24} />
              </button>
              <h2 className="text-lg font-semibold text-slate-800 capitalize hidden sm:block">{activeTab.replace('-', ' ')}</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
               <p className="text-xs text-slate-400">Last Synced</p>
               <p className="text-sm font-medium text-slate-700">{lastSynced}</p>
            </div>
            <button 
               onClick={handleSync}
               disabled={isSyncing}
               className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
                 isSyncing ? 'bg-indigo-100 text-indigo-400 cursor-wait' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200'
               }`}
            >
               <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
               {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-8">
            
            {/* --- DASHBOARD TAB --- */}
            {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                                <AlertOctagon size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Blocked Attempts</p>
                                <p className="text-2xl font-bold text-slate-900">12</p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400">Last attempt: Roblox</p>
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                <Clock size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Screen Time</p>
                                <p className="text-2xl font-bold text-slate-900">3h 45m</p>
                            </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div className="bg-orange-500 h-1.5 rounded-full" style={{width: '75%'}}></div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <Shield size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Protection Status</p>
                                <p className="text-lg font-bold text-slate-900">Active</p>
                            </div>
                        </div>
                        <p className="text-xs text-green-600 font-medium">All systems normal</p>
                    </div>

                    {/* Live Map Widget */}
                    <div className="col-span-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row h-96">
                        <div className="flex-1 bg-slate-100 relative group overflow-hidden">
                            <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')] opacity-30 bg-cover bg-center"></div>
                            
                            {/* Pin */}
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-1000 ease-in-out" 
                                style={{transform: `translate(-50%, -50%) translate(${(currentLocation.lng + 74.0060) * 1000}px, ${(currentLocation.lat - 40.7128) * 1000}px)`}}>
                                <div className="relative z-10 w-10 h-10 bg-indigo-600 border-4 border-white rounded-full shadow-xl flex items-center justify-center">
                                    <span className="text-white font-bold text-xs">ALEX</span>
                                </div>
                                <div className="mt-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow-lg border border-slate-100 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Moving • {currentLocation.speed.toFixed(1)} mph</span>
                                </div>
                            </div>
                        </div>
                        <div className="w-full md:w-80 bg-white p-6 border-l border-slate-100 flex flex-col">
                             <div className="space-y-6 flex-1">
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Battery</p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-green-500" style={{ width: `${currentLocation.batteryLevel}%` }}></div>
                                        </div>
                                        <span className="text-sm font-bold text-slate-900">{currentLocation.batteryLevel}%</span>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Address</p>
                                    <p className="text-sm font-medium text-slate-900">{currentLocation.address}</p>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* --- USAGE TAB --- */}
            {activeTab === 'usage' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-800">App Limits & Schedules</h3>
                    </div>
                    <div className="grid gap-6">
                    {apps.map((app) => (
                        <div key={app.id || app._id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 ${app.color || 'bg-blue-500'} rounded-lg flex items-center justify-center text-white`}>
                                        <Smartphone size={24} /> 
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900">{app.appName}</h4>
                                        <p className="text-xs text-slate-500">{app.packageName}</p>
                                        <div className="mt-1 text-xs bg-slate-100 px-2 py-0.5 rounded inline-block">Used: {app.usedTodayMinutes}m</div>
                                    </div>
                                </div>
                                <button onClick={() => toggleGlobalLock(app.id || app._id!)} className={`px-3 py-1 rounded text-sm font-bold ${app.isGlobalLocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {app.isGlobalLocked ? 'LOCKED' : 'ACTIVE'}
                                </button>
                            </div>
                        </div>
                    ))}
                    </div>
                </div>
            )}

            {/* --- WEB TAB --- */}
            {activeTab === 'web' && (
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1 space-y-6">
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                          <h3 className="font-bold text-slate-800 mb-4">Block Categories</h3>
                          {['pornography', 'gambling', 'violence', 'social-media'].map(cat => (
                              <div key={cat} className="flex justify-between py-2 border-b border-slate-50 last:border-0">
                                  <span className="capitalize text-slate-600">{cat}</span>
                                  <div className={`w-3 h-3 rounded-full ${webFilter.blockedCategories.includes(cat) ? 'bg-red-500' : 'bg-green-500'}`}></div>
                              </div>
                          ))}
                      </div>
                  </div>
                  <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="font-bold text-slate-800">Browser History</h3>
                          <button onClick={analyzeWebSafety} disabled={analyzing} className="bg-purple-100 text-purple-700 px-3 py-1 rounded text-sm font-bold flex items-center gap-2">
                              <BrainCircuit size={16}/> {analyzing ? 'Scanning...' : 'AI Scan'}
                          </button>
                      </div>
                      {aiAnalysis && <div className="bg-purple-50 p-4 rounded-xl text-sm text-purple-900 mb-4 whitespace-pre-line border border-purple-100">{aiAnalysis}</div>}
                      <div className="overflow-hidden">
                          {webFilter.history.map((h, i) => (
                              <div key={i} className="flex justify-between py-3 border-b border-slate-50 last:border-0">
                                  <div className="truncate pr-4">
                                      <p className="font-medium text-slate-900 truncate">{h.title}</p>
                                      <p className="text-xs text-slate-400 truncate">{h.url}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                      <p className="text-xs text-slate-400">{h.timestamp}</p>
                                      <span className={`text-xs font-bold ${h.riskScore > 50 ? 'text-red-500' : 'text-green-500'}`}>Risk: {h.riskScore}</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
               </div>
            )}

            {/* --- LOCATION & ZONES --- */}
            {activeTab === 'location' && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4">Safe Zones</h3>
                    <div className="space-y-3">
                        {zones.map(z => (
                            <div key={z.id || z._id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <div>
                                    <p className="font-bold text-slate-900">{z.name}</p>
                                    <p className="text-xs text-slate-500 uppercase">{z.type}</p>
                                </div>
                                <button className="text-slate-400 hover:text-red-500"><Trash2 size={18}/></button>
                            </div>
                        ))}
                        <button className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:border-indigo-500 hover:text-indigo-600 font-bold flex items-center justify-center gap-2">
                            <Plus size={20}/> Add Zone
                        </button>
                    </div>
                </div>
            )}

            {/* --- SETTINGS --- */}
            {activeTab === 'settings' && (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-xl font-bold mb-6 text-slate-900">Device Configuration</h3>
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-500 mb-2">Weeknight Bedtime</label>
                                <input type="time" className="w-full p-2 border rounded" value={settings.bedtimeWeeknight} onChange={e=>setSettings({...settings, bedtimeWeeknight: e.target.value})}/>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-500 mb-2">Weekend Bedtime</label>
                                <input type="time" className="w-full p-2 border rounded" value={settings.bedtimeWeekend} onChange={e=>setSettings({...settings, bedtimeWeekend: e.target.value})}/>
                            </div>
                        </div>
                        <div className="flex items-center justify-between py-4 border-t border-slate-100">
                            <div>
                                <p className="font-bold text-slate-900">Uninstall Protection</p>
                                <p className="text-xs text-slate-500">Prevent app removal without PIN</p>
                            </div>
                            <button onClick={()=>setSettings({...settings, uninstallProtection: !settings.uninstallProtection})} className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${settings.uninstallProtection ? 'bg-green-500' : 'bg-slate-300'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.uninstallProtection ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </button>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button onClick={handleSync} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 flex items-center gap-2">
                                <Save size={18}/> Save Settings
                            </button>
                        </div>
                    </div>
                </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);