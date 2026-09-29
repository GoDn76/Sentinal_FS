import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const savedToken = localStorage.getItem('sentinelfs_jwt');
  const savedUser = localStorage.getItem('sentinelfs_user');

  return {
    user: savedUser ? JSON.parse(savedUser) : null,
    token: savedToken || null,
    isAuthenticated: !!savedToken,

    setAuth: (user, token) => {
      localStorage.setItem('sentinelfs_jwt', token);
      localStorage.setItem('sentinelfs_user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true });
    },

    logout: () => {
      localStorage.removeItem('sentinelfs_jwt');
      localStorage.removeItem('sentinelfs_user');
      set({ user: null, token: null, isAuthenticated: false });
    },
  };
});
