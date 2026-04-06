import { useCallback, useMemo, useState } from 'react'
import type { PracticeLanguage, PracticeReadingToken, SegmentReadingOverrideInput } from '../../services/practiceService'

const normalizeTokenIndex = (token: PracticeReadingToken, fallbackIndex: number): number =>
  typeof token.tokenIndex === 'number' ? token.tokenIndex : fallbackIndex

const getSourceKey = (enabled: boolean, language: PracticeLanguage, tokens: PracticeReadingToken[]): string => {
  if (!enabled || language !== 'ja') {
    return `disabled:${language}:${enabled ? '1' : '0'}`
  }
  return tokens
    .map((token, index) => {
      const tokenIndex = normalizeTokenIndex(token, index)
      const surface = token.surface ?? ''
      const yomi = token.yomi ?? ''
      const source = token.source ?? ''
      const editable = token.editable ? '1' : '0'
      const confidence = typeof token.readingConfidence === 'number' ? token.readingConfidence.toFixed(3) : ''
      const needsConfirmation = token.needsConfirmation ? '1' : '0'
      const candidates = Array.isArray(token.readingCandidates)
        ? token.readingCandidates.join(',')
        : ''
      return `${tokenIndex}:${surface}:${yomi}:${source}:${editable}:${confidence}:${needsConfirmation}:${candidates}`
    })
    .join('|')
}

const getOverrideMapFromTokens = (tokens: PracticeReadingToken[]): Record<number, string> => {
  const nextOverrides: Record<number, string> = {}
  for (const [index, token] of tokens.entries()) {
    if (token.source !== 'override') continue
    const tokenIndex = normalizeTokenIndex(token, index)
    nextOverrides[tokenIndex] = typeof token.yomi === 'string' ? token.yomi : ''
  }
  return nextOverrides
}

interface UsePracticeFuriganaEditorOptions {
  language: PracticeLanguage
  tokens: PracticeReadingToken[]
  enabled: boolean
  onOverridesChange: (overrides: SegmentReadingOverrideInput[]) => void
  onTokenSurfacesChange?: (surfaces: string[]) => void
}

interface KeyedBooleanState {
  sourceKey: string
  value: boolean
}

interface KeyedTokenState {
  sourceKey: string
  tokenIndex: number | null
}

interface KeyedOverridesState {
  sourceKey: string
  values: Record<number, string>
}

export const usePracticeFuriganaEditor = ({
  language,
  tokens,
  enabled,
  onOverridesChange,
  onTokenSurfacesChange,
}: UsePracticeFuriganaEditorOptions) => {
  const sourceKey = useMemo(() => getSourceKey(enabled, language, tokens), [enabled, language, tokens])

  const baseOverrides = useMemo(() => getOverrideMapFromTokens(tokens), [tokens])

  const [editModeState, setEditModeState] = useState<KeyedBooleanState>({
    sourceKey: '',
    value: false,
  })
  const [activeTokenState, setActiveTokenState] = useState<KeyedTokenState>({
    sourceKey: '',
    tokenIndex: null,
  })
  const [overrideState, setOverrideState] = useState<KeyedOverridesState>({
    sourceKey: '',
    values: {},
  })

  const overrides =
    overrideState.sourceKey === sourceKey
      ? overrideState.values
      : baseOverrides

  const mergedTokens = useMemo<PracticeReadingToken[]>(
    () =>
      tokens.map((token, index) => {
        const tokenIndex = normalizeTokenIndex(token, index)
        const hasOverride = Object.prototype.hasOwnProperty.call(overrides, tokenIndex)
        if (!hasOverride) {
          return {
            ...token,
            tokenIndex,
          }
        }
        const override = overrides[tokenIndex]
        const normalizedOverride = override.trim()
        return {
          ...token,
          tokenIndex,
          yomi: normalizedOverride || null,
          source: 'override',
          readingCandidates: normalizedOverride ? [normalizedOverride] : [],
          readingConfidence: normalizedOverride ? 1 : null,
          needsConfirmation: false,
        }
      }),
    [overrides, tokens]
  )

  const editableTokenIndices = useMemo(
    () =>
      mergedTokens
        .filter((token) => token.editable)
        .map((token, index) => normalizeTokenIndex(token, index)),
    [mergedTokens]
  )

  const canEdit = enabled && language === 'ja' && editableTokenIndices.length > 0
  const isEditMode = canEdit && editModeState.sourceKey === sourceKey ? editModeState.value : false
  const activeTokenIndex =
    canEdit && activeTokenState.sourceKey === sourceKey ? activeTokenState.tokenIndex : null

  const tokenByIndex = useMemo(() => {
    const mapped = new Map<number, PracticeReadingToken>()
    for (const [index, token] of mergedTokens.entries()) {
      mapped.set(normalizeTokenIndex(token, index), token)
    }
    return mapped
  }, [mergedTokens])

  const activeToken = useMemo(
    () => (activeTokenIndex == null ? null : tokenByIndex.get(activeTokenIndex) ?? null),
    [activeTokenIndex, tokenByIndex]
  )

  const emitOverrides = useCallback(
    (next: Record<number, string>) => {
      const payload = Object.entries(next)
        .map(([tokenIndex, yomi]) => {
          const numericIndex = Number(tokenIndex)
          const token = tokenByIndex.get(numericIndex)
          if (!token || !token.surface) return null
          return {
            tokenIndex: numericIndex,
            surface: token.surface,
            yomi: yomi.trim() ? yomi.trim() : null,
          }
        })
        .filter((item): item is SegmentReadingOverrideInput => item !== null)
        .sort((a, b) => a.tokenIndex - b.tokenIndex)
      onOverridesChange(payload)
    },
    [onOverridesChange, tokenByIndex]
  )

  const updateOverrides = useCallback(
    (updater: (current: Record<number, string>) => Record<number, string>) => {
      setOverrideState((prev) => {
        const current = prev.sourceKey === sourceKey ? prev.values : baseOverrides
        const next = updater(current)
        emitOverrides(next)
        return { sourceKey, values: next }
      })
    },
    [baseOverrides, emitOverrides, sourceKey]
  )

  const setOverride = useCallback(
    (tokenIndex: number, yomi: string) => {
      updateOverrides((current) => ({ ...current, [tokenIndex]: yomi }))
    },
    [updateOverrides]
  )

  const setActiveYomi = useCallback(
    (yomi: string) => {
      if (activeTokenIndex == null) return
      setOverride(activeTokenIndex, yomi)
    },
    [activeTokenIndex, setOverride]
  )

  const setEditMode = useCallback(
    (value: boolean) => {
      if (!canEdit) {
        setEditModeState({ sourceKey, value: false })
        setActiveTokenState({ sourceKey, tokenIndex: null })
        return
      }
      setEditModeState({ sourceKey, value })
      if (!value) {
        setActiveTokenState({ sourceKey, tokenIndex: null })
        return
      }
      const pendingTokenArrayIndex = mergedTokens.findIndex((token, index) => {
        const tokenIndex = normalizeTokenIndex(token, index)
        return Boolean(token.needsConfirmation) && editableTokenIndices.includes(tokenIndex)
      })
      if (pendingTokenArrayIndex >= 0) {
        setActiveTokenState({
          sourceKey,
          tokenIndex: normalizeTokenIndex(mergedTokens[pendingTokenArrayIndex], pendingTokenArrayIndex),
        })
        return
      }
      setActiveTokenState({
        sourceKey,
        tokenIndex: editableTokenIndices[0] ?? null,
      })
    },
    [canEdit, editableTokenIndices, mergedTokens, sourceKey]
  )

  const toggleEditMode = useCallback(() => {
    setEditMode(!isEditMode)
  }, [isEditMode, setEditMode])

  const selectToken = useCallback(
    (tokenIndex: number) => {
      if (!isEditMode) return
      if (!editableTokenIndices.includes(tokenIndex)) return
      setActiveTokenState({ sourceKey, tokenIndex })
    },
    [editableTokenIndices, isEditMode, sourceKey]
  )

  const moveActiveToken = useCallback(
    (offset: number) => {
      if (!editableTokenIndices.length) return
      if (activeTokenIndex == null) {
        setActiveTokenState({
          sourceKey,
          tokenIndex: offset > 0 ? editableTokenIndices[0] : editableTokenIndices[editableTokenIndices.length - 1],
        })
        return
      }
      const currentIndex = editableTokenIndices.indexOf(activeTokenIndex)
      const nextIndex = Math.min(
        Math.max(currentIndex + offset, 0),
        editableTokenIndices.length - 1
      )
      setActiveTokenState({ sourceKey, tokenIndex: editableTokenIndices[nextIndex] })
    },
    [activeTokenIndex, editableTokenIndices, sourceKey]
  )

  const focusPrevToken = useCallback(() => moveActiveToken(-1), [moveActiveToken])
  const focusNextToken = useCallback(() => moveActiveToken(1), [moveActiveToken])

  const resetActiveToken = useCallback(() => {
    if (activeTokenIndex == null) return
    updateOverrides((current) => {
      const next = { ...current }
      delete next[activeTokenIndex]
      return next
    })
  }, [activeTokenIndex, updateOverrides])

  const splitActiveToken = useCallback(
    (splitAt: number) => {
      if (!isEditMode || activeTokenIndex == null || !onTokenSurfacesChange) return
      const activeArrayIndex = mergedTokens.findIndex(
        (token, index) => normalizeTokenIndex(token, index) === activeTokenIndex
      )
      if (activeArrayIndex < 0) return
      const activeSurface = mergedTokens[activeArrayIndex]?.surface ?? ''
      const chars = Array.from(activeSurface)
      if (splitAt <= 0 || splitAt >= chars.length) return
      const left = chars.slice(0, splitAt).join('')
      const right = chars.slice(splitAt).join('')
      if (!left || !right) return
      const nextSurfaces = mergedTokens.map((token) => token.surface)
      nextSurfaces.splice(activeArrayIndex, 1, left, right)
      onTokenSurfacesChange(nextSurfaces)
      setEditModeState({ sourceKey, value: false })
      setActiveTokenState({ sourceKey, tokenIndex: null })
    },
    [activeTokenIndex, isEditMode, mergedTokens, onTokenSurfacesChange, sourceKey]
  )

  const mergeActiveTokenWithPrev = useCallback(() => {
    if (!isEditMode || activeTokenIndex == null || !onTokenSurfacesChange) return
    const activeArrayIndex = mergedTokens.findIndex(
      (token, index) => normalizeTokenIndex(token, index) === activeTokenIndex
    )
    if (activeArrayIndex <= 0) return
    const left = mergedTokens[activeArrayIndex - 1]
    const right = mergedTokens[activeArrayIndex]
    if (!left || !right) return
    const nextSurfaces = mergedTokens.map((token) => token.surface)
    nextSurfaces.splice(activeArrayIndex - 1, 2, `${left.surface}${right.surface}`)
    onTokenSurfacesChange(nextSurfaces)
    setEditModeState({ sourceKey, value: false })
    setActiveTokenState({ sourceKey, tokenIndex: null })
  }, [activeTokenIndex, isEditMode, mergedTokens, onTokenSurfacesChange, sourceKey])

  const mergeActiveTokenWithNext = useCallback(() => {
    if (!isEditMode || activeTokenIndex == null || !onTokenSurfacesChange) return
    const activeArrayIndex = mergedTokens.findIndex(
      (token, index) => normalizeTokenIndex(token, index) === activeTokenIndex
    )
    if (activeArrayIndex < 0 || activeArrayIndex >= mergedTokens.length - 1) return
    const left = mergedTokens[activeArrayIndex]
    const right = mergedTokens[activeArrayIndex + 1]
    if (!left || !right) return
    const nextSurfaces = mergedTokens.map((token) => token.surface)
    nextSurfaces.splice(activeArrayIndex, 2, `${left.surface}${right.surface}`)
    onTokenSurfacesChange(nextSurfaces)
    setEditModeState({ sourceKey, value: false })
    setActiveTokenState({ sourceKey, tokenIndex: null })
  }, [activeTokenIndex, isEditMode, mergedTokens, onTokenSurfacesChange, sourceKey])

  const activeYomi = useMemo(() => {
    if (activeToken == null) return ''
    return typeof activeToken.yomi === 'string' ? activeToken.yomi : ''
  }, [activeToken])

  const activeCandidates = useMemo(() => {
    if (activeToken == null) return []
    const candidates = Array.isArray(activeToken.readingCandidates)
      ? activeToken.readingCandidates
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : []
    const uniqueCandidates = Array.from(new Set(candidates))
    if (uniqueCandidates.length > 0) return uniqueCandidates
    return activeYomi ? [activeYomi] : []
  }, [activeToken, activeYomi])

  const activeNeedsConfirmation = Boolean(activeToken?.needsConfirmation)

  return {
    canEdit,
    isEditMode,
    activeTokenIndex,
    activeToken,
    activeYomi,
    activeCandidates,
    activeNeedsConfirmation,
    mergedTokens,
    setEditMode,
    toggleEditMode,
    selectToken,
    setActiveYomi,
    resetActiveToken,
    splitActiveToken,
    mergeActiveTokenWithPrev,
    mergeActiveTokenWithNext,
    focusPrevToken,
    focusNextToken,
  }
}
