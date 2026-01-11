import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { AppData, LocationData } from '../types';
import { MapPin, Grid, Clock, Navigation, AlertCircle, RefreshCw } from 'lucide-react';

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
                { name: 'TikTok', packageName: 'com.zhiliaoapp.musically', installDate: '2023-10-15' },
                { name: 'Instagram', packageName: 'com.instagram.android', installDate: '2023-09-01' },
                { name: 'Roblox', packageName: 'com.roblox.client', installDate: '2023-11-20' },
                { name: 'YouTube', packageName: 'com.google.android.youtube', installDate: '2023-01-10' },
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
            <div className="grid gap-4">
              {apps.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No apps found on this device.</p>
              ) : (
                apps.map((app, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-300 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
                        {app.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{app.name}</h4>
                        <p className="text-xs text-slate-500">{app.packageName}</p>
                      </div>
                    </div>
                    <div className="flex items-center text-xs text-slate-400 gap-1">
                      <Clock size={12} />
                      <span>{app.installDate || 'Unknown Date'}</span>
                    </div>
                  </div>
                ))
              )}
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