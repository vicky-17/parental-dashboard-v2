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
  _id?: string; // Optional MongoDB ID
  name: string;
  packageName: string;
  category?: string;
  installDate?: string;
  iconUrl?: string;
  usedToday?: number; // In minutes
  dailyLimit?: number; // In minutes
  isGlobalLocked?: boolean;
  schedules?: {
    id: string;
    day: string;
    start: string;
    end: string;
  }[];
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