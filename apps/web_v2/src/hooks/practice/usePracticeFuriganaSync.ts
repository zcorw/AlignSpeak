import { useCallback, useEffect, useRef, useState } from 'react'
import { getApiErrorMessage } from '../../services/authService'
import {
  practiceService,
  type PracticeLanguage,
  type PracticeReadingToken,
  type SegmentReadingOverrideInput,
} from '../../services/practiceService'

const SAVE_DEBOUNCE_MS = 450

const isPunctuationToken = (value: string): boolean => {
  const compact = value.replace(/\s+/g, '')
  if (!compact) return true
  return /^[\p{P}\p{S}]+$/u.test(compact)
}

const normalizeFallbackTokens = (tokens: PracticeReadingToken[] | undefined): PracticeReadingToken[] =>
  (tokens ?? []).map((token, index) => ({
    tokenIndex: typeof token.tokenIndex === 'number' ? token.tokenIndex : index,
    surface: token.surface,
    yomi: token.yomi ?? null,
    editable: !isPunctuationToken(token.surface),
    source: token.source ?? (token.yomi ? 'auto' : 'none'),
  }))

interface UsePracticeFuriganaSyncOptions {
  segmentId: string | null
  language: PracticeLanguage
  fallbackTokens: PracticeReadingToken[] | undefined
  errorMessage: string
}

export const usePracticeFuriganaSync = ({
  segmentId,
  language,
  fallbackTokens,
  errorMessage,
}: UsePracticeFuriganaSyncOptions) => {
  const [tokens, setTokens] = useState<PracticeReadingToken[]>(() => normalizeFallbackTokens(fallbackTokens))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pendingOverridesRef = useRef<SegmentReadingOverrideInput[] | null>(null)
  const debounceTimerRef = useRef<number | null>(null)

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    pendingOverridesRef.current = null
    clearDebounce()
  }, [clearDebounce, segmentId])

  useEffect(() => {
    if (language !== 'ja' || !segmentId) {
      setTokens(normalizeFallbackTokens(fallbackTokens))
      setLoading(false)
      setError(null)
      return undefined
    }

    let active = true
    setLoading(true)
    setError(null)
    void practiceService
      .getSegmentReading(segmentId)
      .then((payload) => {
        if (!active) return
        setTokens(normalizeFallbackTokens(payload.tokens))
      })
      .catch((cause: unknown) => {
        if (!active) return
        setTokens(normalizeFallbackTokens(fallbackTokens))
        setError(getApiErrorMessage(cause, errorMessage))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [errorMessage, fallbackTokens, language, segmentId])

  const flushPendingOverrides = useCallback(async () => {
    clearDebounce()
    if (language !== 'ja' || !segmentId) {
      pendingOverridesRef.current = null
      return
    }
    const pending = pendingOverridesRef.current
    if (!pending) return
    pendingOverridesRef.current = null
    setSaving(true)
    setError(null)
    try {
      await practiceService.replaceSegmentReadingOverrides(segmentId, pending)
    } catch (cause: unknown) {
      setError(getApiErrorMessage(cause, errorMessage))
      throw cause
    } finally {
      setSaving(false)
    }
  }, [clearDebounce, errorMessage, language, segmentId])

  const scheduleReplaceOverrides = useCallback(
    (overrides: SegmentReadingOverrideInput[]) => {
      if (language !== 'ja' || !segmentId) return
      pendingOverridesRef.current = overrides
      clearDebounce()
      debounceTimerRef.current = window.setTimeout(() => {
        void flushPendingOverrides().catch(() => undefined)
      }, SAVE_DEBOUNCE_MS)
    },
    [clearDebounce, flushPendingOverrides, language, segmentId]
  )

  useEffect(() => {
    return () => {
      clearDebounce()
    }
  }, [clearDebounce])

  const hasPendingSave = pendingOverridesRef.current !== null

  return {
    tokens,
    loading,
    saving,
    error,
    hasPendingSave,
    scheduleReplaceOverrides,
    flushPendingOverrides,
  }
}
