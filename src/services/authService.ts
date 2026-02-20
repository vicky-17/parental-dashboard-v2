import { apiFetch, setAuthToken, removeAuthToken } from './api';
import { User } from '../utils/types';

export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    const data = await apiFetch<User>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  register: async (email: string, password: string): Promise<void> => {
    await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  logout: () => {
    // Logic handled in api.ts removeAuthToken, but we expose a clean method here
    removeAuthToken();
    window.location.hash = '#/';
  }
};
