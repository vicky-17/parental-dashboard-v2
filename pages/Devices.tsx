import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getAuthToken } from '../services/api';
import { Device } from '../types';
import { Plus, Smartphone, Tablet, Monitor, MoreVertical, Loader2, Trash2, RefreshCw, X, AlertTriangle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../constants';

const Devices: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(120); // 2 minutes in seconds
  const [pairingStatus, setPairingStatus] = useState<'waiting' | 'success' | 'timeout' | 'cancelled'>('waiting');
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchDevices();
    
    // Initialize Socket.IO connection
    const serverUrl = API_BASE_URL.replace('/api', '');
    socketRef.current = io(serverUrl, {
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Connected to server');
    });

    socketRef.current.on('pairing_success', (data) => {
      console.log('🎉 Pairing successful!', data);
      setPairingStatus('success');
      
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Refresh device list
      setTimeout(() => {
        fetchDevices();
        closePairingModal();
      }, 2000);
    });

    socketRef.current.on('pairing_timeout', (data) => {
      console.log('⏰ Pairing timeout', data);
      setPairingStatus('timeout');
      
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    });

    socketRef.current.on('delete_success', (data) => {
      console.log('🗑️ Device deleted', data);
      fetchDevices();
    });

    socketRef.current.on('delete_error', (data) => {
      console.error('❌ Delete error', data);
      alert('Failed to delete device: ' + data.error);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const fetchDevices = async () => {
    try {
      const data = await apiFetch<Device[]>('/devices');
      setDevices(data);
    } catch (error) {
      console.error('Failed to load devices', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = async () => {
    setAdding(true);
    setPairingStatus('waiting');
    setTimeRemaining(120);
    
    try {
      const data = await apiFetch<{ code: string }>('/devices/add', { method: 'POST' });
      setPairingCode(data.code);

      // Register socket for this pairing code
      if (socketRef.current) {
        socketRef.current.emit('register_pairing', { code: data.code });
      }

      // Start countdown timer
      startCountdown();
    } catch (error) {
      console.error('Failed to generate pairing code', error);
      alert('Failed to generate pairing code. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const startCountdown = () => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const closePairingModal = () => {
    setPairingCode(null);
    setPairingStatus('waiting');
    setTimeRemaining(120);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const handleCancelPairing = async () => {
    if (pairingCode) {
      try {
        await apiFetch('/devices/cancel-pairing', { 
          method: 'POST',
          body: JSON.stringify({ code: pairingCode })
        });
        
        setPairingStatus('cancelled');
        
        setTimeout(() => {
          closePairingModal();
        }, 1000);
      } catch (error) {
        console.error('Failed to cancel pairing', error);
        closePairingModal();
      }
    }
  };

  const handleDeleteDevice = async (device: Device) => {
    setDeviceToDelete(device);
  };

  const confirmDelete = async () => {
    if (!deviceToDelete) return;
    
    setDeleting(true);
    
    try {
      await apiFetch(`/devices/${deviceToDelete.id}`, { method: 'DELETE' });
      
      // Update local state
      setDevices(devices.filter(d => d.id !== deviceToDelete.id));
      setDeviceToDelete(null);
    } catch (error) {
      console.error('Failed to delete device', error);
      alert('Failed to delete device. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          disabled={adding || !!pairingCode}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {adding ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
          Pair New Device
        </button>
      </div>

      {/* Pairing Modal */}
      {pairingCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {pairingStatus === 'waiting' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="text-primary-600" size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Pairing Code</h3>
                  <p className="text-slate-500">Enter this code on the child's device app</p>
                </div>

                <div className="bg-gradient-to-br from-primary-50 to-indigo-50 rounded-xl p-6 mb-6 border-2 border-primary-200">
                  <div className="text-5xl font-mono font-bold text-primary-600 tracking-widest text-center">
                    {pairingCode}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="flex items-center gap-2 text-slate-600">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Waiting for device...</span>
                  </div>
                  <span className="text-sm font-mono text-slate-400">
                    {formatTime(timeRemaining)}
                  </span>
                </div>

                <button
                  onClick={handleCancelPairing}
                  className="w-full py-3 text-slate-600 hover:text-slate-900 font-medium transition-colors border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              </>
            )}

            {pairingStatus === 'success' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Device Paired!</h3>
                <p className="text-slate-500">Successfully connected to child device</p>
              </div>
            )}

            {pairingStatus === 'timeout' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="text-amber-600" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Pairing Timeout</h3>
                <p className="text-slate-500 mb-6">The pairing code has expired. Please try again.</p>
                <button
                  onClick={closePairingModal}
                  className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                >
                  Close
                </button>
              </div>
            )}

            {pairingStatus === 'cancelled' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="text-slate-600" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Pairing Cancelled</h3>
                <p className="text-slate-500">The pairing process was cancelled</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deviceToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Remove Device?</h3>
              <p className="text-slate-500">
                Are you sure you want to remove <strong>{deviceToDelete.name}</strong>? 
                All associated data (location history, app usage, etc.) will be permanently deleted.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeviceToDelete(null)}
                disabled={deleting}
                className="flex-1 py-3 text-slate-600 hover:text-slate-900 font-medium transition-colors border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 size={20} />
                    Remove
                  </>
                )}
              </button>
            </div>
          </div>
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
              className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-primary-200 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div 
                  onClick={() => navigate(`/dashboard/${device.id}`)}
                  className="p-3 bg-slate-50 rounded-lg group-hover:bg-primary-50 transition-colors cursor-pointer"
                >
                  {getIcon(device.type)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddDevice}
                    className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Re-pair device"
                  >
                    <RefreshCw size={18} />
                  </button>
                  
                  {/* START: DELETE BUTTON CODE */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevents clicking the card background
                      handleDeleteDevice(device);
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove device"
                  >
                    <Trash2 size={18} />
                  </button>
                  {/* END: DELETE BUTTON CODE */}
                </div>
              </div>
              
              <div onClick={() => navigate(`/dashboard/${device.id}`)} className="cursor-pointer">
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
