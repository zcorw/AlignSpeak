import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export interface AuthUser {
  id: string
  email: string
  role: string
  displayName: string
  status: string
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  setAccessToken: (accessToken: string | null) => void
  setUser: (user: AuthUser | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        accessToken: null,
        user: null,
        setAccessToken: (accessToken) => set({ accessToken }),
        setUser: (user) => set({ user }),
        clearAuth: () => set({ accessToken: null, user: null }),
      }),
      {
        name: 'auth-storage',
      }
    )
  )
)
