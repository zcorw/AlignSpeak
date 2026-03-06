import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: { id: string; email: string } | null
  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: { id: string; email: string }) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        accessToken: null,
        refreshToken: null,
        user: null,
        setTokens: (accessToken, refreshToken) =>
          set({ accessToken, refreshToken }),
        setUser: (user) => set({ user }),
        clearAuth: () =>
          set({ accessToken: null, refreshToken: null, user: null }),
      }),
      {
        name: 'auth-storage',
      }
    )
  )
)
