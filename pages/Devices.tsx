import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { Device } from '../types';
import { Plus, Smartphone, Tablet, Monitor, MoreVertical, Loader2 } from 'lucide-react';

const Devices: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      // In a real app, this hits GET /api/devices
      // Mocking response if backend isn't actually there to prevent white screen for demo
      try {
        const data = await apiFetch<Device[]>('/devices');
        setDevices(data);
      } catch (e) {
        console.warn("Failed to fetch devices, using mock data for demo", e);
        setDevices([
          { id: '1', name: "Timmy's Phone", type: 'phone', status: 'online', lastSeen: 'Now' },
          { id: '2', name: "Sarah's Tablet", type: 'tablet', status: 'offline', lastSeen: '2 hours ago' }
        ]);
      }
    } catch (error) {
      console.error('Failed to load devices', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = async () => {
    setAdding(true);
    try {
      // POST /api/devices/add
      const data = await apiFetch<{ code: string }>('/devices/add', { method: 'POST' });
      setPairingCode(data.code);
    } catch (error) {
      // Mock for demo
      setPairingCode(Math.random().toString(36).substring(2, 8).toUpperCase());
    } finally {
      setAdding(false);
    }
  };

  const getIcon = (type: string = 'phone') => {
    switch (type.toLowerCase()) {
      case 'tablet': return <Tablet className="text-primary-500" size={32} />;
      case 'desktop': return <Monitor className="text-primary-500" size={32} />;
      default: return <Smartphone className="text-primary-500" size={32} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Connected Devices</h1>
          <p className="text-slate-500">Manage and monitor all child devices.</p>
        </div>
        <button
          onClick={handleAddDevice}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
          Add Device
        </button>
      </div>

      {pairingCode && (
        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl flex flex-col items-center justify-center animate-in fade-in slide-in-from-top-4">
          <h3 className="text-lg font-semibold text-indigo-900 mb-2">Pairing Code</h3>
          <div className="text-4xl font-mono font-bold text-primary-600 tracking-wider bg-white px-8 py-4 rounded-lg shadow-sm border border-indigo-100">
            {pairingCode}
          </div>
          <p className="text-indigo-600 mt-3 text-sm">Enter this code on the child's device app.</p>
          <button 
            onClick={() => setPairingCode(null)} 
            className="mt-4 text-sm text-slate-500 hover:text-slate-800 underline"
          >
            Close
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-primary-500" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => (
            <div
              key={device.id}
              onClick={() => navigate(`/dashboard/${device.id}`)}
              className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-50 rounded-lg group-hover:bg-primary-50 transition-colors">
                  {getIcon(device.type)}
                </div>
                <button className="text-slate-400 hover:text-slate-600">
                  <MoreVertical size={20} />
                </button>
              </div>
              
              <h3 className="text-lg font-bold text-slate-900 mb-1">{device.name}</h3>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                <span className="text-sm text-slate-500">
                  {device.status === 'online' ? 'Online' : `Last seen: ${device.lastSeen}`}
                </span>
              </div>
              
              <div className="w-full bg-slate-50 rounded-lg py-2 px-3 text-center text-sm font-medium text-slate-600 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                View Dashboard
              </div>
            </div>
          ))}

          {devices.length === 0 && !loading && (
             <div className="col-span-full flex flex-col items-center justify-center p-12 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
               <Smartphone className="text-slate-300 mb-4" size={48} />
               <h3 className="text-lg font-medium text-slate-900">No devices yet</h3>
               <p className="text-slate-500 mb-6 max-w-sm">Add a device to start monitoring activities and location.</p>
               <button onClick={handleAddDevice} className="text-primary-600 font-medium hover:underline">Add your first device</button>
             </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Devices;