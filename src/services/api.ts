import { API_BASE_URL } from '../constants';

export const getAuthToken = (): string | null => {
  const match = document.cookie.match(new RegExp('(^| )token=([^;]+)'));
  return match ? match[2] : null;
};

export const setAuthToken = (token: string) => {
  // Set cookie to expire in 7 days
  const d = new Date();
  d.setTime(d.getTime() + (7 * 24 * 60 * 60 * 1000));
  const expires = "expires=" + d.toUTCString();
  document.cookie = `token=${token};${expires};path=/`;
};

export const removeAuthToken = () => {
  document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
};

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

export const apiFetch = async <T>(endpoint: string, options: FetchOptions = {}): Promise<T> => {
  const token = getAuthToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      removeAuthToken();
      window.location.hash = '#/'; // Redirect to login on 401
      throw new Error('Unauthorized');
    }
    const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
    throw new Error(errorData.message || `HTTP Error ${response.status}`);
  }

  return response.json();
};