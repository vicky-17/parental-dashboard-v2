export interface User {
  email: string;
  token: string;
}

export interface Device {
  id: string;
  name: string;
  type?: string;
  status?: 'online' | 'offline';
  lastSeen?: string;
}

export interface AppData {
  name: string;
  packageName: string;
  installDate?: string;
  iconUrl?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: string;
  address?: string;
}

export interface ApiError {
  message: string;
}