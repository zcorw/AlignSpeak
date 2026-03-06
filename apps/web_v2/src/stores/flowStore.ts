import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface FlowState {
  flowVersion: string
  currentStep: 'start' | 'editor' | 'practice' | 'result' | 'me'
  articleDraft: {
    content: string
    language: 'ja' | 'zh' | 'en' | null
  } | null
  contextIds: {
    articleId: string | null
    segmentId: string | null
    practiceSessionId: string | null
  }
  updatedAt: string
  setCurrentStep: (step: FlowState['currentStep']) => void
  setArticleDraft: (draft: FlowState['articleDraft']) => void
  setContextIds: (ids: Partial<FlowState['contextIds']>) => void
  clearFlow: () => void
}

export const useFlowStore = create<FlowState>()(
  devtools(
    persist(
      (set) => ({
        flowVersion: '2.0',
        currentStep: 'start',
        articleDraft: null,
        contextIds: {
          articleId: null,
          segmentId: null,
          practiceSessionId: null,
        },
        updatedAt: new Date().toISOString(),
        setCurrentStep: (step) =>
          set({ currentStep: step, updatedAt: new Date().toISOString() }),
        setArticleDraft: (draft) =>
          set({ articleDraft: draft, updatedAt: new Date().toISOString() }),
        setContextIds: (ids) =>
          set((state) => ({
            contextIds: { ...state.contextIds, ...ids },
            updatedAt: new Date().toISOString(),
          })),
        clearFlow: () =>
          set({
            currentStep: 'start',
            articleDraft: null,
            contextIds: {
              articleId: null,
              segmentId: null,
              practiceSessionId: null,
            },
            updatedAt: new Date().toISOString(),
          }),
      }),
      {
        name: 'flow-storage',
      }
    )
  )
)
