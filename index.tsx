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
  Radio
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// --- Configuration ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- MongoDB-like Types ---

interface TimeSlot {
  id: string;
  start: string;
  end: string;
  days: string[]; // e.g., ['Mon', 'Tue']
}

interface AppRule {
  id: string;
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
  id: string;
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

// --- Mock Data (Simulating DB) ---

const MOCK_APPS: AppRule[] = [
  { 
    id: '1', appName: "TikTok", packageName: 'com.zhiliaoapp.musically', category: "Social", icon: "🎵", color: "bg-black", 
    isGlobalLocked: false, 
    schedules: [{ id: 't1', start: '18:00', end: '20:00', days: ['All'] }], 
    dailyUsageLimitMinutes: 60, usedTodayMinutes: 45 
  },
  { 
    id: '2', appName: "Roblox", packageName: 'com.roblox.client', category: "Game", icon: "🎮", color: "bg-red-500", 
    isGlobalLocked: true, 
    schedules: [], 
    dailyUsageLimitMinutes: 30, usedTodayMinutes: 0 
  },
  { 
    id: '3', appName: "Chrome", packageName: 'com.android.chrome', category: "Browser", icon: "🌐", color: "bg-blue-500", 
    isGlobalLocked: false, 
    schedules: [{ id: 't2', start: '08:00', end: '21:00', days: ['All'] }], 
    dailyUsageLimitMinutes: 120, usedTodayMinutes: 30 
  }
];

const MOCK_ZONES: Zone[] = [
  { id: 'z1', name: 'Lincoln High School', type: 'safe', points: [{lat:0,lng:0}], alertMessage: 'Child has arrived at school.' },
  { id: 'z2', name: 'Downtown Construction', type: 'danger', points: [{lat:0,lng:0}], alertMessage: 'ALERT: Child entered dangerous construction zone!' }
];

const MOCK_WEB: WebFilter = {
  blockedCategories: ['pornography', 'gambling', 'violence'],
  blockedUrls: ['bad-site.com', 'gambling-hub.net'],
  history: [
    { url: 'https://wikipedia.org/wiki/React', title: 'React (software) - Wikipedia', timestamp: '10:30 AM', riskScore: 0 },
    { url: 'https://math-solver.com', title: 'Free Algebra Solver', timestamp: '11:15 AM', riskScore: 10 },
    { url: 'https://sketchy-game-mods.net', title: 'Free Robux Generator', timestamp: '2:00 PM', riskScore: 85 }
  ]
};

// --- Components ---

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState("Just now");

  // State mimicking DB collections
  const [apps, setApps] = useState<AppRule[]>(MOCK_APPS);
  const [zones, setZones] = useState<Zone[]>(MOCK_ZONES);
  const [webFilter, setWebFilter] = useState<WebFilter>(MOCK_WEB);
  const [settings, setSettings] = useState<DeviceSettings>({
    bedtimeWeeknight: '21:00',
    bedtimeWeekend: '23:00',
    uninstallProtection: true,
    locationTracking: true
  });

  // AI State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Live Location State
  const [currentLocation, setCurrentLocation] = useState({
    lat: 40.7128,
    lng: -74.0060,
    address: "123 School Lane, Lincoln High",
    speed: 4.2,
    timestamp: new Date()
  });

  // Simulate Live Location Updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLocation(prev => ({
        ...prev,
        lat: prev.lat + (Math.random() - 0.5) * 0.0002,
        lng: prev.lng + (Math.random() - 0.5) * 0.0002,
        speed: Math.max(0, Math.min(15, prev.speed + (Math.random() - 0.5) * 2)),
        timestamp: new Date()
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // --- Actions ---

  const handleSync = () => {
    setIsSyncing(true);
    // Simulate API Call to MongoDB Backend
    // In real app: await fetch('https://api.parentalwatch.com/sync', { method: 'POST', body: JSON.stringify({ ...data }) })
    setTimeout(() => {
      setIsSyncing(false);
      setLastSynced(new Date().toLocaleTimeString());
    }, 1500);
  };

  const toggleGlobalLock = (id: string) => {
    setApps(apps.map(app => app.id === id ? { ...app, isGlobalLocked: !app.isGlobalLocked } : app));
  };

  const addSchedule = (appId: string) => {
    setApps(apps.map(app => {
      if (app.id === appId) {
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
      if (app.id === appId) {
        return { ...app, schedules: app.schedules.filter(s => s.id !== slotId) };
      }
      return app;
    }));
  };

  const updateSchedule = (appId: string, slotId: string, field: 'start' | 'end', value: string) => {
    setApps(apps.map(app => {
      if (app.id === appId) {
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
        
        1. Flag any suspicious URLs even if not explicitly blocked.
        2. Give a safety score (0-100).
        3. Suggest new categories to block if needed.
      `;
      const res = await ai.models.generateContent({ model: 'gemini-2.5-flash-latest', contents: prompt });
      setAiAnalysis(res.text);
    } catch (e) {
      setAiAnalysis("Could not connect to AI service.");
    } finally {
      setAnalyzing(false);
    }
  };

  const NavItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        activeTab === id 
          ? 'bg-indigo-600 text-white shadow-md' 
          : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

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
             <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-500 font-medium uppercase mb-2">Connected Device</p>
                <div className="flex items-center gap-2">
                   <Smartphone size={16} className="text-slate-400"/>
                   <span className="text-sm font-semibold">Alex's Galaxy S24</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                   Online
                </div>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-2 text-slate-600">
            <Menu size={24} />
          </button>
          
          <h2 className="text-lg font-semibold text-slate-800 capitalize hidden sm:block">{activeTab.replace('-', ' ')}</h2>

          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
               <p className="text-xs text-slate-400">Last Synced</p>
               <p className="text-sm font-medium text-slate-700">{lastSynced}</p>
            </div>
            <button 
               onClick={handleSync}
               disabled={isSyncing}
               className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
                 isSyncing 
                   ? 'bg-indigo-100 text-indigo-400 cursor-wait' 
                   : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200'
               }`}
            >
               <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
               {isSyncing ? 'Syncing DB...' : 'Sync Device'}
            </button>
          </div>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-8">

            {/* --- DASHBOARD --- */}
            {activeTab === 'dashboard' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {/* Quick Stats */}
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
                    <p className="text-xs text-slate-400">Last attempt: Roblox (Global Lock)</p>
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
                 
                 {/* Live Map Widget - Spans full width */}
                 <div className="col-span-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row h-96">
                    {/* Map Visualization */}
                     <div className="flex-1 bg-slate-100 relative group overflow-hidden">
                        {/* Background Map Image */}
                        <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')] opacity-30 bg-cover bg-center transition-opacity group-hover:opacity-40"></div>
                        
                        {/* Grid Lines Overlay */}
                        <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px', opacity: 0.5}}></div>

                        {/* Child Pin */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-1000 ease-in-out" 
                             style={{transform: `translate(-50%, -50%) translate(${(currentLocation.lng + 74.0060) * 1000}px, ${(currentLocation.lat - 40.7128) * 1000}px)`}}>
                             
                             <div className="w-24 h-24 rounded-full bg-indigo-500/20 animate-ping absolute top-[-30px] left-[-30px]"></div>
                             <div className="w-16 h-16 rounded-full bg-indigo-500/40 animate-pulse absolute top-[-14px] left-[-14px]"></div>
                             
                             <div className="relative z-10 w-10 h-10 bg-indigo-600 border-4 border-white rounded-full shadow-xl flex items-center justify-center overflow-hidden">
                                <span className="text-white font-bold text-xs">ALEX</span>
                             </div>
                             
                             <div className="mt-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow-lg border border-slate-100 flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Moving • {currentLocation.speed.toFixed(1)} mph</span>
                             </div>
                        </div>
                        
                        {/* Map Controls */}
                        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                            <button className="bg-white p-2 rounded-lg shadow text-slate-600 hover:text-indigo-600"><Plus size={20}/></button>
                            <button className="bg-white p-2 rounded-lg shadow text-slate-600 hover:text-indigo-600"><Settings size={20}/></button>
                        </div>
                    </div>

                    {/* Live Data Sidebar */}
                    <div className="w-full md:w-80 bg-white p-6 border-l border-slate-100 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <Radio size={18} className="text-red-500 animate-pulse" /> Live Tracking
                            </h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase tracking-wide">Connected</span>
                        </div>
                        
                        <div className="space-y-6 flex-1">
                            <div className="relative pl-4 border-l-2 border-indigo-100">
                                <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white"></div>
                                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Current Location</p>
                                <p className="text-sm font-medium text-slate-900 leading-snug">{currentLocation.address}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Speed</p>
                                    <p className="text-xl font-bold text-slate-900">{currentLocation.speed.toFixed(1)} <span className="text-xs font-normal text-slate-500">mph</span></p>
                                 </div>
                                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Battery</p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-green-500 w-[78%]"></div>
                                        </div>
                                        <span className="text-sm font-bold text-slate-900">78%</span>
                                    </div>
                                 </div>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">GPS Coordinates</p>
                                <p className="text-xs font-mono text-slate-600 break-all">
                                    {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                                </p>
                            </div>
                        </div>

                        <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                            <span>Updated: {currentLocation.timestamp.toLocaleTimeString()}</span>
                            <Globe size={14} />
                        </div>
                    </div>
                </div>
                 
                 {/* AI Insight Teaser */}
                 <div className="col-span-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-start gap-4">
                       <BrainCircuit className="shrink-0 mt-1 opacity-80" size={24} />
                       <div>
                          <h3 className="font-bold text-lg">AI Daily Insight</h3>
                          <p className="text-indigo-100 mt-1 max-w-2xl">Based on today's activity, usage of educational apps has dropped by 40%. Consider unlocking "Khan Academy" during the evening schedule to encourage study time.</p>
                       </div>
                    </div>
                 </div>
              </div>
            )}

            {/* --- APP RULES (Advanced Scheduling) --- */}
            {activeTab === 'usage' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                   <h3 className="text-lg font-bold text-slate-800">App Limits & Schedules</h3>
                   <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">MongoDB Collection: app_rules</span>
                </div>

                <div className="grid gap-6">
                  {apps.map((app) => (
                    <div 
                      key={app.id} 
                      className={`
                        relative bg-white rounded-xl border-2 transition-all overflow-hidden
                        ${app.isGlobalLocked ? 'border-red-200 shadow-red-50' : app.schedules.length > 0 ? 'border-orange-200 shadow-orange-50' : 'border-slate-100'}
                      `}
                    >
                      {app.isGlobalLocked && (
                        <div className="bg-red-50 text-red-700 px-4 py-1 text-xs font-bold uppercase tracking-wide flex items-center gap-2">
                           <Lock size={12} /> Global Lock Active
                        </div>
                      )}
                      
                      <div className="p-5">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                           
                           {/* App Info */}
                           <div className="flex items-center gap-4">
                              <div className={`w-14 h-14 ${app.color} rounded-2xl flex items-center justify-center text-white text-2xl shadow-sm`}>
                                 {app.icon}
                              </div>
                              <div>
                                 <h4 className="text-lg font-bold text-slate-900">{app.appName}</h4>
                                 <p className="text-sm text-slate-500">{app.category}</p>
                                 <div className="mt-2 flex items-center gap-2">
                                    <div className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                       Used: {app.usedTodayMinutes}m / {app.dailyUsageLimitMinutes}m
                                    </div>
                                 </div>
                              </div>
                           </div>

                           {/* Controls */}
                           <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                              <button 
                                onClick={() => toggleGlobalLock(app.id)}
                                className={`w-full md:w-48 py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all ${
                                  app.isGlobalLocked 
                                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200' 
                                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {app.isGlobalLocked ? <><Lock size={16}/> Locked Always</> : <><Unlock size={16}/> Unlocked / Scheduled</>}
                              </button>
                           </div>
                        </div>

                        {/* Schedules (Only show if not global locked) */}
                        {!app.isGlobalLocked && (
                           <div className="mt-6 pt-6 border-t border-slate-100">
                              <div className="flex items-center justify-between mb-3">
                                 <h5 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <Clock size={16} className="text-orange-500"/> Allowed Schedules
                                 </h5>
                                 <button onClick={() => addSchedule(app.id)} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium">
                                    <Plus size={14} /> Add Slot
                                 </button>
                              </div>
                              
                              <div className="space-y-2">
                                 {app.schedules.length === 0 && (
                                    <p className="text-sm text-slate-400 italic">No schedules set. App is allowed until daily limit is reached.</p>
                                 )}
                                 {app.schedules.map(slot => (
                                    <div key={slot.id} className="flex items-center gap-3 bg-orange-50 p-2 rounded-lg border border-orange-100">
                                       <span className="text-xs font-bold text-orange-700 uppercase px-2 w-12">Everyday</span>
                                       <input 
                                          type="time" 
                                          value={slot.start}
                                          onChange={(e) => updateSchedule(app.id, slot.id, 'start', e.target.value)}
                                          className="bg-white border border-orange-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-500"
                                       />
                                       <span className="text-orange-400">-</span>
                                       <input 
                                          type="time" 
                                          value={slot.end}
                                          onChange={(e) => updateSchedule(app.id, slot.id, 'end', e.target.value)}
                                          className="bg-white border border-orange-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-500"
                                       />
                                       <button onClick={() => removeSchedule(app.id, slot.id)} className="ml-auto text-orange-400 hover:text-red-500 p-1">
                                          <Trash2 size={16} />
                                       </button>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- WEB SAFETY (New) --- */}
            {activeTab === 'web' && (
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Configuration */}
                  <div className="lg:col-span-1 space-y-6">
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                           <Shield size={20} className="text-indigo-600" /> Block Categories
                        </h3>
                        <div className="space-y-3">
                           {['pornography', 'gambling', 'violence', 'social-media'].map(cat => (
                              <label key={cat} className="flex items-center justify-between cursor-pointer group">
                                 <span className="capitalize text-slate-600 group-hover:text-slate-900">{cat.replace('-', ' ')}</span>
                                 <div className={`w-11 h-6 flex items-center rounded-full px-1 transition-colors ${webFilter.blockedCategories.includes(cat) ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${webFilter.blockedCategories.includes(cat) ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                 </div>
                              </label>
                           ))}
                        </div>
                     </div>

                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                           <AlertOctagon size={20} className="text-red-600" /> Blocked URLs
                        </h3>
                        <ul className="space-y-2 mb-4">
                           {webFilter.blockedUrls.map((url, i) => (
                              <li key={i} className="flex justify-between items-center text-sm bg-slate-50 p-2 rounded">
                                 <span className="text-red-600 truncate">{url}</span>
                                 <button className="text-slate-400 hover:text-red-600"><X size={14}/></button>
                              </li>
                           ))}
                        </ul>
                        <div className="flex gap-2">
                           <input type="text" placeholder="example.com" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                           <button className="bg-slate-900 text-white px-3 rounded-lg"><Plus size={18} /></button>
                        </div>
                     </div>
                  </div>

                  {/* Browser History & AI */}
                  <div className="lg:col-span-2 space-y-6">
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                           <h3 className="font-bold text-slate-800 flex items-center gap-2">
                              <Globe size={20} className="text-blue-500" /> Browser History
                           </h3>
                           <button 
                              onClick={analyzeWebSafety}
                              disabled={analyzing}
                              className="text-sm bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg font-medium hover:bg-purple-200 flex items-center gap-2 transition-colors"
                           >
                              <BrainCircuit size={16} /> 
                              {analyzing ? 'Analyzing...' : 'Analyze Risks with AI'}
                           </button>
                        </div>

                        {aiAnalysis && (
                           <div className="mb-6 bg-purple-50 border border-purple-100 p-4 rounded-xl text-sm text-purple-900 leading-relaxed whitespace-pre-line">
                              {aiAnalysis}
                           </div>
                        )}

                        <div className="overflow-hidden rounded-xl border border-slate-200">
                           <table className="w-full text-sm text-left">
                              <thead className="bg-slate-50 text-slate-500 font-medium">
                                 <tr>
                                    <th className="px-4 py-3">Timestamp</th>
                                    <th className="px-4 py-3">Page Title / URL</th>
                                    <th className="px-4 py-3 text-right">Risk Score</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                 {webFilter.history.map((entry, i) => (
                                    <tr key={i} className="hover:bg-slate-50">
                                       <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{entry.timestamp}</td>
                                       <td className="px-4 py-3">
                                          <div className="font-medium text-slate-900">{entry.title}</div>
                                          <div className="text-slate-400 text-xs truncate max-w-[200px]">{entry.url}</div>
                                       </td>
                                       <td className="px-4 py-3 text-right">
                                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                                             entry.riskScore > 80 ? 'bg-red-100 text-red-700' : 
                                             entry.riskScore > 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                          }`}>
                                             {entry.riskScore}/100
                                          </span>
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {/* --- GEOFENCING --- */}
            {activeTab === 'location' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Zone List */}
                 <div className="lg:col-span-1 space-y-4">
                    <button className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-indigo-500 hover:text-indigo-600 font-medium flex items-center justify-center gap-2 transition-colors">
                       <Plus size={20} /> Create New Zone
                    </button>

                    {zones.map(zone => (
                       <div key={zone.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer group">
                          <div className="flex justify-between items-start">
                             <div>
                                <h4 className="font-bold text-slate-800">{zone.name}</h4>
                                <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded mt-1 font-medium ${zone.type === 'safe' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                   {zone.type === 'safe' ? <Shield size={10} /> : <AlertTriangle size={10} />}
                                   {zone.type === 'safe' ? 'Safe Zone' : 'Danger Zone'}
                                </div>
                             </div>
                             <button className="text-slate-300 group-hover:text-slate-500">
                                <Settings size={16} />
                             </button>
                          </div>
                          <div className="mt-3 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                             🔔 Alert: "{zone.alertMessage}"
                          </div>
                       </div>
                    ))}
                 </div>

                 {/* Simulated Map */}
                 <div className="lg:col-span-2 bg-slate-200 rounded-2xl relative overflow-hidden h-[500px] flex items-center justify-center border border-slate-300">
                    <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')] opacity-10 bg-cover bg-center"></div>
                    
                    {/* Mock Map UI Controls */}
                    <div className="absolute top-4 right-4 bg-white p-2 rounded-lg shadow-lg flex flex-col gap-2">
                       <button className="p-2 hover:bg-slate-100 rounded" title="Draw Polygon"><Settings size={20} className="text-slate-600"/></button>
                       <button className="p-2 hover:bg-slate-100 rounded" title="Current Location"><MapPin size={20} className="text-blue-600"/></button>
                    </div>

                    <div className="text-center p-6 bg-white/90 backdrop-blur-sm rounded-xl shadow-xl max-w-sm">
                       <MapPin size={48} className="mx-auto text-indigo-600 mb-4 animate-bounce" />
                       <h3 className="font-bold text-slate-900 text-lg">Interactive Map Placeholder</h3>
                       <p className="text-slate-500 text-sm mt-2">
                          In production, this would use the Google Maps JavaScript API to allow parents to draw polygons by clicking points on the map.
                       </p>
                       <p className="text-xs text-slate-400 mt-4 font-mono bg-slate-100 p-2 rounded">
                          MongoDB: geo_zones collection (GeoJSON)
                       </p>
                    </div>
                 </div>
              </div>
            )}

            {/* --- SETTINGS --- */}
            {activeTab === 'settings' && (
               <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
                  <h3 className="text-xl font-bold text-slate-900 mb-8 pb-4 border-b border-slate-100">Global Configuration</h3>
                  
                  <div className="space-y-8">
                     <section>
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Bedtime Schedules</h4>
                        <div className="grid grid-cols-2 gap-6">
                           <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">School Night (Sun-Thu)</label>
                              <input 
                                type="time" 
                                value={settings.bedtimeWeeknight}
                                onChange={(e) => setSettings({...settings, bedtimeWeeknight: e.target.value})}
                                className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white transition-colors"
                              />
                           </div>
                           <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Weekend (Fri-Sat)</label>
                              <input 
                                type="time" 
                                value={settings.bedtimeWeekend}
                                onChange={(e) => setSettings({...settings, bedtimeWeekend: e.target.value})}
                                className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white transition-colors"
                              />
                           </div>
                        </div>
                     </section>

                     <section>
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Security & Permissions</h4>
                        <div className="space-y-4">
                           <div className="flex items-center justify-between">
                              <div>
                                 <p className="font-medium text-slate-900">Anti-Tamper Protection</p>
                                 <p className="text-xs text-slate-500">Require PIN to uninstall app on child's device.</p>
                              </div>
                              <button 
                                onClick={() => setSettings({...settings, uninstallProtection: !settings.uninstallProtection})}
                                className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${settings.uninstallProtection ? 'bg-green-500' : 'bg-slate-300'}`}
                              >
                                 <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.uninstallProtection ? 'translate-x-6' : 'translate-x-0'}`}></div>
                              </button>
                           </div>
                           <div className="flex items-center justify-between">
                              <div>
                                 <p className="font-medium text-slate-900">High Accuracy Tracking</p>
                                 <p className="text-xs text-slate-500">Collect GPS data every 5 minutes.</p>
                              </div>
                              <button 
                                onClick={() => setSettings({...settings, locationTracking: !settings.locationTracking})}
                                className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${settings.locationTracking ? 'bg-green-500' : 'bg-slate-300'}`}
                              >
                                 <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.locationTracking ? 'translate-x-6' : 'translate-x-0'}`}></div>
                              </button>
                           </div>
                        </div>
                     </section>

                     <div className="pt-6 border-t border-slate-100 flex justify-end">
                        <button className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
                           <Save size={18} /> Save Settings
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
