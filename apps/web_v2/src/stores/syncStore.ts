import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { PendingAction } from '../types'

interface SyncState {
  pendingActions: PendingAction[]
  addPendingAction: (action: Omit<PendingAction, 'id' | 'createdAt' | 'retryCount' | 'lastError'>) => void
  updatePendingAction: (id: string, updates: Partial<PendingAction>) => void
  removePendingAction: (id: string) => void
  clearExpiredActions: () => void
}

const EXPIRY_HOURS = 24

export const useSyncStore = create<SyncState>()(
  devtools(
    persist(
      (set) => ({
        pendingActions: [],
        addPendingAction: (action) =>
          set((state) => ({
            pendingActions: [
              ...state.pendingActions,
              {
                ...action,
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                retryCount: 0,
                lastError: null,
              },
            ],
          })),
        updatePendingAction: (id, updates) =>
          set((state) => ({
            pendingActions: state.pendingActions.map((action) =>
              action.id === id ? { ...action, ...updates } : action
            ),
          })),
        removePendingAction: (id) =>
          set((state) => ({
            pendingActions: state.pendingActions.filter((action) => action.id !== id),
          })),
        clearExpiredActions: () => {
          const now = Date.now()
          const expiryMs = EXPIRY_HOURS * 60 * 60 * 1000
          set((state) => ({
            pendingActions: state.pendingActions.filter((action) => {
              const createdAt = new Date(action.createdAt).getTime()
              return now - createdAt < expiryMs
            }),
          }))
        },
      }),
      {
        name: 'sync-storage',
      }
    )
  )
)
