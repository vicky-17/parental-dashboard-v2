import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { AppData, LocationData } from '../types';
import { MapPin, Grid, Clock, Navigation, AlertCircle, RefreshCw, Lock, Unlock, Plus, Trash2, Smartphone } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [activeTab, setActiveTab] = useState<'apps' | 'location'>('apps');
  const [apps, setApps] = useState<AppData[]>([]);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [deviceId, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'apps') {
        try {
            const data = await apiFetch<AppData[]>(`/data/${deviceId}/apps`);
            setApps(data);
        } catch {
            // Mock data
            setApps([
                { name: 'TikTok', packageName: 'com.zhiliaoapp.musically', installDate: '2023-10-15', category: 'Social', usedToday: 45, dailyLimit: 60 },
                { name: 'Instagram', packageName: 'com.instagram.android', installDate: '2023-09-01', category: 'Social', usedToday: 30, dailyLimit: 60 },
                { name: 'Roblox', packageName: 'com.roblox.client', installDate: '2023-11-20', category: 'Games', usedToday: 120, dailyLimit: 60, isGlobalLocked: true },
                { name: 'YouTube', packageName: 'com.google.android.youtube', installDate: '2023-01-10', category: 'Video', usedToday: 15, dailyLimit: 120 },
            ]);
        }
      } else {
        try {
            const data = await apiFetch<LocationData>(`/data/${deviceId}/location`);
            setLocation(data);
        } catch {
            // Mock data
            setLocation({
                latitude: 40.7128,
                longitude: -74.0060,
                timestamp: new Date().toISOString(),
                address: 'New York, NY 10007, USA'
            });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper for dynamic app icon colors
  const getAppColor = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('tiktok')) return 'bg-black';
    if (n.includes('youtube')) return 'bg-red-600';
    if (n.includes('roblox')) return 'bg-red-500';
    if (n.includes('instagram')) return 'bg-pink-600';
    return 'bg-indigo-600';
  };

  // Handlers (You will need to connect these to your API later)
  const toggleLock = (index: number) => {
    const newApps = [...apps];
    newApps[index].isGlobalLocked = !newApps[index].isGlobalLocked;
    setApps(newApps);
    // TODO: Call API to save
  };

  const addSchedule = (index: number) => {
    const newApps = [...apps];
    if (!newApps[index].schedules) newApps[index].schedules = [];
    newApps[index].schedules?.push({ id: Date.now().toString(), day: 'Everyday', start: '12:00', end: '13:00' });
    setApps(newApps);
  };

  const removeSchedule = (appIndex: number, scheduleId: string) => {
    const newApps = [...apps];
    newApps[appIndex].schedules = newApps[appIndex].schedules?.filter(s => s.id !== scheduleId);
    setApps(newApps);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
             <h2 className="text-xl font-bold text-slate-900">Device Dashboard</h2>
             <p className="text-sm text-slate-500">ID: {deviceId}</p>
          </div>
          <button 
            onClick={fetchData} 
            className="p-2 text-slate-400 hover:text-primary-600 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={20} />
          </button>
        </div>
        
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab('apps')}
            className={`flex-1 py-4 text-sm font-medium text-center transition-colors relative ${
              activeTab === 'apps' ? 'text-primary-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Grid size={18} />
              <span>Installed Apps</span>
            </div>
            {activeTab === 'apps' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('location')}
            className={`flex-1 py-4 text-sm font-medium text-center transition-colors relative ${
              activeTab === 'location' ? 'text-primary-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <MapPin size={18} />
              <span>Location Tracking</span>
            </div>
            {activeTab === 'location' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-600"></div>
            )}
          </button>
        </div>

        <div className="p-6 min-h-[400px]">
          {loading ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
               <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
               <p>Fetching device data...</p>
             </div>
          ) : activeTab === 'apps' ? (
            <div className="space-y-6">
                
              {/* Header */}
              <div className="flex items-center justify-between px-2">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                   App Limits & Schedules
                   <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">MongoDB: app_rules</span>
                </h3>
              </div>

              {/* App Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
                {apps.length === 0 ? (
                  <div className="col-span-full text-center text-slate-500 py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <Smartphone className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                    <p>No apps found on this device.</p>
                  </div>
                ) : (
                  apps.map((app, idx) => {
                    // Determine Card State
                    const isLocked = app.isGlobalLocked;
                    const hasSchedules = app.schedules && app.schedules.length > 0;
                    
                    let cardStyle = "bg-white border-slate-100 shadow-sm"; // Neutral
                    if (isLocked) cardStyle = "bg-red-50/30 border-red-200 shadow-red-100 shadow-md"; // Locked
                    else if (hasSchedules) cardStyle = "bg-orange-50/30 border-orange-200 shadow-orange-100 shadow-md"; // Scheduled

                    return (
                      <div key={idx} className={`rounded-xl border transition-all duration-200 overflow-hidden ${cardStyle}`}>
                        
                        {/* Global Lock Banner */}
                        {isLocked && (
                            <div className="bg-red-500 text-white text-[10px] font-bold text-center py-1 uppercase tracking-widest">
                                Global Lock Active
                            </div>
                        )}

                        <div className="p-5">
                          {/* Top Section: Identity & Master Switch */}
                          <div className="flex items-start justify-between gap-4">
                            
                            {/* Left: App Identity */}
                            <div className="flex items-start gap-4 flex-1">
                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-sm shrink-0 mt-1 ${getAppColor(app.name)}`}>
                                    <span className="text-white font-bold text-2xl">{app.name.charAt(0)}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    {/* App Name & Package */}
                                    <h4 className="font-bold text-slate-900 text-2xl leading-tight truncate pr-2">{app.name}</h4>
                                    <p className="text-xs text-slate-400 font-mono mb-3 truncate" title={app.packageName}>
                                      {app.packageName}
                                    </p>
                                    
                                    {/* Usage Stats (Big Display) */}
                                    <div className="flex items-end gap-2 mb-2">
                                        <span className="text-4xl font-black text-slate-800 leading-none tracking-tight">
                                          {app.usedToday || 0}
                                        </span>
                                        <span className="text-sm font-bold text-slate-400 mb-1.5 uppercase tracking-wide">
                                          min today
                                        </span>
                                    </div>

                                    {/* Meta Info */}
                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                        <span className="bg-slate-100 px-2 py-0.5 rounded">{app.category || 'General'}</span>
                                        {app.dailyLimit && app.dailyLimit > 0 && (
                                           <span className="text-slate-400">Limit: {app.dailyLimit}m</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Master Switch */}
                            <button 
                                onClick={() => toggleLock(idx)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm shrink-0 ${
                                    isLocked 
                                    ? 'bg-red-600 text-white hover:bg-red-700' 
                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                                <span>{isLocked ? 'Locked' : 'Unlocked'}</span>
                            </button>
                          </div>

                          {/* Bottom Section: Schedule Editor (Only if not locked) */}
                          {!isLocked && (
                              <div className="mt-6 pt-4 border-t border-slate-100/50">
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock size={12} className="text-orange-500" /> Allowed Schedules
                                    </h5>
                                    <button 
                                        onClick={() => addSchedule(idx)}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                    >
                                        <Plus size={12} /> Add Slot
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {(!app.schedules || app.schedules.length === 0) ? (
                                        <p className="text-xs text-slate-400 italic py-2">No schedules set. App is allowed until daily limit is reached.</p>
                                    ) : (
                                        app.schedules.map((slot) => (
                                            <div key={slot.id} className="flex items-center gap-2 bg-orange-50/50 border border-orange-100 p-2 rounded-lg">
                                                <span className="text-[10px] font-bold text-orange-600 uppercase bg-white px-1.5 py-0.5 rounded border border-orange-100">
                                                    Everyday
                                                </span>
                                                <div className="flex-1 flex items-center gap-2">
                                                    <input type="time" defaultValue={slot.start} className="bg-white border border-slate-200 rounded text-xs px-1 py-1 text-slate-600 w-full focus:border-orange-400 outline-none" />
                                                    <span className="text-slate-300">-</span>
                                                    <input type="time" defaultValue={slot.end} className="bg-white border border-slate-200 rounded text-xs px-1 py-1 text-slate-600 w-full focus:border-orange-400 outline-none" />
                                                </div>
                                                <button onClick={() => removeSchedule(idx, slot.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                              </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="h-full">
               {location ? (
                 <div className="flex flex-col h-full gap-6">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
                        <Navigation className="text-blue-600 mt-1 shrink-0" size={20} />
                        <div>
                            <h4 className="font-bold text-blue-900">Current Position</h4>
                            <p className="text-blue-700 text-sm mt-1">{location.address || `${location.latitude}, ${location.longitude}`}</p>
                            <p className="text-blue-500 text-xs mt-2">Updated: {new Date(location.timestamp).toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Placeholder for Map Visualization */}
                    <div className="flex-1 bg-slate-100 rounded-lg border border-slate-200 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')] opacity-10 bg-cover bg-center"></div>
                        <div className="z-10 bg-white p-4 rounded-full shadow-lg border border-white/50 mb-4 animate-bounce">
                           <MapPin className="text-red-500 fill-red-500" size={32} />
                        </div>
                        <p className="text-slate-500 font-medium z-10">Map Visualization</p>
                        <p className="text-slate-400 text-sm z-10 max-w-xs text-center mt-2">
                           Map view is simulated. Integration with Google Maps or Leaflet would render the interactive map here using coordinates:
                        </p>
                        <code className="mt-2 bg-slate-800 text-green-400 px-3 py-1 rounded text-xs z-10">
                           {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                        </code>
                    </div>
                    
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-full text-center py-3 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                    >
                      Open in Google Maps
                    </a>
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <AlertCircle size={48} className="mb-4 text-slate-300" />
                    <p>Location data unavailable</p>
                 </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;