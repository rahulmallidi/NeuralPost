import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: (user, accessToken, refreshToken) => set({
        user, accessToken, refreshToken, isAuthenticated: true,
      }),

      logout: () => set({
        user: null, accessToken: null, refreshToken: null, isAuthenticated: false,
      }),

      updateUser: (user) => set({ user }),

      setAccessToken: (accessToken) => set({ accessToken }),

      getAccessToken: () => get().accessToken,
    }),
    {
      name: 'neuralpost-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
